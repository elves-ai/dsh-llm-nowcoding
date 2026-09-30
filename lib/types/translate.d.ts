/**
 * Translate the NowCoding gateway's Chat Completions chunk stream into the
 * harness stream protocol.
 *
 * Everything here is a protocol obligation, not a preference:
 *
 * - Every block opens with `block-start` at the index it is first seen under,
 *   and every later delta of that block reuses the index, so interleaved text
 *   and tool calls stay aligned.
 * - Tool `arguments` are the raw JSON fragments the channel produced; they are
 *   concatenated and closed verbatim, never parsed and re-stringified.
 * - `usage` is emitted before the terminal `finish`, and nothing follows the
 *   finish. The gateway appends a usage-only entry after the one carrying
 *   `finish_reason`, so the finish reason is held until the events end and both
 *   are flushed after every open block has been closed.
 *
 * @module @elves-ai/dsh-llm-nowcoding/translate
 */
import type { FinishReason, StreamChunk, TokenUsage } from '@deepseek-ai/dsh-llm';
/** Terminal outcome of one fully iterated stream. */
export interface ChatTranslation {
    /** Usage the channel reported; absent when it reported none, so no `usage` chunk is emitted. */
    readonly usage?: TokenUsage;
    /** Why the channel stopped; derived from the last `finish_reason` it sent. */
    readonly reason: FinishReason;
}
/**
 * Incremental translator for one Chat Completions response.
 *
 * One instance owns one response: it holds the block index allocation, the
 * finish/usage buffer, and the terminal outcome. A caller that stops early
 * calls {@link return}, which abandons the response without closing blocks —
 * `block-end` exists to hand the assembler a complete block, and an
 * interrupted stream is assembled from its deltas instead.
 */
export declare class ChatStreamTranslator {
    private readonly blocks;
    private readonly toolBlocks;
    /**
     * Chunks produced by the event being applied but not yet handed to the
     * consumer. One event yields two chunks when it opens a block (`block-start`
     * plus that block's first delta), so the queue drains before the next event
     * is read.
     */
    private readonly queue;
    private readonly source;
    private usage;
    private wireFinish;
    /** Buffered terminal chunks, drained one per call once the events end. */
    private terminal;
    private finished;
    /**
     * @param events - SSE payload texts in arrival order, as framed by `parseSse`.
     */
    constructor(events: AsyncIterable<string>);
    /**
     * Pull the next protocol chunk.
     * @returns the next chunk, or `done` once usage and finish have been flushed.
     * @throws {LlmError} code `MALFORMED_RESPONSE` for an undecodable payload, `EMPTY_RESPONSE`
     *   when the channel stopped without producing content or a tool invocation, and
     *   `STREAM_CLOSED` when the response body ended before the channel finished.
     */
    next(): Promise<IteratorResult<StreamChunk>>;
    /**
     * Abandon the response.
     * @returns an already-completed iterator result.
     */
    return(): Promise<IteratorResult<StreamChunk>>;
    /**
     * The outcome of one fully iterated stream.
     * @returns the reported usage (when the channel sent any) and the finish reason.
     */
    get translation(): ChatTranslation;
    /** The terminal finish reason; a stream that named none is reported from its content. */
    private reason;
    /** Decode one payload and apply it, queueing every chunk it produces. */
    private consume;
    /** Record what one well-formed payload reports, then apply its delta. */
    private accept;
    /** Apply one delta, queueing `block-start` ahead of the block's first delta. */
    private applyDelta;
    /** Queue the opening `block-start` exactly once, ahead of the block's first delta. */
    private announce;
    /** The single text or reasoning block this route streams, allocated on first use. */
    private ensure;
    /** The block for one tool invocation position, allocated on first sight. */
    private toolBlock;
    /** Allocate one open block at the next index in first-seen order. */
    private allocate;
    /** Every allocated block, in the order its index was assigned. */
    private get seen();
    /** Close every open block, in first-seen order. */
    private closeBlocks;
    /** The complete block one accumulation produced. */
    private assembled;
    /** Build the terminal chunk sequence: block ends, then usage, then finish. */
    private prepareTerminal;
}
