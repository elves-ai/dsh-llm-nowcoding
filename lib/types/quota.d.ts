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
/** Stable failure classification for one quota read. */
export type NowCodingQuotaErrorCode = 
/** The gateway could not be reached at all. */
'unreachable'
/** The gateway rejected the credential. */
 | 'unauthorized'
/** The gateway answered with a non-success status. */
 | 'gateway-error'
/** The gateway answered with a body this reader cannot read. */
 | 'unprocessable'
/** The call exceeded its timeout. */
 | 'timeout';
/** One failed quota read, carrying the classification callers branch on. */
export declare class NowCodingQuotaError extends Error {
    readonly code: NowCodingQuotaErrorCode;
    constructor(code: NowCodingQuotaErrorCode, message: string);
}
/** Which balance a snapshot describes. */
export type NowCodingQuotaSource = 
/** A monthly plan's allowance, read from the console API. */
'subscription'
/** The pay-as-you-go wallet, read from the relay billing pair. */
 | 'billing';
/** One successfully read balance, in the gateway's display units. */
export interface NowCodingQuotaSnapshot {
    /** Which document this balance came from. */
    source: NowCodingQuotaSource;
    /** Granted allowance for the current period, in display units. */
    total: number;
    /** Consumed allowance for the current period, in display units. */
    used: number;
    /** `total - used`, floored at zero. */
    remaining: number;
    /** Whether the credential is unmetered, in which case the amounts are the gateway's sentinel. */
    unlimited: boolean;
    /** Epoch milliseconds when the grant lapses; 0 means it does not. */
    accessUntil: number;
    /** Epoch milliseconds of the next scheduled reset; 0 when the source schedules none. */
    resetAt: number;
    /** Epoch milliseconds when this snapshot was read. */
    fetchedAt: number;
    /** Plan title, when the snapshot came from a subscription. */
    planTitle?: string;
    /** Reset cadence as the gateway names it (`daily`, …); absent for the wallet source. */
    resetPeriod?: string;
    /** Raw units per displayed unit, so a wrong divisor is visible rather than silent. */
    quotaPerUnit: number;
}
/** Injection seam for tests and for deployments that bring their own transport. */
export interface NowCodingQuotaReaderOptions {
    /** Endpoint base, including the `/v1` segment. */
    baseURL: string;
    /** NowCoding model key sent as `Authorization: Bearer` on the relay chain. */
    apiKey: string;
    /** Dashboard access token; when present the reader prefers the subscription document. */
    panelToken?: string;
    /** Dashboard user id sent as `New-Api-User`; required by the console chain. */
    panelUserId?: string;
    /** Transport override; defaults to the global `fetch`. */
    fetchImpl?: typeof fetch;
    /** Per-attempt timeout in milliseconds. */
    timeoutMs?: number;
    /** Clock override for tests. */
    now?: () => number;
}
/** Reads the gateway balance for one credential. */
export interface NowCodingQuotaReader {
    /**
     * Read the current balance.
     * @param signal - caller cancellation; the read settles promptly after it aborts.
     * @returns the balance the gateway reports for these credentials.
     */
    read(signal?: AbortSignal): Promise<NowCodingQuotaSnapshot>;
}
/** Default per-attempt timeout for one quota read. */
export declare const NOWCODING_DEFAULT_QUOTA_TIMEOUT_MS = 15000;
/**
 * Read the divisor every displayed amount uses.
 *
 * @param status - the `/api/status` body.
 * @returns the gateway's `quota_per_unit`, or the documented fallback.
 */
export declare function quotaUnitOf(status: unknown): number;
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
export declare function normalizeSubscription(payload: unknown, quotaPerUnit: number, fetchedAt: number): NowCodingQuotaSnapshot | undefined;
/**
 * Project the relay billing documents into one balance.
 *
 * @param subscription - the `/dashboard/billing/subscription` body.
 * @param usage - the `/dashboard/billing/usage` body.
 * @param fetchedAt - epoch milliseconds to stamp on the snapshot.
 * @returns the balance, or undefined when the documents carry no total.
 */
export declare function normalizeQuota(subscription: unknown, usage: unknown, fetchedAt: number): NowCodingQuotaSnapshot | undefined;
/**
 * Build a quota reader for one set of credentials.
 * @param options - endpoint, credentials, and optional transport/clock seams.
 * @returns a reader that performs the requests its credentials allow.
 */
export declare function createQuotaReader(options: NowCodingQuotaReaderOptions): NowCodingQuotaReader;
