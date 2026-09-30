/**
 * Console sign-in for the NowCoding dashboard.
 *
 * The console chain that reports a monthly plan authenticates with a dashboard
 * access token plus the numeric user id, and the console issues both only after
 * a username/password login. This module performs that login and returns the
 * pair. The password is an argument of one request: it is never stored, logged,
 * or echoed back, and the session cookie the console answers with lives in this
 * instance only until the credential comes out.
 *
 * Two gateway behaviours decide the flow:
 *
 * - The token is read back over the session cookie rather than taken from the
 *   login answer, because the answer's own document does not reliably carry it.
 *   The one route that issues a token also rotates an existing one, so it is the
 *   last resort and only runs when the account holds no token to lose.
 * - A deployment can switch Turnstile on, which a non-browser client cannot
 *   solve. That state is reported as its own failure code rather than as a
 *   wrong password, because the user's fix is different.
 *
 * @module @elves-ai/dsh-llm-nowcoding/panel-login
 */

import { attributionHeaders } from '@deepseek-ai/dsh-llm'
import {
  NOWCODING_ACCESS_TOKEN_PATH,
  NOWCODING_LOGIN_PATH,
  NOWCODING_SELF_ACCESS_TOKEN_PATH,
  NOWCODING_SELF_PATH,
  NOWCODING_TWO_FACTOR_LOGIN_PATH,
} from './settings-shared.ts'

/** Failure codes a caller branches on. */
export type NowCodingLoginFailure =
  /** The console refused the username/password pair, or refused the session. */
  | 'bad-credentials'
  /** The verification code was refused; the challenge is still open. */
  | 'two-factor-invalid'
  /** No challenge is open, or it outlived its window; sign in again. */
  | 'two-factor-unavailable'
  /** The deployment checks Turnstile, which only a browser can answer. */
  | 'turnstile-required'
  /** Signed in, but no dashboard token could be read for the account. */
  | 'token-unavailable'
  /** The console could not be reached. */
  | 'unreachable'
  /** A console request exceeded its timeout. */
  | 'timeout'
  /** The console answered a status outside 2xx. */
  | 'gateway-error'
  /** The console answered a body this client cannot read. */
  | 'unprocessable'

/** A sign-in failure carrying the code its caller branches on. */
export class NowCodingLoginError extends Error {
  constructor(
    readonly code: NowCodingLoginFailure,
    message: string,
  ) {
    super(message)
    this.name = 'NowCodingLoginError'
  }
}

/** The dashboard credential pair a completed sign-in yields. */
export interface NowCodingPanelCredential {
  /** Dashboard access token, sent as `Authorization: Bearer` on the console chain. */
  accessToken: string
  /** Numeric account id, sent as `New-Api-User`. */
  userId: string
  /** Account name the console reported, for the page's confirmation copy. */
  username: string
  /**
   * Where the token came from. `read` reports a pre-existing token and
   * `generated` a newly issued one, which rotates any token the account had.
   */
  tokenSource: 'login' | 'read' | 'generated'
}

/** Answer of one sign-in step. */
export type NowCodingLoginResult =
  | { status: 'ok'; credential: NowCodingPanelCredential }
  | { status: 'two-factor-required' }

/** Construction options for {@link createPanelLogin}. */
export interface NowCodingLoginOptions {
  /**
   * Endpoint base thunk, read on every request so a settings edit reaches the
   * next attempt rather than the next plugin load.
   */
  baseURL: () => string
  /** Transport override; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch
  /** Per-request timeout in milliseconds. */
  timeoutMs?: number
  /** Clock override for tests. */
  now?: () => number
  /** How long an unanswered two-factor challenge stays usable. */
  twoFactorTtlMs?: number
}

/** Default timeout for one console sign-in request. */
export const NOWCODING_DEFAULT_LOGIN_TIMEOUT_MS = 15_000

/** How long a two-factor challenge stays open before the session is dropped. */
export const NOWCODING_DEFAULT_TWO_FACTOR_TTL_MS = 300_000

/** Performs the console sign-in and holds the one challenge it may leave open. */
export interface NowCodingPanelLogin {
  /**
   * Sign in with the account's console credentials.
   * @param username - console username.
   * @param password - console password, used for this request and kept nowhere.
   * @returns the credential pair, or a request for the second factor.
   */
  login(username: string, password: string): Promise<NowCodingLoginResult>
  /**
   * Answer the challenge the last {@link NowCodingPanelLogin.login} opened.
   * @param code - authenticator code, or one of the account's backup codes.
   * @returns the credential pair.
   */
  verifyTwoFactor(code: string): Promise<NowCodingLoginResult>
}

/** One console answer: its JSON object and the session cookie it set. */
interface ConsoleAnswer {
  body: Record<string, unknown>
  cookie: string
}

/** True for a JSON object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** A non-empty string member, or undefined. */
function textOf(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** An object member, or undefined. */
function recordMember(source: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const value = source[key]
  return isRecord(value) ? value : undefined
}

/** A message member, or undefined. */
function messageOf(source: Record<string, unknown>): string | undefined {
  return textOf(source['message'])
}

/** The account id as a string, for the header the console chain requires. */
function identifierOf(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return textOf(value)
}

/** The `Cookie` header carrying the session a response set, or an empty string. */
function cookieHeader(response: Response): string {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  const many = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : []
  const single = response.headers.get('set-cookie')
  const raw = many.length > 0 ? many : single === null ? [] : [single]
  return raw
    .map(entry => entry.split(';')[0]?.trim() ?? '')
    .filter(pair => pair.length > 0)
    .join('; ')
}

/**
 * Build the console sign-in client.
 *
 * @param options - endpoint, transport, clock, and challenge-lifetime seams.
 * @returns a sign-in client that keeps at most one open challenge.
 */
export function createPanelLogin(options: NowCodingLoginOptions): NowCodingPanelLogin {
  const timeoutMs = options.timeoutMs ?? NOWCODING_DEFAULT_LOGIN_TIMEOUT_MS
  const now = options.now ?? (() => Date.now())
  const ttl = options.twoFactorTtlMs ?? NOWCODING_DEFAULT_TWO_FACTOR_TTL_MS
  let pending: { cookie: string; username: string; expiresAt: number } | undefined

  /**
   * Send one console request.
   *
   * @param method - HTTP method the route expects.
   * @param path - origin-relative console path.
   * @param payload - JSON body, or undefined for a GET.
   * @param cookie - session cookie to present, when the route needs one.
   * @param unauthorized - code to report when the console refuses the session.
   * @returns the answered body and the session cookie it set.
   */
  async function send(
    method: 'GET' | 'POST',
    path: string,
    payload: unknown,
    cookie: string | undefined,
    unauthorized: NowCodingLoginFailure,
  ): Promise<ConsoleAnswer> {
    const fetchImpl = options.fetchImpl ?? globalThis.fetch
    const url = new URL(options.baseURL()).origin + path
    const timer = new AbortController()
    const timeout = setTimeout(() => { timer.abort(new Error(`${url} timed out`)) }, timeoutMs)
    let response: Response
    try {
      response = await fetchImpl(url, {
        method,
        headers: {
          accept: 'application/json',
          ...attributionHeaders(),
          ...cookie === undefined || cookie.length === 0 ? {} : { cookie },
          ...payload === undefined ? {} : { 'content-type': 'application/json' },
        },
        ...payload === undefined ? {} : { body: JSON.stringify(payload) },
        signal: timer.signal,
      })
    } catch (error) {
      if (timer.signal.aborted) {
        throw new NowCodingLoginError('timeout', `the console request to ${url} exceeded ${timeoutMs}ms`)
      }
      throw new NowCodingLoginError(
        'unreachable',
        `the console request to ${url} failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    } finally {
      clearTimeout(timeout)
    }
    if (response.status === 401 || response.status === 403) {
      throw new NowCodingLoginError(unauthorized, `the console refused the session (HTTP ${response.status})`)
    }
    if (!response.ok) {
      throw new NowCodingLoginError('gateway-error', `the console request to ${url} answered HTTP ${response.status}`)
    }
    let body: unknown
    try {
      body = await response.json() as unknown
    } catch (error) {
      throw new NowCodingLoginError(
        'unprocessable',
        `the console request to ${url} did not answer JSON: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    if (!isRecord(body)) {
      throw new NowCodingLoginError('unprocessable', `the console request to ${url} answered a body that is not a JSON object`)
    }
    return { body, cookie: cookieHeader(response) }
  }

  /**
   * Read the account's token with the session the login just issued.
   *
   * The order is deliberate: two routes only report a token, while the third
   * issues one and rotates an existing value, so it runs last and only for an
   * account that holds nothing to rotate.
   *
   * @param cookie - session cookie from the login answer.
   * @param username - account name, for the failure message.
   * @returns the token and how it was obtained.
   */
  async function readAccessToken(cookie: string, username: string): Promise<{ token: string; source: 'read' | 'generated' }> {
    const attempts: readonly { path: string; source: 'read' | 'generated'; token: (answer: ConsoleAnswer) => string | undefined }[] = [
      { path: NOWCODING_SELF_ACCESS_TOKEN_PATH, source: 'read', token: answer => textOf(answer.body['data']) },
      { path: NOWCODING_SELF_PATH, source: 'read', token: answer => textOf(recordMember(answer.body, 'data')?.['access_token']) },
      { path: NOWCODING_ACCESS_TOKEN_PATH, source: 'generated', token: answer => textOf(answer.body['data']) },
    ]
    let failure: string | undefined
    for (const attempt of attempts) {
      try {
        const answer = await send('GET', attempt.path, undefined, cookie, 'token-unavailable')
        if (answer.body['success'] !== true) {
          // A refusal is a normal step of the chain: the console answers HTTP
          // 200 with success:false for a route this account may not use.
          failure = messageOf(answer.body) ?? `${attempt.path} refused the session`
          continue
        }
        const token = attempt.token(answer)
        if (token !== undefined) return { token, source: attempt.source }
      } catch (error) {
        failure = error instanceof Error ? error.message : String(error)
      }
    }
    throw new NowCodingLoginError(
      'token-unavailable',
      `signed in as ${username}, but no dashboard access token could be read (${failure ?? 'no credential route answered'})`,
    )
  }

  /**
   * Turn a signed-in account document into the credential pair.
   *
   * @param data - the console's `data` document for the account.
   * @param cookie - session cookie from the same answer.
   * @param username - account name to report alongside the credential.
   * @returns the access token and the account id.
   */
  async function credentialOf(
    data: Record<string, unknown>,
    cookie: string,
    username: string,
  ): Promise<NowCodingPanelCredential> {
    const userId = identifierOf(data['id'])
    if (userId === undefined) {
      throw new NowCodingLoginError(
        'unprocessable',
        'the sign-in answer carries no account id, which the console chain needs as New-Api-User',
      )
    }
    const inline = textOf(data['access_token'])
    if (inline !== undefined) return { accessToken: inline, userId, username, tokenSource: 'login' }
    const read = await readAccessToken(cookie, username)
    return { accessToken: read.token, userId, username, tokenSource: read.source }
  }

  return {
    async login(username: string, password: string): Promise<NowCodingLoginResult> {
      const name = username.trim()
      const answer = await send('POST', NOWCODING_LOGIN_PATH, { username: name, password }, undefined, 'bad-credentials')
      const data = recordMember(answer.body, 'data')
      if (answer.body['success'] !== true) {
        const message = messageOf(answer.body) ?? 'the console refused the sign-in'
        // Turnstile is a deployment switch, not a credential problem: the same
        // password succeeds in a browser that can answer the challenge.
        if (/turnstile/i.test(message)) throw new NowCodingLoginError('turnstile-required', message)
        throw new NowCodingLoginError('bad-credentials', message)
      }
      if (data === undefined) {
        throw new NowCodingLoginError('unprocessable', 'the sign-in answer carries no account document')
      }
      if (data['require_2fa'] === true) {
        pending = { cookie: answer.cookie, username: name, expiresAt: now() + ttl }
        return { status: 'two-factor-required' }
      }
      return { status: 'ok', credential: await credentialOf(data, answer.cookie, name) }
    },

    async verifyTwoFactor(code: string): Promise<NowCodingLoginResult> {
      const state = pending
      if (state === undefined || state.expiresAt <= now()) {
        pending = undefined
        throw new NowCodingLoginError(
          'two-factor-unavailable',
          'no sign-in is waiting for a verification code; sign in again',
        )
      }
      const answer = await send(
        'POST',
        NOWCODING_TWO_FACTOR_LOGIN_PATH,
        { code: code.trim() },
        state.cookie,
        'two-factor-unavailable',
      )
      const data = recordMember(answer.body, 'data')
      if (answer.body['success'] !== true) {
        throw new NowCodingLoginError(
          'two-factor-invalid',
          messageOf(answer.body) ?? 'the console refused the verification code',
        )
      }
      if (data === undefined) {
        throw new NowCodingLoginError('unprocessable', 'the verification answer carries no account document')
      }
      const credential = await credentialOf(
        data,
        answer.cookie.length > 0 ? answer.cookie : state.cookie,
        state.username,
      )
      pending = undefined
      return { status: 'ok', credential }
    },
  }
}
