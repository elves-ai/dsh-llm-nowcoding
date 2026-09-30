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
/** Failure codes a caller branches on. */
export type NowCodingLoginFailure = 
/** The console refused the username/password pair, or refused the session. */
'bad-credentials'
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
 | 'unprocessable';
/** A sign-in failure carrying the code its caller branches on. */
export declare class NowCodingLoginError extends Error {
    readonly code: NowCodingLoginFailure;
    constructor(code: NowCodingLoginFailure, message: string);
}
/** The dashboard credential pair a completed sign-in yields. */
export interface NowCodingPanelCredential {
    /** Dashboard access token, sent as `Authorization: Bearer` on the console chain. */
    accessToken: string;
    /** Numeric account id, sent as `New-Api-User`. */
    userId: string;
    /** Account name the console reported, for the page's confirmation copy. */
    username: string;
    /**
     * Where the token came from. `read` reports a pre-existing token and
     * `generated` a newly issued one, which rotates any token the account had.
     */
    tokenSource: 'login' | 'read' | 'generated';
}
/** Answer of one sign-in step. */
export type NowCodingLoginResult = {
    status: 'ok';
    credential: NowCodingPanelCredential;
} | {
    status: 'two-factor-required';
};
/** Construction options for {@link createPanelLogin}. */
export interface NowCodingLoginOptions {
    /**
     * Endpoint base thunk, read on every request so a settings edit reaches the
     * next attempt rather than the next plugin load.
     */
    baseURL: () => string;
    /** Transport override; defaults to the global `fetch`. */
    fetchImpl?: typeof fetch;
    /** Per-request timeout in milliseconds. */
    timeoutMs?: number;
    /** Clock override for tests. */
    now?: () => number;
    /** How long an unanswered two-factor challenge stays usable. */
    twoFactorTtlMs?: number;
}
/** Default timeout for one console sign-in request. */
export declare const NOWCODING_DEFAULT_LOGIN_TIMEOUT_MS = 15000;
/** How long a two-factor challenge stays open before the session is dropped. */
export declare const NOWCODING_DEFAULT_TWO_FACTOR_TTL_MS = 300000;
/** Performs the console sign-in and holds the one challenge it may leave open. */
export interface NowCodingPanelLogin {
    /**
     * Sign in with the account's console credentials.
     * @param username - console username.
     * @param password - console password, used for this request and kept nowhere.
     * @returns the credential pair, or a request for the second factor.
     */
    login(username: string, password: string): Promise<NowCodingLoginResult>;
    /**
     * Answer the challenge the last {@link NowCodingPanelLogin.login} opened.
     * @param code - authenticator code, or one of the account's backup codes.
     * @returns the credential pair.
     */
    verifyTwoFactor(code: string): Promise<NowCodingLoginResult>;
}
/**
 * Build the console sign-in client.
 *
 * @param options - endpoint, transport, clock, and challenge-lifetime seams.
 * @returns a sign-in client that keeps at most one open challenge.
 */
export declare function createPanelLogin(options: NowCodingLoginOptions): NowCodingPanelLogin;
