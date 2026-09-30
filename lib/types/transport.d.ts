/**
 * HTTP transport for the NowCoding Chat Completions route: one request, one
 * timeout, one cancellation, and one classification of every way it can fail.
 *
 * Failures are mapped to stable codes the harness routes on:
 *
 * | condition | code |
 * | --- | --- |
 * | HTTP 401 or 403 | `UNAUTHORIZED` |
 * | HTTP 402, or an error payload naming an exhausted balance | `QUOTA` |
 * | HTTP 429 | `RATE_LIMIT` |
 * | any other non-success status | `PROVIDER_ERROR` |
 * | success without a readable body | `EMPTY_RESPONSE` |
 * | the request never completed (DNS, TLS, reset) | `TRANSPORT` |
 * | the request or stream exceeded `timeoutMs` | `TIMEOUT` |
 * | the caller aborted | `ABORTED` |
 *
 * @module @elves-ai/dsh-llm-nowcoding/transport
 */
import { LlmError } from '@deepseek-ai/dsh-llm';
import type { WireRequest } from './wire.ts';
/** One authenticated POST to the chat endpoint. */
export interface ChatRequestInput {
    /** Endpoint base, including the `/v1` segment. */
    baseURL: string;
    /** Credential sent as `Authorization: Bearer`. */
    apiKey: string;
    /** Serialized request body. */
    body: WireRequest;
    /** Caller cancellation; the request and the response stream both honor it. */
    signal?: AbortSignal;
    /** Wall-clock bound covering the request and the whole streamed response. */
    timeoutMs: number;
    /** Transport override for tests and for deployments that bring their own. */
    fetchImpl?: typeof fetch;
}
/** One live provider response. */
export interface ChatResponse {
    /** The response body, framed as SSE by `parseSse`. */
    body: ReadableStream<Uint8Array>;
    /**
     * The caller's signal joined with the abort that ends this response.
     * Aborting it after a partial read releases the connection and any timer.
     */
    signal: AbortSignal;
    /** Abort this response and release its timer. */
    dispose: () => void;
}
/**
 * Classify one non-success response.
 * @param raw - the decoded response body, or undefined when it was not JSON.
 * @param status - the HTTP status.
 * @param headers - the response headers.
 * @returns the failure to throw, carrying status, retry delay, and request id when known.
 */
export declare function providerError(raw: unknown, status: number, headers: Headers): LlmError;
/**
 * Send one authenticated chat request and classify every failure it can produce.
 * @param input - endpoint, credential, body, cancellation, timeout, and transport override.
 * @returns the response body plus the signal and disposer that own its lifetime.
 * @throws {LlmError} `UNAUTHORIZED`, `QUOTA`, `RATE_LIMIT`, or `PROVIDER_ERROR` for a
 *   non-success response; `EMPTY_RESPONSE` for a success without a body; `TRANSPORT`,
 *   `TIMEOUT`, or `ABORTED` when the request never produced one.
 */
export declare function postChatCompletion(input: ChatRequestInput): Promise<ChatResponse>;
