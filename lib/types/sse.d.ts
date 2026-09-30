/**
 * Server-sent-event framing for the gateway's `text/event-stream` response.
 *
 * Hand-written because the framing this route needs is small and fixed: read
 * `data:` lines, stop at `[DONE]`, ignore comments and other fields, and keep
 * an unterminated tail buffered across chunk boundaries. Payload decoding is
 * deliberately not done here — `translate.ts` owns what a payload means, so a
 * malformed payload is reported as a provider protocol failure rather than as
 * a framing failure.
 *
 * @module @elves-ai/dsh-llm-nowcoding/sse
 */
/**
 * Upper bound on one buffered frame. The bound exists because an adversarial or
 * broken endpoint could otherwise close the stream only after the harness has
 * buffered unbounded text; a well-formed chunk is far below it.
 */
export declare const NOWCODING_MAX_SSE_FRAME_BYTES: number;
/**
 * Frame one response body into SSE data payloads.
 *
 * The generator ends at `[DONE]` or at end of body, whichever comes first; a
 * tail without a terminator is discarded, so a connection cut mid-frame cannot
 * be mistaken for a complete event. Frames carrying no `data:` field (comments,
 * heartbeats, bare field lines) are skipped rather than surfaced.
 *
 * @param body - the response body, read as UTF-8.
 * @returns each frame's payload text, in arrival order.
 * @throws {LlmError} code `MALFORMED_RESPONSE` when one frame exceeds {@link NOWCODING_MAX_SSE_FRAME_BYTES}.
 */
export declare function parseSse(body: ReadableStream<Uint8Array>): AsyncGenerator<string>;
