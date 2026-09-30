/**
 * Remaining-quota reader for the NowCoding gateway.
 *
 * The gateway exposes two different balances on two different authentication
 * chains, and which one a user cares about depends on how they pay:
 *
 * - **Subscription** (a monthly plan) — `GET {origin}/api/subscription/self`.
 *   This is the console API and matches what the gateway's own console shows:
 *   the plan's allowance and its consumption against it. It authenticates with
 *   a dashboard access token plus `New-Api-User`; the `sk-` model key is
 *   rejected on this chain, which is why the plugin asks for a second
 *   credential before it can report this balance.
 * - **Pay-as-you-go wallet** — `GET {base}/dashboard/billing/{subscription,usage}`.
 *   This is the relay API and authenticates with the same `sk-` key chat uses.
 *
 * Three properties of the documents are easy to get wrong and are handled here
 * rather than at each caller:
 *
 * - Amounts are **raw quota units**, not currency. A displayed amount is
 *   `raw / quota_per_unit`, and `quota_per_unit` comes from the public status
 *   document. Dividing by a guessed constant silently misreports every figure.
 * - `soft_limit_usd` (relay chain) is the **granted total**, not the remaining
 *   balance: remaining is `soft_limit_usd - total_usage / 100`.
 * - The `*_usd` names carry the gateway's **display currency**, which this
 *   deployment sets to CNY. The names are a compatibility leftover.
 *
 * @module @elves-ai/dsh-llm-nowcoding/quota
 */

import { attributionHeaders } from '@deepseek-ai/dsh-llm'
import {
  NOWCODING_FALLBACK_QUOTA_PER_UNIT,
  NOWCODING_QUOTA_SUBSCRIPTION_PATH,
  NOWCODING_QUOTA_USAGE_PATH,
  NOWCODING_STATUS_PATH,
  NOWCODING_SUBSCRIPTION_PATH,
  NOWCODING_UNLIMITED_QUOTA_SENTINEL,
} from './settings-shared.ts'

/** Stable failure classification for one quota read. */
export type NowCodingQuotaErrorCode =
  /** The gateway could not be reached at all. */
  | 'unreachable'
  /** The gateway rejected the credential. */
  | 'unauthorized'
  /** The gateway answered with a non-success status. */
  | 'gateway-error'
  /** The gateway answered with a body this reader cannot read. */
  | 'unprocessable'
  /** The call exceeded its timeout. */
  | 'timeout'

/** One failed quota read, carrying the classification callers branch on. */
export class NowCodingQuotaError extends Error {
  constructor(
    readonly code: NowCodingQuotaErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'NowCodingQuotaError'
  }
}

/** Which balance a snapshot describes. */
export type NowCodingQuotaSource =
  /** A monthly plan's allowance, read from the console API. */
  | 'subscription'
  /** The pay-as-you-go wallet, read from the relay billing pair. */
  | 'billing'

/** One successfully read balance, in the gateway's display units. */
export interface NowCodingQuotaSnapshot {
  /** Which document this balance came from. */
  source: NowCodingQuotaSource
  /** Granted allowance for the current period, in display units. */
  total: number
  /** Consumed allowance for the current period, in display units. */
  used: number
  /** `total - used`, floored at zero. */
  remaining: number
  /** Whether the credential is unmetered, in which case the amounts are the gateway's sentinel. */
  unlimited: boolean
  /** Epoch milliseconds when the grant lapses; 0 means it does not. */
  accessUntil: number
  /** Epoch milliseconds of the next scheduled reset; 0 when the source schedules none. */
  resetAt: number
  /** Epoch milliseconds when this snapshot was read. */
  fetchedAt: number
  /** Plan title, when the snapshot came from a subscription. */
  planTitle?: string
  /** Reset cadence as the gateway names it (`daily`, …); absent for the wallet source. */
  resetPeriod?: string
  /** Raw units per displayed unit, so a wrong divisor is visible rather than silent. */
  quotaPerUnit: number
}

/** Injection seam for tests and for deployments that bring their own transport. */
export interface NowCodingQuotaReaderOptions {
  /** Endpoint base, including the `/v1` segment. */
  baseURL: string
  /** NowCoding model key sent as `Authorization: Bearer` on the relay chain. */
  apiKey: string
  /** Dashboard access token; when present the reader prefers the subscription document. */
  panelToken?: string
  /** Dashboard user id sent as `New-Api-User`; required by the console chain. */
  panelUserId?: string
  /** Transport override; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch
  /** Per-attempt timeout in milliseconds. */
  timeoutMs?: number
  /** Clock override for tests. */
  now?: () => number
}

/** Reads the gateway balance for one credential. */
export interface NowCodingQuotaReader {
  /**
   * Read the current balance.
   * @param signal - caller cancellation; the read settles promptly after it aborts.
   * @returns the balance the gateway reports for these credentials.
   */
  read(signal?: AbortSignal): Promise<NowCodingQuotaSnapshot>
}

/** Default per-attempt timeout for one quota read. */
export const NOWCODING_DEFAULT_QUOTA_TIMEOUT_MS = 15_000

/** True for a JSON object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** First finite number among the candidates, or undefined. */
function firstNumber(source: Record<string, unknown>, keys: readonly string[]): number | undefined {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return undefined
}

/** A non-empty string member, or undefined. */
function stringMember(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/**
 * Read the divisor every displayed amount uses.
 *
 * @param status - the `/api/status` body.
 * @returns the gateway's `quota_per_unit`, or the documented fallback.
 */
export function quotaUnitOf(status: unknown): number {
  const data = isRecord(status) && isRecord(status['data']) ? status['data'] : undefined
  const unit = data === undefined ? undefined : firstNumber(data, ['quota_per_unit'])
  return unit !== undefined && unit > 0 ? unit : NOWCODING_FALLBACK_QUOTA_PER_UNIT
}

/** One subscription entry as both documents spell it. */
interface SubscriptionEntry extends Record<string, unknown> {
  status?: unknown
}

/** Every candidate subscription in a console document, active ones first. */
function subscriptionCandidates(payload: unknown): readonly SubscriptionEntry[] {
  if (!isRecord(payload)) return []
  const data = isRecord(payload['data']) ? payload['data'] : undefined
  if (data === undefined) return []
  const active = Array.isArray(data['subscriptions']) ? data['subscriptions'] as SubscriptionEntry[] : []
  const all = Array.isArray(data['all_subscriptions']) ? data['all_subscriptions'] as SubscriptionEntry[] : []
  const usable = active.length > 0 ? active : all
  return usable.filter(entry => isRecord(entry))
}

/**
 * Project the console subscription document into one balance.
 *
 * Exported for tests and for callers that already hold the document: the
 * normalization carries the field semantics, the request does not.
 *
 * @param payload - the `/api/subscription/self` body.
 * @param quotaPerUnit - raw units per displayed unit, from {@link quotaUnitOf}.
 * @param fetchedAt - epoch milliseconds to stamp on the snapshot.
 * @returns the balance, or undefined when no active subscription is present.
 */
export function normalizeSubscription(
  payload: unknown,
  quotaPerUnit: number,
  fetchedAt: number,
): NowCodingQuotaSnapshot | undefined {
  const entry = subscriptionCandidates(payload).find(candidate => candidate['status'] === 'active')
    ?? subscriptionCandidates(payload)[0]
  if (entry === undefined) return undefined
  const subscription = isRecord(entry['subscription']) ? entry['subscription'] : undefined
  if (subscription === undefined) return undefined
  const totalUnits = firstNumber(subscription, ['amount_total'])
  if (totalUnits === undefined) return undefined
  const usedUnits = firstNumber(subscription, ['amount_used']) ?? 0
  const unit = quotaPerUnit > 0 ? quotaPerUnit : NOWCODING_FALLBACK_QUOTA_PER_UNIT
  const total = totalUnits / unit
  const used = usedUnits / unit
  const endSeconds = firstNumber(subscription, ['end_time']) ?? 0
  const resetSeconds = firstNumber(subscription, ['next_reset_time']) ?? 0
  return {
    source: 'subscription',
    total,
    used,
    remaining: Math.max(0, total - used),
    unlimited: false,
    accessUntil: endSeconds > 0 ? endSeconds * 1_000 : 0,
    resetAt: resetSeconds > 0 ? resetSeconds * 1_000 : 0,
    fetchedAt,
    ...stringMember(entry, 'plan_title') === undefined ? {} : { planTitle: stringMember(entry, 'plan_title') as string },
    ...stringMember(entry, 'plan_quota_reset_period') === undefined
      ? {}
      : { resetPeriod: stringMember(entry, 'plan_quota_reset_period') as string },
    quotaPerUnit: unit,
  }
}

/**
 * Project the relay billing documents into one balance.
 *
 * @param subscription - the `/dashboard/billing/subscription` body.
 * @param usage - the `/dashboard/billing/usage` body.
 * @param fetchedAt - epoch milliseconds to stamp on the snapshot.
 * @returns the balance, or undefined when the documents carry no total.
 */
export function normalizeQuota(
  subscription: unknown,
  usage: unknown,
  fetchedAt: number,
): NowCodingQuotaSnapshot | undefined {
  if (!isRecord(subscription)) return undefined
  const total = firstNumber(subscription, ['soft_limit_usd', 'hard_limit_usd', 'system_hard_limit_usd'])
  if (total === undefined) return undefined
  const usedCents = isRecord(usage) ? firstNumber(usage, ['total_usage']) ?? 0 : 0
  const used = usedCents / 100
  const accessUntilSeconds = firstNumber(subscription, ['access_until']) ?? 0
  return {
    source: 'billing',
    total,
    used,
    remaining: Math.max(0, total - used),
    unlimited: total >= NOWCODING_UNLIMITED_QUOTA_SENTINEL,
    accessUntil: accessUntilSeconds > 0 ? accessUntilSeconds * 1_000 : 0,
    resetAt: 0,
    fetchedAt,
    // The relay document is already denominated in display units, so nothing
    // was divided and the divisor is recorded as one.
    quotaPerUnit: 1,
  }
}

/** Join an endpoint base and a gateway path without doubling or dropping the separator. */
function joinPath(baseURL: string, path: string): string {
  return baseURL.replace(/\/+$/, '') + path
}

/**
 * Build a quota reader for one set of credentials.
 * @param options - endpoint, credentials, and optional transport/clock seams.
 * @returns a reader that performs the requests its credentials allow.
 */
export function createQuotaReader(options: NowCodingQuotaReaderOptions): NowCodingQuotaReader {
  const timeoutMs = options.timeoutMs ?? NOWCODING_DEFAULT_QUOTA_TIMEOUT_MS
  const now = options.now ?? (() => Date.now())

  async function get(url: string, headers: Record<string, string>, signal: AbortSignal | undefined): Promise<unknown> {
    const fetchImpl = options.fetchImpl ?? globalThis.fetch
    const timer = new AbortController()
    const onAbort = (): void => timer.abort(signal?.reason)
    if (signal !== undefined) {
      if (signal.aborted) onAbort()
      else signal.addEventListener('abort', onAbort, { once: true })
    }
    const timeout = setTimeout(() => timer.abort(new Error('quota read timed out')), timeoutMs)
    let response: Response
    try {
      response = await fetchImpl(url, {
        method: 'GET',
        headers: { accept: 'application/json', ...attributionHeaders(), ...headers },
        signal: timer.signal,
      })
    } catch (error) {
      if (signal?.aborted === true) throw error
      if (timer.signal.aborted) {
        throw new NowCodingQuotaError('timeout', `quota read from ${url} exceeded ${timeoutMs}ms`)
      }
      throw new NowCodingQuotaError(
        'unreachable',
        `quota read from ${url} failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    } finally {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', onAbort)
    }
    if (response.status === 401 || response.status === 403) {
      throw new NowCodingQuotaError('unauthorized', `the gateway rejected the credential (HTTP ${response.status})`)
    }
    if (!response.ok) {
      throw new NowCodingQuotaError('gateway-error', `quota read from ${url} returned HTTP ${response.status}`)
    }
    try {
      return await response.json() as unknown
    } catch (error) {
      throw new NowCodingQuotaError(
        'unprocessable',
        `quota read from ${url} returned a body that is not JSON: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /** The console chain's headers; the header is omitted rather than empty when no id is configured. */
  function panelHeaders(): Record<string, string> {
    const token = options.panelToken ?? ''
    const userId = (options.panelUserId ?? '').trim()
    return {
      authorization: `Bearer ${token}`,
      ...userId.length === 0 ? {} : { 'new-api-user': userId },
    }
  }

  /** Read the monthly plan's allowance, or undefined when none is active. */
  async function readSubscription(origin: string, signal: AbortSignal | undefined): Promise<NowCodingQuotaSnapshot | undefined> {
    const [payload, status] = await Promise.all([
      get(origin + NOWCODING_SUBSCRIPTION_PATH, panelHeaders(), signal),
      get(origin + NOWCODING_STATUS_PATH, {}, signal),
    ])
    // The console chain answers HTTP 200 with success:false for a rejected
    // token, so a non-throwing body still has to be checked.
    if (isRecord(payload) && payload['success'] === false) {
      throw new NowCodingQuotaError(
        'unauthorized',
        `the gateway rejected the dashboard credential: ${stringMember(payload, 'message') ?? 'no reason given'}`,
      )
    }
    return normalizeSubscription(payload, quotaUnitOf(status), now())
  }

  /** Read the pay-as-you-go wallet through the relay chain. */
  async function readBilling(signal: AbortSignal | undefined): Promise<NowCodingQuotaSnapshot> {
    const headers = { authorization: `Bearer ${options.apiKey}` }
    const [subscription, usage] = await Promise.all([
      get(joinPath(options.baseURL, NOWCODING_QUOTA_SUBSCRIPTION_PATH), headers, signal),
      get(joinPath(options.baseURL, NOWCODING_QUOTA_USAGE_PATH), headers, signal),
    ])
    const snapshot = normalizeQuota(subscription, usage, now())
    if (snapshot === undefined) {
      throw new NowCodingQuotaError('unprocessable', 'the gateway billing document carries no quota total')
    }
    return snapshot
  }

  return {
    async read(signal?: AbortSignal): Promise<NowCodingQuotaSnapshot> {
      const token = (options.panelToken ?? '').trim()
      if (token.length > 0) {
        const subscription = await readSubscription(new URL(options.baseURL).origin, signal)
        if (subscription !== undefined) return subscription
        // A dashboard token without an active plan is a normal state: the user
        // holds a wallet balance instead, which the relay chain reports. That
        // chain authenticates with the model key, which signing in does not
        // supply, so a token-only account stops here with a reason.
        if (options.apiKey.length === 0) {
          throw new NowCodingQuotaError(
            'unprocessable',
            'this account has no active subscription plan, and no model API key is configured to read the wallet balance instead',
          )
        }
      }
      return readBilling(signal)
    },
  }
}
