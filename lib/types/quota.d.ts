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
/** One successfully read balance. */
export interface NowCodingQuotaSnapshot {
    /** Granted total in the gateway's display currency. */
    total: number;
    /** Consumed amount in the gateway's display currency. */
    used: number;
    /** `total - used`, floored at zero. */
    remaining: number;
    /** Whether the key is unmetered, in which case the three amounts above are the gateway's sentinel. */
    unlimited: boolean;
    /** Epoch milliseconds when the grant lapses; 0 means it does not. */
    accessUntil: number;
    /** Epoch milliseconds when this snapshot was read. */
    fetchedAt: number;
}
/** Injection seam for tests and for deployments that bring their own transport. */
export interface NowCodingQuotaReaderOptions {
    /** Endpoint base, including the `/v1` segment. */
    baseURL: string;
    /** NowCoding API key sent as `Authorization: Bearer`. */
    apiKey: string;
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
     * @returns the balance the gateway reports for this key.
     */
    read(signal?: AbortSignal): Promise<NowCodingQuotaSnapshot>;
}
/** Default per-attempt timeout for one quota read. */
export declare const NOWCODING_DEFAULT_QUOTA_TIMEOUT_MS = 15000;
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
export declare function normalizeQuota(subscription: unknown, usage: unknown, fetchedAt: number): NowCodingQuotaSnapshot | undefined;
/**
 * Build a quota reader for one endpoint and credential.
 * @param options - endpoint, credential, and optional transport/clock seams.
 * @returns a reader that performs one billing round trip per call.
 */
export declare function createQuotaReader(options: NowCodingQuotaReaderOptions): NowCodingQuotaReader;
