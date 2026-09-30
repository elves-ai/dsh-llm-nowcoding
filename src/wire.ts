/**
 * Wire types for the NowCoding gateway's OpenAI-compatible Chat Completions
 * route, plus the narrowing needed to read untrusted response JSON.
 *
 * Only fields this adapter sends or consumes are declared: the gateway is a
 * new-api deployment that passes the OpenAI body through to whichever vendor
 * channel serves the model, so any field declared here must mean the same
 * thing on every channel. Narrowing guards live beside the types because the
 * SSE payload is a wire boundary — nothing upstream validates it.
 *
 * @module @elves-ai/dsh-llm-nowcoding/wire
 */

/** True for a JSON object (never an array, never null). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** True for a JSON array. */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

/**
 * Request-level usage accounting, requested with
 * {@link WireRequest.stream_options}. Every field is optional because channels
 * differ in how much of the OpenAI usage object they populate.
 */
export interface WireUsage {
  prompt_tokens?: number
  completion_tokens?: number
  /** Aggregate prompt, completion, and reasoning tokens; present only when the channel reports one. */
  total_tokens?: number
  prompt_tokens_details?: { cached_tokens?: number }
  completion_tokens_details?: { reasoning_tokens?: number }
}

/** One text part of a multimodal message body. */
export interface WireTextPart {
  type: 'text'
  text: string
}

/**
 * One image part. The adapter never builds this: no request-version bytes reach
 * the adapter (see `serialize.ts`), so an image-capable model is served text
 * for image occurrences and a vision-capable request is refused.
 */
export interface WireImagePart {
  type: 'image_url'
  image_url: { url: string }
}

/** One message body part. */
export type WirePart = WireTextPart | WireImagePart

/** One assistant tool invocation; `arguments` stays the raw JSON string end to end. */
export interface WireToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

/** The serialized body and its string content, before part arrays are chosen. */
export interface WireMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  /** `null` is sent for an assistant turn whose only content is tool calls. */
  content: string | WirePart[] | null
  tool_calls?: WireToolCall[]
  tool_call_id?: string
}

/** One request-body tool declaration. */
export interface WireTool {
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}

/** One model response chunk; `usage` is what the gateway appends to the final list entry. */
export interface WireChunk {
  id: string
  choices: WireChoice[]
  usage?: WireUsage
}

/** One streamed choice. */
export interface WireChoice {
  index?: number
  delta?: WireDelta
  /** Present only on the entry that ends the response. */
  finish_reason?: string | null
}

/** One streamed delta; an absent field means "no change on this channel". */
export interface WireDelta {
  /** Present once on the first delta, when the channel reports it. */
  role?: string
  content?: string | null
  /** Model-visible reasoning text when the channel streams it separately. */
  reasoning_content?: string | null
  /** Some channels stream reasoning under this legacy spelling instead. */
  reasoning?: string | null
  tool_calls?: WireToolCallDelta[]
}

/** One streamed fragment of a tool invocation. */
export interface WireToolCallDelta {
  /** Position within this chunk's `tool_calls` array, not a block index. */
  index: number
  /** Present on the fragment that opens the invocation. */
  id?: string
  function?: { name?: string; arguments?: string }
}

/** One error payload; the gateway reports these at either nesting level. */
export interface WireError {
  message?: string
  type?: string
  code?: string | number
}

/** The request body sent to `POST {baseURL}/chat/completions`. */
export interface WireRequest {
  model: string
  messages: WireMessage[]
  stream: true
  /** Required for the gateway to append a usage-bearing final entry. */
  stream_options: { include_usage: true }
  /**
   * `priority` or `fast` when this request asked for the fast tier and the
   * model has one; the field is absent otherwise, because a channel without the
   * tier rejects the whole request instead of ignoring it.
   */
  service_tier?: string
  /** Wire spelling mapped from the caller's opaque effort id; absent when the model declares no mapping. */
  reasoning_effort?: string
  temperature?: number
  max_tokens?: number
  stop?: string[]
  tools?: WireTool[]
}

/** Read a finite, non-negative integer from an untrusted usage field. */
export function usageCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined
}

/** Read a string from an untrusted delta field. */
export function deltaText(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}
