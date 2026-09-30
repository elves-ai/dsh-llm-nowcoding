/**
 * Live model-list reader for the NowCoding gateway.
 *
 * `GET {base}/v1/models` is key-scoped: it answers with exactly the models the
 * configured key's groups may call, which makes it the truthful source for the
 * detail page's model allowlist — every id it returns is one the key can
 * actually serve. The gateway is a modified new-api deployment answering the
 * OpenAI list shape, and its catalog moves under it, so the normalization
 * below reads the body defensively rather than trusting it.
 *
 * This is a provider request: it carries `attributionHeaders()` like the chat
 * path, and it classifies failures with the same vocabulary the quota reader
 * uses so the fenced route maps both identically.
 *
 * @module @elves-ai/dsh-llm-nowcoding/live-models
 */
/** Stable failure classification for one model-list read. */
export type NowCodingModelsErrorCode = 
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
/** One failed model-list read, carrying the classification callers branch on. */
export declare class NowCodingModelsError extends Error {
    readonly code: NowCodingModelsErrorCode;
    constructor(code: NowCodingModelsErrorCode, message: string);
}
/** One model the gateway reports for the configured key. */
export interface NowCodingRemoteModel {
    /** The wire model id, verbatim. */
    id: string;
    /** Gateway-side owner tag, present when the listing carries one. */
    ownedBy?: string;
}
/** Injection seam for tests and for deployments that bring their own transport. */
export interface NowCodingLiveModelListOptions {
    /** Endpoint base, including the `/v1` segment. */
    baseURL: string;
    /** NowCoding model key sent as `Authorization: Bearer`. */
    apiKey: string;
    /** Transport override; defaults to the global `fetch`. */
    fetchImpl?: typeof fetch;
    /** Per-attempt timeout in milliseconds. */
    timeoutMs?: number;
}
/** Reads the gateway's key-scoped model listing. */
export interface NowCodingLiveModelLister {
    /**
     * Read the listing.
     * @param signal - caller cancellation; the read settles promptly after it aborts.
     * @returns one entry per distinct model id, in the order the gateway reported.
     */
    list(signal?: AbortSignal): Promise<readonly NowCodingRemoteModel[]>;
}
/** Default per-attempt timeout for one model-list read. */
export declare const NOWCODING_DEFAULT_MODELS_TIMEOUT_MS = 15000;
/**
 * Project the listing body into model entries.
 *
 * Exported for tests and for callers that already hold the document: the
 * normalization carries the wire semantics, the request does not. The OpenAI
 * shape is `{ data: [...] }`; a bare array is tolerated because the gateway is
 * locally modified. Malformed entries are dropped, not fatal, and ids are
 * deduplicated in first-seen order.
 *
 * @param payload - the `/v1/models` body.
 * @returns one entry per distinct usable id.
 */
export declare function normalizeModelList(payload: unknown): readonly NowCodingRemoteModel[];
/**
 * Build a live model-list reader for one credential.
 * @param options - endpoint, credential, and optional transport seam.
 * @returns a reader that performs the one listing request.
 */
export declare function createLiveModelLister(options: NowCodingLiveModelListOptions): NowCodingLiveModelLister;
