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

import { EMPTY_RESPONSE_CODE, LlmError, ToolCallId } from '@deepseek-ai/dsh-llm'
import type { ContentBlock, FinishReason, StreamChunk, TokenUsage } from '@deepseek-ai/dsh-llm'
import { deltaText, isArray, isRecord, usageCount } from './wire.ts'
import type { WireChoice, WireDelta, WireToolCallDelta } from './wire.ts'

/** Block types this route can produce. */
type OpenBlockType = 'text' | 'reasoning' | 'tool-call'

/** One block being accumulated at the index it was first seen under. */
interface OpenBlock {
  /** Harness block index, unique within the stream. */
  index: number
  type: OpenBlockType
  /** Accumulated text for `text` and `reasoning` blocks; empty for tool calls. */
  text: string
  toolCallId: string
  toolCallName: string
  /** Raw JSON fragments, concatenated in arrival order. */
  arguments: string
  /** Whether `block-start` (and, for a tool call, its opening delta) was emitted. */
  announced: boolean
  closed: boolean
}

/** Terminal outcome of one fully iterated stream. */
export interface ChatTranslation {
  /** Usage the channel reported; absent when it reported none, so no `usage` chunk is emitted. */
  readonly usage?: TokenUsage
  /** Why the channel stopped; derived from the last `finish_reason` it sent. */
  readonly reason: FinishReason
}

/** Map one wire `finish_reason` onto a harness finish kind. */
function finishOf(raw: string): FinishReason {
  switch (raw) {
    case 'stop':
    case 'end_turn':
      return { kind: 'stop' }
    case 'tool_calls':
    case 'function_call':
      return { kind: 'tool-calls' }
    case 'length':
    case 'max_tokens':
      return { kind: 'max-tokens' }
    default:
      // A channel outside the completion vocabulary (content filtering, vendor
      // extension) still completed the response; the assembled content is what
      // the surface shows, so it is reported as an ordinary stop.
      return { kind: 'stop' }
  }
}

/**
 * Structural guard for one choice of a decoded payload.
 * @param value - an element of a chunk's `choices` array.
 * @returns true when the element is a JSON object carrying the fields read below.
 */
function isWireChoice(value: unknown): value is WireChoice {
  return isRecord(value) && ('delta' in value || 'finish_reason' in value)
}

/**
 * Convert one wire usage object into harness token accounting.
 *
 * Harness counts are disjoint, so the gateway's aggregate prompt count is
 * reduced by whatever it folded in as cached input; the aggregate total is
 * preserved as sent.
 *
 * @param usage - one chunk's decoded `usage` value.
 * @returns the token accounting, or undefined when the field is not an object.
 */
function usageOf(usage: unknown): TokenUsage | undefined {
  if (!isRecord(usage)) return undefined
  const outputTokens = usageCount(usage['completion_tokens']) ?? 0
  const cachedTokens = isRecord(usage.prompt_tokens_details)
    ? usageCount(usage.prompt_tokens_details.cached_tokens)
    : undefined
  const promptTokens = usageCount(usage.prompt_tokens)
  const inputTokens = promptTokens === undefined ? 0 : Math.max(0, promptTokens - (cachedTokens ?? 0))
  const reasoningTokens = isRecord(usage.completion_tokens_details)
    ? usageCount(usage.completion_tokens_details.reasoning_tokens)
    : undefined
  const total = usageCount(usage.total_tokens)
    ?? (promptTokens === undefined ? undefined : promptTokens + outputTokens)
  return {
    inputTokens,
    outputTokens,
    ...total === undefined ? {} : { totalTokens: total },
    ...cachedTokens === undefined ? {} : { cacheReadTokens: cachedTokens },
    ...reasoningTokens === undefined ? {} : { reasoningTokens },
  }
}

/** Whether one wire delta carries any content this route understands. */
function isEmptyDelta(delta: WireDelta): boolean {
  return (delta.content ?? '') === ''
    && (delta.reasoning_content ?? '') === ''
    && (delta.reasoning ?? '') === ''
    && (delta.tool_calls === undefined || delta.tool_calls.length === 0)
}

/** Validate one `tool_calls` fragment entry from an untrusted delta. */
function toolCallDelta(value: unknown): WireToolCallDelta {
  if (!isRecord(value) || !Number.isSafeInteger(value['index']) || (value['index'] as number) < 0) {
    throw new LlmError('NowCoding stream carried an invalid tool call fragment', 'MALFORMED_RESPONSE')
  }
  const fn = isRecord(value['function']) ? value['function'] : undefined
  const id = value['id']
  const name = fn?.['name']
  const args = fn?.['arguments']
  return {
    index: value['index'] as number,
    ...typeof id === 'string' ? { id } : {},
    ...fn === undefined ? {} : {
      function: {
        ...typeof name === 'string' ? { name } : {},
        ...typeof args === 'string' ? { arguments: args } : {},
      },
    },
  }
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
export class ChatStreamTranslator {
  private readonly blocks: OpenBlock[] = []
  private readonly toolBlocks = new Map<number, OpenBlock>()
  /**
   * Chunks produced by the event being applied but not yet handed to the
   * consumer. One event yields two chunks when it opens a block (`block-start`
   * plus that block's first delta), so the queue drains before the next event
   * is read.
   */
  private readonly queue: StreamChunk[] = []
  private readonly source: AsyncIterator<string>
  private usage: TokenUsage | undefined
  private wireFinish: string | undefined
  /** Buffered terminal chunks, drained one per call once the events end. */
  private terminal: StreamChunk[] = []
  private finished = false

  /**
   * @param events - SSE payload texts in arrival order, as framed by `parseSse`.
   */
  constructor(events: AsyncIterable<string>) {
    this.source = events[Symbol.asyncIterator]()
  }

  /**
   * Pull the next protocol chunk.
   * @returns the next chunk, or `done` once usage and finish have been flushed.
   * @throws {LlmError} code `MALFORMED_RESPONSE` for an undecodable payload, `EMPTY_RESPONSE`
   *   when the channel stopped without producing content or a tool invocation, and
   *   `STREAM_CLOSED` when the response body ended before the channel finished.
   */
  async next(): Promise<IteratorResult<StreamChunk>> {
    while (true) {
      const produced = this.queue.shift()
      if (produced !== undefined) return { done: false, value: produced }
      if (this.finished) return { done: true, value: undefined }
      const terminal = this.terminal.shift()
      if (terminal !== undefined) {
        if (this.terminal.length === 0) this.finished = true
        return { done: false, value: terminal }
      }
      const event = await this.source.next()
      if (event.done) {
        this.terminal = this.prepareTerminal()
        continue
      }
      this.consume(event.value)
    }
  }

  /**
   * Abandon the response.
   * @returns an already-completed iterator result.
   */
  async return(): Promise<IteratorResult<StreamChunk>> {
    this.finished = true
    this.terminal = []
    this.queue.length = 0
    return { done: true, value: undefined }
  }

  /**
   * The outcome of one fully iterated stream.
   * @returns the reported usage (when the channel sent any) and the finish reason.
   */
  get translation(): ChatTranslation {
    return { ...this.usage === undefined ? {} : { usage: this.usage }, reason: this.reason() }
  }

  /** The terminal finish reason; a stream that named none is reported from its content. */
  private reason(): FinishReason {
    if (this.wireFinish !== undefined) return finishOf(this.wireFinish)
    return this.toolBlocks.size > 0 ? { kind: 'tool-calls' } : { kind: 'stop' }
  }

  /** Decode one payload and apply it, queueing every chunk it produces. */
  private consume(data: string): void {
    let decoded: unknown
    try {
      decoded = JSON.parse(data)
    } catch (error) {
      throw new LlmError('NowCoding stream carried an undecodable event', 'MALFORMED_RESPONSE', { cause: error })
    }
    if (!isRecord(decoded)) {
      throw new LlmError('NowCoding stream carried a non-object event', 'MALFORMED_RESPONSE')
    }
    this.accept(decoded)
  }

  /** Record what one well-formed payload reports, then apply its delta. */
  private accept(payload: Record<string, unknown>): void {
    this.usage = usageOf(payload['usage']) ?? this.usage
    const choices = payload['choices']
    const first = isArray(choices) ? choices[0] : undefined
    // A usage-only trailing entry carries an empty `choices` array.
    if (!isWireChoice(first)) return
    const finish = first.finish_reason
    if (typeof finish === 'string' && finish.length > 0) this.wireFinish = finish
    // A channel that keeps sending content after it reported a finish has
    // already settled the response; the trailing entry only carries usage.
    if (this.wireFinish !== undefined) return
    const delta = first.delta
    // Every `WireDelta` field is optional, so a decoded JSON object is one.
    if (isRecord(delta) && !isEmptyDelta(delta)) this.applyDelta(delta)
  }

  /** Apply one delta, queueing `block-start` ahead of the block's first delta. */
  private applyDelta(delta: WireDelta): void {
    const content = deltaText(delta.content)
    if (content !== undefined) {
      const block = this.ensure('text')
      block.text += content
      this.queue.push({ type: 'text-delta', index: block.index, text: content })
      return
    }
    const reasoning = deltaText(delta.reasoning_content) ?? deltaText(delta.reasoning)
    if (reasoning !== undefined) {
      const block = this.ensure('reasoning')
      block.text += reasoning
      this.queue.push({ type: 'reasoning-delta', index: block.index, text: reasoning })
      return
    }
    for (const raw of delta.tool_calls ?? []) {
      const fragment = toolCallDelta(raw)
      const block = this.toolBlock(fragment)
      const id = fragment.id
      if (id !== undefined && id.length > 0) block.toolCallId = id
      const name = fragment.function?.name
      if (name !== undefined && name.length > 0) block.toolCallName = name
      const argumentsDelta = fragment.function?.arguments ?? ''
      if (!block.announced && (block.toolCallId === '' || block.toolCallName === '')) {
        // Announcing an incomplete invocation would make the harness assemble a
        // tool call whose id or name it cannot correlate; wait for the fields.
        continue
      }
      block.arguments += argumentsDelta
      this.announce(block)
      this.queue.push({
        type: 'tool-call-delta',
        index: block.index,
        id: ToolCallId(block.toolCallId),
        name: block.toolCallName,
        argumentsDelta,
      })
    }
  }

  /** Queue the opening `block-start` exactly once, ahead of the block's first delta. */
  private announce(block: OpenBlock): void {
    if (block.announced) return
    block.announced = true
    this.queue.push({ type: 'block-start', index: block.index, blockType: block.type })
  }

  /** The single text or reasoning block this route streams, allocated on first use. */
  private ensure(type: 'text' | 'reasoning'): OpenBlock {
    const existing = this.blocks.find(block => block.type === type)
    if (existing !== undefined) return existing
    const block = this.allocate(type)
    this.blocks.push(block)
    this.announce(block)
    return block
  }

  /** The block for one tool invocation position, allocated on first sight. */
  private toolBlock(fragment: WireToolCallDelta): OpenBlock {
    const existing = this.toolBlocks.get(fragment.index)
    if (existing !== undefined) return existing
    const block = this.allocate('tool-call')
    block.toolCallId = fragment.id ?? ''
    block.toolCallName = fragment.function?.name ?? ''
    this.toolBlocks.set(fragment.index, block)
    return block
  }

  /** Allocate one open block at the next index in first-seen order. */
  private allocate(type: OpenBlockType): OpenBlock {
    return {
      index: this.seen.length,
      type,
      text: '',
      toolCallId: '',
      toolCallName: '',
      arguments: '',
      announced: false,
      closed: false,
    }
  }

  /** Every allocated block, in the order its index was assigned. */
  private get seen(): OpenBlock[] {
    return [...this.blocks, ...this.toolBlocks.values()].sort((left, right) => left.index - right.index)
  }

  /** Close every open block, in first-seen order. */
  private closeBlocks(): StreamChunk[] {
    return this.seen
      .filter(block => !block.closed)
      .map((block): StreamChunk => {
        block.closed = true
        return { type: 'block-end', index: block.index, block: this.assembled(block) }
      })
  }

  /** The complete block one accumulation produced. */
  private assembled(block: OpenBlock): ContentBlock {
    switch (block.type) {
      case 'text': return { type: 'text', text: block.text }
      case 'reasoning': return { type: 'reasoning', text: block.text }
      case 'tool-call': return {
        type: 'tool-call',
        id: ToolCallId(block.toolCallId),
        name: block.toolCallName,
        // Raw JSON string end to end; a truncated fragment is kept as produced.
        arguments: block.arguments,
      }
    }
  }

  /** Build the terminal chunk sequence: block ends, then usage, then finish. */
  private prepareTerminal(): StreamChunk[] {
    if (this.seen.length === 0 && this.reason().kind === 'stop') {
      throw new LlmError('NowCoding returned no content', EMPTY_RESPONSE_CODE)
    }
    if (this.wireFinish === undefined) {
      throw new LlmError('NowCoding stream ended before the channel finished', 'STREAM_CLOSED')
    }
    return [
      ...this.closeBlocks(),
      ...this.usage === undefined ? [] : [{ type: 'usage', usage: this.usage } as StreamChunk],
      { type: 'finish', reason: this.reason() },
    ]
  }
}
