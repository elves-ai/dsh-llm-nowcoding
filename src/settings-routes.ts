/**
 * Fenced `/nowcoding/api` route for the NowCoding settings page and sidebar
 * quota card.
 *
 * The DSH settings RPC domain only serves an allowlist of product-owned
 * namespaces, so a third-party plugin cannot read or write its own namespace
 * through `ctx.settingsScope`. This route reaches the settings seam in-process
 * from the plugin's own webserver route, gated by the same browser-trust fence
 * as the `/api` gateway: a Host-header loopback or configured trusted host,
 * and no cross-site browser markers.
 *
 * @module @elves-ai/dsh-llm-nowcoding/settings-routes
 */

import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import {
  SettingsConflictError,
  type SettingsDescriptor,
  type SettingsPathOp,
} from '@deepseek-ai/dsh-settings'
import type { NowCodingResolvedOptions } from './config.ts'
import {
  createPanelLogin,
  NowCodingLoginError,
  type NowCodingLoginFailure,
  type NowCodingLoginResult,
  type NowCodingPanelCredential,
  type NowCodingPanelLogin,
} from './panel-login.ts'
import { createQuotaReader, NowCodingQuotaError, type NowCodingQuotaSnapshot } from './quota.ts'
import {
  NOWCODING_DISPLAY_CURRENCY_SYMBOL,
  NOWCODING_SETTINGS_FIELDS,
  NOWCODING_SETTINGS_NAMESPACE,
  type NowCodingFastServiceTier,
  type NowCodingSettingsField,
} from './settings-shared.ts'

/** Structural webServer face (mirror of `@deepseek-ai/dsh-host-webserver`). */
export interface NowCodingWebServer {
  register(route: {
    kind: 'exact'
    path: string
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
  }): () => void
}

/** Structural webRuntime face (the bind-derived trusted host list). */
export interface NowCodingWebRuntime {
  trustedHosts: readonly string[]
}

/** The settings-seam members this route uses; the service satisfies it structurally. */
export interface NowCodingSettingsFace {
  readonly writable: boolean
  describe(options: { redactSecrets: true }): readonly SettingsDescriptor[]
  mutate(ns: string, ops: readonly SettingsPathOp[], expectedRevision?: number): Promise<unknown>
}

/** Everything one route method runs against, so dispatch is testable without a cordis context. */
export interface NowCodingRouteDeps {
  /** The settings seam, or undefined in a deployment that mounts none. */
  settings: NowCodingSettingsFace | undefined
  /** Resolved plugin options for this request. */
  options: NowCodingResolvedOptions
  /** Console sign-in, held across requests so a two-factor challenge survives the gap. */
  login: NowCodingPanelLogin
}

/** Answer of the two sign-in methods; the credential itself never rides it. */
export type NowCodingLoginAnswer =
  | { status: 'two-factor-required' }
  | {
    status: 'ok'
    /** Account id written to `panelUserId`. */
    userId: string
    /** Account name, for the page's confirmation copy. */
    username: string
    /** How the token was obtained, so the page can warn about a rotation. */
    tokenSource: NowCodingPanelCredential['tokenSource']
  }

/** One redacted secret slot as returned by `settings.describe({ redactSecrets: true })`. */
export interface NowCodingSettingsSecretView {
  path: string[]
  set: boolean
}

/** Redacted settings view served to the settings page. */
export interface NowCodingSettingsView {
  value: unknown
  revision: number
  base?: unknown
  user?: unknown
  applies: 'live' | 'restart'
  secrets: NowCodingSettingsSecretView[]
  writable: boolean
}

/** Balance payload returned by `quota.get`. */
export interface NowCodingQuotaView {
  /**
   * Whether the sidebar card should draw anything. False means the user turned
   * the card off; the route still answers so the card can hide itself without
   * a second round trip when the setting changes.
   */
  enabled: boolean
  /** Null when no credential is configured yet, so there is nothing to read. */
  snapshot: NowCodingQuotaSnapshot | null
  /** Symbol the snapshot amounts are expressed in. */
  currency: string
  /** Seconds the card should wait before refreshing again. */
  refreshSeconds: number
}

/** Wire failure envelope of the NowCoding route. */
export interface NowCodingRouteErrorBody {
  code: string
  message: string
}

/** Route-level error with an HTTP status and a stable machine code. */
export class NowCodingRouteError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message)
    this.name = 'NowCodingRouteError'
  }
}

const ALLOWED_FIELDS = new Set<string>(NOWCODING_SETTINGS_FIELDS)
const FAST_TIERS: readonly NowCodingFastServiceTier[] = ['priority', 'fast']
const MAX_BODY_BYTES = 1 << 20
const ROUTE_PATH = '/nowcoding/api'

/** Read and parse a bounded JSON request body. */
async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk)
    total += buffer.length
    if (total > MAX_BODY_BYTES) throw new NowCodingRouteError('bad-request', 'request body too large')
    chunks.push(buffer)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (text.trim() === '') return {}
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new NowCodingRouteError('bad-request', 'request body is not valid JSON')
  }
}

/** Write one JSON response. */
function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

/** Write the success envelope. */
function writeOk(res: ServerResponse, value: unknown): void {
  writeJson(res, 200, { ok: true, value })
}

/** Write a failure envelope for any thrown value. */
function writeError(res: ServerResponse, error: unknown): void {
  if (error instanceof NowCodingRouteError) {
    writeJson(res, error.status, { ok: false, error: { code: error.code, message: error.message } })
    return
  }
  if (error instanceof NowCodingQuotaError) {
    // 401 keeps the browser's own error handling honest: the credential, not
    // the request, is what failed.
    writeJson(res, error.code === 'unauthorized' ? 401 : 502, {
      ok: false,
      error: { code: error.code, message: error.message },
    })
    return
  }
  if (error instanceof NowCodingLoginError) {
    writeJson(res, loginStatus(error.code), {
      ok: false,
      error: { code: error.code, message: error.message },
    })
    return
  }
  writeJson(res, 500, {
    ok: false,
    error: { code: 'internal', message: error instanceof Error ? error.message : String(error) },
  })
}

/** HTTP status for one sign-in failure: a refused credential is the caller's, the rest are ours. */
function loginStatus(code: NowCodingLoginFailure): number {
  switch (code) {
    case 'bad-credentials':
    case 'two-factor-invalid':
      return 401
    case 'two-factor-unavailable':
      return 409
    default:
      return 502
  }
}

/** True for a plain object patch/payload. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Require a plain-object payload. */
function requireObject(payload: unknown, what: string): Record<string, unknown> {
  if (!isPlainObject(payload)) throw new NowCodingRouteError('bad-request', `${what} payload must be an object`)
  return payload
}

/** Require one non-empty string field of a payload. */
function requireStringField(source: Record<string, unknown>, key: string): string {
  const value = source[key]
  if (typeof value !== 'string' || value.length === 0) {
    throw new NowCodingRouteError('bad-request', `"${key}" must be a non-empty string`)
  }
  return value
}

/** Validate one top-level settings path op against the NowCoding schema. */
function validateOp(op: unknown): asserts op is SettingsPathOp {
  if (!isPlainObject(op) || op.op !== 'set' && op.op !== 'unset') {
    throw new NowCodingRouteError('bad-request', 'each op must be { op: "set" | "unset", path: [field] }')
  }
  const path = op.path
  if (!Array.isArray(path) || path.length !== 1 || typeof path[0] !== 'string' || !ALLOWED_FIELDS.has(path[0])) {
    throw new NowCodingRouteError('bad-request', `settings field must be one of: ${NOWCODING_SETTINGS_FIELDS.join(', ')}`)
  }
  if (op.op !== 'set') return
  const field = path[0] as NowCodingSettingsField
  const value = op.value
  switch (field) {
    case 'apiKey':
    case 'baseURL':
    case 'panelToken':
    case 'panelUserId':
      if (typeof value !== 'string') throw new NowCodingRouteError('bad-request', `"${field}" must be a string`)
      return
    case 'fast':
    case 'quotaCard':
      if (typeof value !== 'boolean') throw new NowCodingRouteError('bad-request', `"${field}" must be a boolean`)
      return
    case 'fastServiceTier':
      if (typeof value !== 'string' || !FAST_TIERS.includes(value as NowCodingFastServiceTier)) {
        throw new NowCodingRouteError('bad-request', `"fastServiceTier" must be one of: ${FAST_TIERS.join(', ')}`)
      }
      return
    default:
      throw new NowCodingRouteError('bad-request', `settings field must be one of: ${NOWCODING_SETTINGS_FIELDS.join(', ')}`)
  }
}

/** The current redacted view of the NowCoding settings namespace. */
function viewOf(settings: NowCodingSettingsFace, ns: string): NowCodingSettingsView | undefined {
  const descriptor: SettingsDescriptor | undefined = settings
    .describe({ redactSecrets: true })
    .find(candidate => candidate.ns === ns)
  if (descriptor === undefined) return undefined
  return {
    value: descriptor.value,
    revision: descriptor.revision,
    ...descriptor.base === undefined ? {} : { base: descriptor.base },
    ...descriptor.user === undefined ? {} : { user: descriptor.user },
    applies: descriptor.applies,
    secrets: descriptor.secrets ?? [],
    writable: settings.writable,
  }
}

/** Require this instance's section, then return its redacted view. */
function requireView(deps: NowCodingRouteDeps): NowCodingSettingsView {
  const view = viewOf(settingsOf(deps.settings), deps.options.settingsNs)
  if (view === undefined) {
    throw new NowCodingRouteError(
      'settings-rejected',
      `this deployment has no configuration section named "${deps.options.settingsNs}"`,
      503,
    )
  }
  return view
}

/** The settings seam, or a route error naming its absence. */
function settingsOf(settings: NowCodingSettingsFace | undefined): NowCodingSettingsFace {
  if (settings === undefined) {
    throw new NowCodingRouteError('settings-rejected', 'the settings service is not mounted in this deployment', 503)
  }
  return settings
}

/** True for the settings seam's stale-revision refusal. */
function isSettingsConflict(error: unknown): boolean {
  return error instanceof SettingsConflictError
    || (error !== null && typeof error === 'object' && (error as { code?: unknown }).code === 'SETTINGS_CONFLICT')
}

/** Read the balance for the route's current credential. */
async function readQuota(options: NowCodingResolvedOptions): Promise<NowCodingQuotaView> {
  const shared = {
    enabled: options.quotaCard,
    currency: NOWCODING_DISPLAY_CURRENCY_SYMBOL,
    refreshSeconds: options.quotaRefreshSeconds,
  }
  // Either credential can report a balance: the model key reaches the wallet,
  // the dashboard token reaches a monthly plan. Lacking both is a normal
  // first-run state rather than a failure, so the card says so instead of
  // surfacing a credential error the user cannot act on yet.
  if (options.apiKey.length === 0 && options.panelToken.length === 0) return { ...shared, snapshot: null }
  const reader = createQuotaReader({
    baseURL: options.baseURL,
    apiKey: options.apiKey,
    panelToken: options.panelToken,
    panelUserId: options.panelUserId,
  })
  return { ...shared, snapshot: await reader.read() }
}

/** Apply path ops through the settings seam and return the fresh redacted document. */
async function mutateSettings(
  deps: NowCodingRouteDeps,
  ops: readonly SettingsPathOp[],
  expectedRevision?: number,
): Promise<NowCodingSettingsView> {
  const settings = settingsOf(deps.settings)
  const ns = deps.options.settingsNs
  try {
    await settings.mutate(ns, ops, expectedRevision)
  } catch (error) {
    if (isSettingsConflict(error)) {
      throw new NowCodingRouteError('settings-conflict', error instanceof Error ? error.message : String(error), 409)
    }
    throw new NowCodingRouteError('settings-rejected', error instanceof Error ? error.message : String(error))
  }
  const view = viewOf(settings, ns)
  if (view === undefined) {
    throw new NowCodingRouteError('settings-rejected', `the configuration section "${ns}" disappeared after the write`, 503)
  }
  return view
}

/**
 * Store a finished sign-in's credential.
 *
 * The token is written from the Host and never rides the answer, so the page
 * learns which account signed in and nothing an XSS could replay.
 *
 * @param deps - settings seam and resolved options.
 * @param result - the sign-in step's answer.
 * @returns what the page may show about the sign-in.
 */
async function storeCredential(deps: NowCodingRouteDeps, result: NowCodingLoginResult): Promise<NowCodingLoginAnswer> {
  if (result.status === 'two-factor-required') return { status: 'two-factor-required' }
  const credential = result.credential
  await mutateSettings(deps, [
    { op: 'set', path: ['panelToken'], value: credential.accessToken },
    { op: 'set', path: ['panelUserId'], value: credential.userId },
  ])
  return {
    status: 'ok',
    userId: credential.userId,
    username: credential.username,
    tokenSource: credential.tokenSource,
  }
}

/**
 * Dispatch one API method against the seams this route uses.
 *
 * Exported so the browser-facing contract is exercised without a cordis
 * context; `registerNowCodingSettingsRoutes` is the only production caller.
 *
 * @param deps - settings seam, resolved options, and the console sign-in client.
 * @param method - the method name the request body carried.
 * @param payload - the payload the request body carried.
 * @returns the method's value.
 */
export async function dispatchNowCodingMethod(
  deps: NowCodingRouteDeps,
  method: unknown,
  payload: unknown,
): Promise<unknown> {
  switch (method) {
    case 'settings.get':
      return requireView(deps)
    case 'quota.get':
      return readQuota(deps.options)
    case 'settings.mutate': {
      const body = requireObject(payload, 'settings.mutate')
      const ops = body.ops
      if (!Array.isArray(ops) || ops.length === 0) {
        throw new NowCodingRouteError('bad-request', 'ops must be a non-empty array')
      }
      for (const op of ops) validateOp(op)
      const expectedRevision = typeof body.expectedRevision === 'number' ? body.expectedRevision : undefined
      return mutateSettings(deps, ops as SettingsPathOp[], expectedRevision)
    }
    case 'panel.login': {
      const body = requireObject(payload, 'panel.login')
      const username = requireStringField(body, 'username')
      const password = requireStringField(body, 'password')
      return storeCredential(deps, await deps.login.login(username, password))
    }
    case 'panel.two-factor': {
      const body = requireObject(payload, 'panel.two-factor')
      return storeCredential(deps, await deps.login.verifyTwoFactor(requireStringField(body, 'code')))
    }
    default:
      throw new NowCodingRouteError('not-found', `unknown NowCoding method "${String(method)}"`, 404)
  }
}

/**
 * Register `/nowcoding/api` while `webServer` and `webRuntime` are mounted.
 *
 * The optional-inject shape keeps the provider usable in deployments without a
 * web server; the settings page and the quota card simply have no route to call.
 *
 * @param ctx - plugin context.
 * @param options - thunk returning the route's current resolved options.
 */
export function registerNowCodingSettingsRoutes(
  ctx: Context,
  options: () => NowCodingResolvedOptions,
): void {
  // One sign-in client per plugin apply: a two-factor challenge is a session
  // held between two requests, so it cannot be rebuilt per call.
  const login = createPanelLogin({ baseURL: () => options().baseURL })
  ctx.inject(['webServer', 'webRuntime'], (routeCtx) => {
    const webServer = routeCtx.get('webServer') as NowCodingWebServer
    const webRuntime = routeCtx.get('webRuntime') as NowCodingWebRuntime
    routeCtx.effect(() => webServer.register({
      kind: 'exact',
      path: ROUTE_PATH,
      handler: async (req, res) => {
        if (!isTrustedApiRequest(req.headers, webRuntime.trustedHosts)) {
          writeJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } })
          return
        }
        if (req.method !== 'POST') {
          writeJson(res, 405, { ok: false, error: { code: 'method-error', message: 'method not allowed' } })
          return
        }
        try {
          const payload = await readJsonBody(req)
          const record = isPlainObject(payload) ? payload : {}
          const deps: NowCodingRouteDeps = {
            settings: ctx.get('settings') as NowCodingSettingsFace | undefined,
            options: options(),
            login,
          }
          writeOk(res, await dispatchNowCodingMethod(deps, record.method, record.payload))
        } catch (error) {
          writeError(res, error)
        }
      },
    }), 'llm-nowcoding: /nowcoding/api settings and quota route')
  })
}

// ── Browser-trust fence (same policy as the /api gateway) ──────────────────

/** One request header value. */
function header(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name]
  return typeof value === 'string' ? value : undefined
}

/** Normalized URL of a Host-header authority, or undefined when unparsable. */
function parseAuthority(authority: string): URL | undefined {
  try {
    return new URL(`http://${authority}`)
  } catch {
    return undefined
  }
}

/**
 * Whether a hostname names the local loopback authority.
 * @param hostname - a URL hostname.
 * @returns whether the host is loopback.
 */
export function isLoopbackHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  return parts.length === 4
    && parts[0] === '127'
    && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

/** Canonical authority form: hostname, or hostname:port when a port was written. */
function canonicalAuthority(entry: string, entryUrl: URL): string {
  const port = entryUrl.port !== '' ? entryUrl.port : new URL(`https://${entry}`).port
  return port === '' ? entryUrl.hostname : `${entryUrl.hostname}:${port}`
}

/** Whether the request authority matches a trustedHosts entry (exact or port-less). */
function isTrustedAuthority(hostUrl: URL, trustedHosts: readonly string[]): boolean {
  return trustedHosts.some((entry) => {
    const entryUrl = parseAuthority(entry)
    if (entryUrl === undefined) return false
    return canonicalAuthority(entry, entryUrl) === entryUrl.hostname
      ? entryUrl.hostname === hostUrl.hostname
      : entryUrl.host === hostUrl.host
  })
}

/**
 * Whether the browser request comes from the DSH host itself.
 * @param headers - the incoming request headers.
 * @param trustedHosts - the runtime's bind-derived trusted host list.
 * @returns whether the request may reach the plugin's route.
 */
export function isTrustedApiRequest(headers: IncomingHttpHeaders, trustedHosts: readonly string[]): boolean {
  const host = header(headers, 'host')
  if (host === undefined) return false
  const hostUrl = parseAuthority(host)
  if (hostUrl === undefined) return false
  if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts)) return false
  if (header(headers, 'sec-fetch-site') === 'cross-site') return false
  const origin = header(headers, 'origin')
  if (origin === undefined) return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}
