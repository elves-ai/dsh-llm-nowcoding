/**
 * Remaining-quota reader for the NowCoding gateway.
 *
 * The gateway is a new-api deployment, so an API key alone can read the
 * OpenAI-compatible billing pair behind the same token authentication as
 * `/v1/models`. Two properties of that pair are easy to get wrong and are
 * handled here rather than at each caller:
 *
 * - `soft_limit_usd` is the **granted total**, not the remaining balance; the
 *   remaining balance is `soft_limit_usd - total_usage / 100`.
 * - The `*_usd` fields carry the gateway's **display currency**, which this
 *   deployment sets to CNY. The name is a compatibility leftover.
 *
 * @module @elves-ai/dsh-llm-nowcoding/quota
 */

import { attributionHeaders } from '@deepseek-ai/dsh-llm'
import {
  NOWCODING_QUOTA_SUBSCRIPTION_PATH,
  NOWCODING_QUOTA_USAGE_PATH,
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

/** One successfully read balance. */
export interface NowCodingQuotaSnapshot {
  /** Granted total in the gateway's display currency. */
  total: number
  /** Consumed amount in the gateway's display currency. */
  used: number
  /** `total - used`, floored at zero. */
  remaining: number
  /** Whether the key is unmetered, in which case the three amounts above are the gateway's sentinel. */
  unlimited: boolean
  /** Epoch milliseconds when the grant lapses; 0 means it does not. */
  accessUntil: number
  /** Epoch milliseconds when this snapshot was read. */
  fetchedAt: number
}

/** Injection seam for tests and for deployments that bring their own transport. */
export interface NowCodingQuotaReaderOptions {
  /** Endpoint base, including the `/v1` segment. */
  baseURL: string
  /** NowCoding API key sent as `Authorization: Bearer`. */
  apiKey: string
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
   * @returns the balance the gateway reports for this key.
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

/**
 * Project the gateway's two billing documents into one balance.
 *
 * Exported for tests and for callers that already hold the documents: the
 * normalization carries the field semantics, the request does not.
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
    total,
    used,
    remaining: Math.max(0, total - used),
    unlimited: total >= NOWCODING_UNLIMITED_QUOTA_SENTINEL,
    accessUntil: accessUntilSeconds > 0 ? accessUntilSeconds * 1_000 : 0,
    fetchedAt,
  }
}

/** Join an endpoint base and a gateway path without doubling or dropping the separator. */
function joinPath(baseURL: string, path: string): string {
  return baseURL.replace(/\/+$/, '') + path
}

/**
 * Build a quota reader for one endpoint and credential.
 * @param options - endpoint, credential, and optional transport/clock seams.
 * @returns a reader that performs one billing round trip per call.
 */
export function createQuotaReader(options: NowCodingQuotaReaderOptions): NowCodingQuotaReader {
  const timeoutMs = options.timeoutMs ?? NOWCODING_DEFAULT_QUOTA_TIMEOUT_MS
  const now = options.now ?? (() => Date.now())

  async function get(url: string, signal: AbortSignal | undefined): Promise<unknown> {
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
        headers: {
          // The gateway accepts the key with or without the `sk-` prefix.
          authorization: `Bearer ${options.apiKey}`,
          accept: 'application/json',
          ...attributionHeaders(),
        },
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
      throw new NowCodingQuotaError('unauthorized', `the gateway rejected the API key (HTTP ${response.status})`)
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

  return {
    async read(signal?: AbortSignal): Promise<NowCodingQuotaSnapshot> {
      const [subscription, usage] = await Promise.all([
        get(joinPath(options.baseURL, NOWCODING_QUOTA_SUBSCRIPTION_PATH), signal),
        get(joinPath(options.baseURL, NOWCODING_QUOTA_USAGE_PATH), signal),
      ])
      const snapshot = normalizeQuota(subscription, usage, now())
      if (snapshot === undefined) {
        throw new NowCodingQuotaError('unprocessable', 'the gateway billing document carries no quota total')
      }
      return snapshot
    },
  }
}
