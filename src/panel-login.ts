/**
 * Console sign-in for the NowCoding dashboard.
 *
 * The console chain that reports a monthly plan authenticates with a dashboard
 * credential plus the numeric user id, and the console issues both only after
 * a username/password login. This module performs that login and returns the
 * pair: the session cookie the login answer carries is the credential, and the
 * dashboard access token is read back beside it when the account holds one.
 * The password is an argument of one request: it is never stored, logged, or
 * echoed back, and the cookie leaves only as a settings write the caller makes.
 *
 * Three gateway behaviours decide the flow:
 *
 * - The session cookie is the credential the console's own browser uses — the
 *   console routes accept `Cookie: session=…` beside `New-Api-User` — so a
 *   sign-in succeeds once the cookie is in hand, whether or not the account
 *   carries an access token.
 * - The token is read back over the session cookie rather than taken from the
 *   login answer, because the answer's own document does not reliably carry
 *   it. Only routes that report a token are called: the one route that issues
 *   a token also rotates an existing one, which would silently break every
 *   other tool configured with the account's token, so it is never reached.
 * - A deployment can switch Turnstile on, which a non-browser client cannot
 *   solve. That state is reported as its own failure code rather than as a
 *   wrong password, because the user's fix is different.
 *
 * @module @elves-ai/dsh-llm-nowcoding/panel-login
 */

import { attributionHeaders } from '@deepseek-ai/dsh-llm'
import {
  NOWCODING_AGREEMENT_ACCEPT_PATH,
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
  /** Signed in, but the console answered neither a session cookie nor a token. */
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

/** The console credential pair a completed sign-in yields. */
export interface NowCodingPanelCredential {
  /**
   * Session cookie the console issued, as the `Cookie` header to replay
   * (`session=…`, joined with any other pair the answer set). The console
   * chain accepts it in place of an access token.
   */
  sessionCookie: string
  /**
   * Dashboard access token, sent as `Authorization: Bearer` on the console
   * chain. Absent when no route reported one; the session cookie carries the
   * chain either way.
   */
  accessToken?: string
  /** Numeric account id, sent as `New-Api-User`. */
  userId: string
  /** Account name the console reported, for the page's confirmation copy. */
  username: string
  /** Where the token came from: the login answer's own document, or a read-back. Absent when no token was obtained. */
  tokenSource?: 'login' | 'read'
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
   * Both routes here only report a token. The one route that issues one also
   * rotates an existing value and is never called: the session cookie already
   * carries the console chain, so a missing token costs nothing.
   *
   * @param cookie - session cookie from the login answer.
   * @returns the token, or undefined when no route reported one.
   */
  async function readAccessToken(cookie: string): Promise<string | undefined> {
    const attempts: readonly { path: string; token: (answer: ConsoleAnswer) => string | undefined }[] = [
      { path: NOWCODING_SELF_ACCESS_TOKEN_PATH, token: answer => textOf(answer.body['data']) },
      { path: NOWCODING_SELF_PATH, token: answer => textOf(recordMember(answer.body, 'data')?.['access_token']) },
    ]
    for (const attempt of attempts) {
      try {
        const answer = await send('GET', attempt.path, undefined, cookie, 'token-unavailable')
        if (answer.body['success'] !== true) {
          // A refusal is a normal step of the chain: the console answers HTTP
          // 200 with success:false for a route this account may not use.
          continue
        }
        const token = attempt.token(answer)
        if (token !== undefined) return token
      } catch {
        // A read failure must not fail a sign-in that already holds the cookie.
      }
    }
    return undefined
  }

  /**
   * Confirm the site agreement the way the console's own web app does, right
   * after a successful login. Best-effort: this client cannot display the
   * agreement, and a refusal here never fails a sign-in that holds the cookie.
   *
   * @param cookie - session cookie from the login answer.
   */
  async function acceptAgreement(cookie: string): Promise<void> {
    try {
      await send('POST', NOWCODING_AGREEMENT_ACCEPT_PATH, undefined, cookie, 'bad-credentials')
    } catch {
      // Ignored on purpose: the sign-in itself has already succeeded.
    }
  }

  /**
   * Turn a signed-in account document into the console credential pair.
   *
   * @param data - the console's `data` document for the account.
   * @param cookie - session cookie from the same answer.
   * @param username - account name to report alongside the credential.
   * @returns the session cookie, the account id, and the token when one was readable.
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
    if (inline !== undefined) return { sessionCookie: cookie, accessToken: inline, userId, username, tokenSource: 'login' }
    const token = cookie.length > 0 ? await readAccessToken(cookie) : undefined
    if (token !== undefined) {
      return { sessionCookie: cookie, accessToken: token, userId, username, tokenSource: 'read' }
    }
    if (cookie.length === 0) {
      throw new NowCodingLoginError(
        'token-unavailable',
        `signed in as ${username}, but the console answered neither a session cookie nor an access token`,
      )
    }
    return { sessionCookie: cookie, userId, username }
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
      await acceptAgreement(answer.cookie)
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
      const cookie = answer.cookie.length > 0 ? answer.cookie : state.cookie
      await acceptAgreement(cookie)
      const credential = await credentialOf(data, cookie, state.username)
      pending = undefined
      return { status: 'ok', credential }
    },
  }
}
