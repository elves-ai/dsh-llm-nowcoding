/**
 * Client wire face for the plugin's own fenced `/nowcoding/api` route.
 *
 * DRAFT (not installed): this is the on-disk `src/client/api.ts` extended with
 * the settings-half methods the brief's settings page needs. Every export the
 * existing file had is preserved verbatim, so the existing quota card keeps
 * compiling; the additions are the settings envelope, the path ops, the two
 * settings calls, and the commit notification the card can subscribe to.
 *
 * Wire contract, owned jointly with `src/settings-routes.ts`: one POST per
 * method, body `{ method, payload }`, answer `{ ok: true, value }` or
 * `{ ok: false, error: { code, message } }`.
 *
 * @module @elves-ai/dsh-llm-nowcoding/client/api
 */

import type { NowCodingFastServiceTier } from '../settings-shared.ts'

/** One remaining-quota snapshot as the Host route reports it. */
export interface NowCodingQuotaSnapshotView {
  /** Granted total in the gateway's display currency. */
  total: number
  /** Consumed amount in the gateway's display currency. */
  used: number
  /** `total - used`, floored at zero. */
  remaining: number
  /** True for an unmetered key, where the three amounts are the gateway's sentinel. */
  unlimited: boolean
  /** Which document this balance came from: a monthly plan or the wallet. */
  source: 'subscription' | 'billing'
  /** Epoch milliseconds when the grant lapses; 0 means it does not. */
  accessUntil: number
  /** Epoch milliseconds of the next scheduled reset; 0 when the source schedules none. */
  resetAt: number
  /** Epoch milliseconds when the Host read the balance. */
  fetchedAt: number
  /** Plan title, present for a subscription. */
  planTitle?: string
  /** Reset cadence as the gateway names it, present for a subscription. */
  resetPeriod?: string
}

/** Answer of `quota.get`. */
export interface NowCodingQuotaView {
  /** Whether the sidebar card should draw anything, per the user's setting. */
  enabled: boolean
  /** Null when no API key is configured yet, so there is nothing to read. */
  snapshot: NowCodingQuotaSnapshotView | null
  /** Symbol the amounts are expressed in. */
  currency: string
  /** Seconds the card should wait before refreshing again. */
  refreshSeconds: number
}

/** One redacted secret slot (`set` tells whether a value is configured). */
export interface NowCodingSettingsSecretView {
  path: string[]
  set: boolean
}

/** Answer of `settings.get` and `settings.mutate` (`NowCodingSettingsView` `value`). */
export interface NowCodingSettingsEnvelope {
  /** Resolved settings document; narrow it with {@link settingsViewOf}. */
  value: unknown
  /** Settings-document revision the next mutate is checked against. */
  revision: number
  /** Deployment-level layer, when the namespace has one. */
  base?: unknown
  /** User-layer document, when the namespace has one. */
  user?: unknown
  /** Whether a commit reaches the running plugin or needs a restart. */
  applies: 'live' | 'restart'
  /** Redacted secret slots. */
  secrets: NowCodingSettingsSecretView[]
  /** False when the settings document is read-only in this deployment. */
  writable: boolean
}

/** The NowCoding fields this client renders, read out of an envelope. */
export interface NowCodingSettingsView {
  /** Endpoint base every model, quota, and pricing path is resolved against. */
  baseURL?: string
  /** Route-level default for the GPT fast tier. */
  fast?: boolean
  /** Wire spelling sent when fast mode is on. */
  fastServiceTier?: NowCodingFastServiceTier
  /** Show the remaining-quota card at the sidebar foot. */
  quotaCard?: boolean
  /** Dashboard user id sent as `New-Api-User`; the panel token itself never rides a response. */
  panelUserId?: string
}

/** One path-addressed settings edit sent to the Host route. */
export type NowCodingSettingsOp =
  | { op: 'set'; path: [string]; value: unknown }
  | { op: 'unset'; path: [string] }

/** Success envelope of the NowCoding route. */
interface NowCodingEnvelope<T> {
  ok: true
  value: T
}

/** Failure envelope of the NowCoding route. */
interface NowCodingFailure {
  ok: false
  error: { code: string; message: string }
}

/** Wire error carrying the route's stable machine code. */
export class NowCodingApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'NowCodingApiError'
  }
}

/** POST one method to `/nowcoding/api` and unwrap the success envelope. */
async function post<T>(method: string, payload?: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch('/nowcoding/api', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ method, payload: payload ?? {} }),
      ...signal === undefined ? {} : { signal },
    })
  } catch (error) {
    throw new NowCodingApiError(
      'unreachable',
      `无法连接 NowCoding 接口：${error instanceof Error ? error.message : String(error)}`,
    )
  }
  let body: NowCodingEnvelope<T> | NowCodingFailure
  try {
    body = await response.json() as NowCodingEnvelope<T> | NowCodingFailure
  } catch {
    throw new NowCodingApiError('unreachable', `NowCoding 接口返回了无法解析的响应（HTTP ${response.status}）`)
  }
  if (!response.ok || !body.ok) {
    const failure = body as NowCodingFailure
    throw new NowCodingApiError(
      failure.error?.code ?? 'unreachable',
      failure.error?.message ?? `HTTP ${response.status}`,
    )
  }
  return (body as NowCodingEnvelope<T>).value
}

/**
 * Read the configured key's remaining balance.
 * @param signal - cancellation for this read, honoured by the browser fetch.
 * @returns the balance view; `snapshot` is null until a key is configured.
 */
export function getQuota(signal?: AbortSignal): Promise<NowCodingQuotaView> {
  return post<NowCodingQuotaView>('quota.get', {}, signal)
}

/** Read the redacted NowCoding settings document. */
export function getNowCodingSettings(): Promise<NowCodingSettingsEnvelope> {
  return post<NowCodingSettingsEnvelope>('settings.get')
}

/** Answer of `panel.login` and `panel.two-factor`; the credential itself stays on the Host. */
export type NowCodingLoginView =
  | { status: 'two-factor-required' }
  | {
    status: 'ok'
    /** Account id the Host wrote to `panelUserId`. */
    userId: string
    /** Account name, for the page's confirmation copy. */
    username: string
    /** How the token was obtained; absent when the sign-in stored only the session. */
    tokenSource?: 'login' | 'read'
  }

/**
 * Sign in with the account's NowCoding console credentials.
 *
 * The password rides this one request and is stored by neither half: the Host
 * exchanges it for the console credential — the sign-in session, plus the
 * access token when one is readable — and writes that into the settings slots
 * without ever sending it back.
 * @param username - console username.
 * @param password - console password.
 * @returns the sign-in answer, or a request for the second factor.
 */
export function panelLogin(username: string, password: string): Promise<NowCodingLoginView> {
  return post<NowCodingLoginView>('panel.login', { username, password })
}

/**
 * Answer the two-factor challenge the last {@link panelLogin} opened.
 * @param code - authenticator code, or one of the account's backup codes.
 * @returns the sign-in answer.
 */
export function panelTwoFactorLogin(code: string): Promise<NowCodingLoginView> {
  return post<NowCodingLoginView>('panel.two-factor', { code })
}

/**
 * Apply path ops and return the fresh redacted document.
 * @param ops - path-addressed edits applied in one commit.
 * @param expectedRevision - revision this caller read; the Host rejects a stale one.
 * @returns the committed document.
 */
export async function mutateNowCodingSettings(
  ops: readonly NowCodingSettingsOp[],
  expectedRevision?: number,
): Promise<NowCodingSettingsEnvelope> {
  const next = await post<NowCodingSettingsEnvelope>('settings.mutate', {
    ops,
    ...(expectedRevision === undefined ? {} : { expectedRevision }),
  })
  for (const listener of committedListeners) listener()
  return next
}

/** Listeners re-reading the document after another surface committed an edit. */
const committedListeners = new Set<() => void>()

/**
 * Subscribe to successful settings commits from this bundle.
 *
 * The settings page and the sidebar card are independent mounts with no shared
 * store, so the commit notification lives on the one module they share: the
 * card drops out as soon as a save setting `quotaCard` false lands, instead of
 * waiting out its refresh tick.
 * @param listener - called after every successful `settings.mutate`.
 * @returns the unsubscribe function.
 */
export function onNowCodingSettingsCommitted(listener: () => void): () => void {
  committedListeners.add(listener)
  return () => { committedListeners.delete(listener) }
}

/**
 * Narrow an envelope's `value` into the fields this client renders.
 * @param envelope - the route's answer.
 * @returns the known fields; unknown or mistyped fields stay absent.
 */
export function settingsViewOf(envelope: NowCodingSettingsEnvelope): NowCodingSettingsView {
  const value = envelope.value !== null && typeof envelope.value === 'object'
    ? envelope.value as Record<string, unknown>
    : {}
  const tier = value.fastServiceTier
  return {
    ...typeof value.baseURL === 'string' ? { baseURL: value.baseURL } : {},
    ...typeof value.fast === 'boolean' ? { fast: value.fast } : {},
    ...tier === 'priority' || tier === 'fast' ? { fastServiceTier: tier } : {},
    ...typeof value.quotaCard === 'boolean' ? { quotaCard: value.quotaCard } : {},
    ...typeof value.panelUserId === 'string' ? { panelUserId: value.panelUserId } : {},
  }
}

/** True when the write-only `apiKey` slot currently holds a value. */
export function isNowCodingApiKeyConfigured(envelope: NowCodingSettingsEnvelope): boolean {
  return secretSet(envelope, 'apiKey')
}

/**
 * True when the write-only `panelToken` slot currently holds a value.
 * @param envelope - a settings envelope.
 * @returns whether a dashboard token is stored.
 */
export function isNowCodingPanelTokenConfigured(envelope: NowCodingSettingsEnvelope): boolean {
  return secretSet(envelope, 'panelToken')
}

/**
 * True when the write-only `panelSession` slot currently holds a value.
 * @param envelope - a settings envelope.
 * @returns whether a sign-in session cookie is stored.
 */
export function isNowCodingPanelSessionConfigured(envelope: NowCodingSettingsEnvelope): boolean {
  return secretSet(envelope, 'panelSession')
}

/** Whether one top-level secret slot holds a value. */
function secretSet(envelope: NowCodingSettingsEnvelope, field: string): boolean {
  return envelope.secrets.some(secret => secret.path.length === 1 && secret.path[0] === field && secret.set)
}
