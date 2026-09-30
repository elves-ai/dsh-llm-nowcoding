/**
 * Serialize one harness request into the gateway's Chat Completions body.
 *
 * The projection is deliberately lossless in the two places the adapter
 * contract names: tool `arguments` ride as the raw JSON string the model
 * produced, and tool results keep their `tool_call_id` correlation.
 *
 * Image occurrences are refused rather than approximated. The adapter receives
 * no attachment resolver, so it cannot read request-version bytes for
 * `image_url`; substituting placeholder text would silently drop content the
 * user attached, so a vision-capable request fails with `UNSUPPORTED_CONTENT`
 * and the route's catalog `input` declaration is what keeps image models out of
 * that state.
 *
 * Reasoning is dropped from assistant history: no signature or response id
 * accompanies it on this route, so there is nothing to replay and no wire field
 * to carry it.
 *
 * @module @elves-ai/dsh-llm-nowcoding/serialize
 */

import { LlmError } from '@deepseek-ai/dsh-llm'
import type {
  ContentBlock, GenerateOptions, ReasoningEffortId, RequestMessage, ToolResultMessage,
} from '@deepseek-ai/dsh-llm'
import { catalogEntry, wireModelId, type NowCodingCatalogModel } from './catalog.ts'
import { decideFastTier } from './fast.ts'
import type { NowCodingFastServiceTier } from './settings-shared.ts'
import type { WireMessage, WirePart, WireRequest, WireTool, WireToolCall } from './wire.ts'

/** Largest number of stop sequences the OpenAI body accepts. */
const MAX_STOP_SEQUENCES = 4

/** Wire roles this projection produces. */
type WireRole = WireMessage['role']

/** Everything serialization needs beyond the request itself. */
export interface SerializeContext {
  /** The served catalog, which owns fast-tier and reasoning eligibility. */
  catalog: readonly NowCodingCatalogModel[]
  /** Route-level fast default. */
  fast: boolean
  /** Wire spelling sent when fast mode is on. */
  fastServiceTier: NowCodingFastServiceTier
}

/** Refuse a request field or content block the wire cannot carry; never drop it silently. */
function unsupported(detail: string): never {
  throw new LlmError(`NowCoding chat completions cannot represent ${detail}`, 'UNSUPPORTED_CONTENT')
}

/** Render accumulated text parts, or the part list when an image survived this far. */
function bodyOf(parts: readonly WirePart[]): string | WirePart[] {
  return parts.every(part => part.type === 'text')
    ? parts.map(part => part.type === 'text' ? part.text : '').join('')
    : [...parts]
}

/**
 * Project one message's content into a wire body.
 * @param content - durable or request-only content blocks.
 * @param role - the wire role the body belongs to, which decides what may appear.
 * @returns the joined text, or an ordered part list when an image is present.
 * @throws {LlmError} code `UNSUPPORTED_CONTENT` for an image or an unknown block.
 */
function contentOf(content: readonly ContentBlock[], role: WireRole): string | WirePart[] {
  const parts: WirePart[] = []
  for (const block of content) {
    switch (block.type) {
      case 'text':
        if (block.text.length > 0) parts.push({ type: 'text', text: block.text })
        break
      case 'reasoning':
        // Reasoning from an earlier turn is not model-visible input on this route.
        break
      case 'image':
        unsupported(`an image occurrence in a ${role} message; this route sends text only`)
        break
      case 'file':
        // Request assembly replaces every file with handle text before dispatch.
        unsupported('a file block that request assembly did not project')
        break
      default:
        unsupported(`${role} content block "${block.type}"`)
    }
  }
  return bodyOf(parts)
}

/** Project one assistant turn into text plus raw-string tool calls. */
function assistantMessage(content: readonly ContentBlock[]): WireMessage {
  const parts: WirePart[] = []
  const toolCalls: WireToolCall[] = []
  for (const block of content) {
    switch (block.type) {
      case 'text':
        if (block.text.length > 0) parts.push({ type: 'text', text: block.text })
        break
      case 'reasoning':
        break
      case 'tool-call':
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: { name: block.name, arguments: block.arguments },
        })
        break
      default:
        unsupported(`assistant content block "${block.type}"`)
    }
  }
  return {
    role: 'assistant',
    // An assistant turn whose only content is tool calls sends an empty body;
    // `null` is not accepted by every channel the gateway fronts.
    content: bodyOf(parts),
    ...toolCalls.length === 0 ? {} : { tool_calls: toolCalls },
  }
}

/** Project one tool result into the `role: 'tool'` message that answers its call. */
function toolMessage(message: ToolResultMessage): WireMessage {
  const body = contentOf(message.content, 'tool')
  if (typeof body !== 'string') unsupported('a tool result containing an image')
  return {
    role: 'tool',
    tool_call_id: message.toolCallId,
    // The wire protocol carries no error flag, so a failed result is labelled in
    // the text the model reads.
    content: message.isError === true ? `[tool error] ${body}` : body,
  }
}

/** Project one non-assistant conversation turn. */
function requestMessage(message: RequestMessage): WireMessage {
  switch (message.role) {
    case 'system':
    case 'developer': {
      const body = contentOf(message.content, 'system')
      if (typeof body !== 'string') unsupported('a system message containing an image')
      return { role: 'system', content: body }
    }
    case 'user':
      return { role: 'user', content: contentOf(message.content, 'user') }
    case 'tool':
      return toolMessage(message)
    case 'assistant':
      return assistantMessage(message.content)
    default:
      unsupported(`message role "${String((message as { role: string }).role)}"`)
  }
}

/** Project the conversation, with the one-shot `system` slot ahead of it. */
function messagesOf(options: GenerateOptions): WireMessage[] {
  const messages: WireMessage[] = []
  if (options.system !== undefined && options.system.length > 0) {
    messages.push({ role: 'system', content: options.system })
  }
  for (const message of options.messages) messages.push(requestMessage(message))
  return messages
}

/** Project tool declarations; `deferLoading` has no wire representation and is not sent. */
function toolsOf(options: GenerateOptions): WireTool[] | undefined {
  if (options.tools === undefined) return undefined
  return options.tools.map((tool): WireTool => ({
    type: 'function',
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }))
}

/**
 * Map the caller's opaque effort id through the catalog entry's table.
 * @param effort - the effort id selected for this request.
 * @param entry - the resolved catalog entry; absent for a model the catalog does not describe.
 * @returns the wire spelling, or undefined when the model declares no level table at all.
 * @throws {LlmError} code `UNSUPPORTED_REASONING_EFFORT` when the model declares reasoning
 *   unsupported, or declares levels that do not contain this one.
 */
function reasoningEffort(effort: ReasoningEffortId, entry: NowCodingCatalogModel | undefined): string | undefined {
  const table = entry?.reasoningEfforts
  if (table === false) {
    throw new LlmError(
      `NowCoding model "${entry?.id ?? ''}" does not support a reasoning effort`,
      'UNSUPPORTED_REASONING_EFFORT',
    )
  }
  if (table === undefined) return undefined
  const wire = table[effort]
  if (wire === undefined) {
    throw new LlmError(
      `NowCoding model "${entry?.id ?? ''}" does not offer the reasoning effort "${effort}"`,
      'UNSUPPORTED_REASONING_EFFORT',
    )
  }
  return wire
}

/**
 * Build one Chat Completions request body.
 * @param options - the fully assembled harness request.
 * @param context - the route's catalog and fast-tier configuration.
 * @returns the wire body, ready to send as JSON.
 * @throws {LlmError} `UNSUPPORTED_CONTENT` for a block or role this route cannot carry,
 *   `UNSUPPORTED_REASONING_EFFORT` for an effort the exact model does not offer, and
 *   `UNSUPPORTED_OPTION` for a stop list longer than the wire accepts.
 */
export function serialize(options: GenerateOptions, context: SerializeContext): WireRequest {
  if (options.stop !== undefined && options.stop.length > MAX_STOP_SEQUENCES) {
    throw new LlmError(
      `NowCoding chat completions accepts at most ${MAX_STOP_SEQUENCES} stop sequences`,
      'UNSUPPORTED_OPTION',
    )
  }
  const entry = catalogEntry(context.catalog, options.model)
  const tier = decideFastTier({
    modelId: options.model,
    routeDefault: context.fast,
    entry,
    wireValue: context.fastServiceTier,
  })
  const effort = options.reasoningEffort === undefined
    ? undefined
    : reasoningEffort(options.reasoningEffort, entry)
  const tools = toolsOf(options)
  return {
    // A '-fast' id selects a tier; it is never a model the gateway serves.
    model: wireModelId(options.model),
    messages: messagesOf(options),
    stream: true,
    stream_options: { include_usage: true },
    ...tier.serviceTier === undefined ? {} : { service_tier: tier.serviceTier },
    ...effort === undefined ? {} : { reasoning_effort: effort },
    ...options.temperature === undefined ? {} : { temperature: options.temperature },
    ...options.maxTokens === undefined ? {} : { max_tokens: options.maxTokens },
    ...options.stop === undefined ? {} : { stop: [...options.stop] },
    ...tools === undefined ? {} : { tools },
  }
}
