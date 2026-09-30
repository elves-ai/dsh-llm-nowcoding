/**
 * Serialize one harness request into the gateway's Chat Completions body.
 *
 * The projection is deliberately lossless in the two places the adapter
 * contract names: tool `arguments` ride as the raw JSON string the model
 * produced, and tool results keep their `tool_call_id` correlation.
 *
 * User images resolve through the host attachment store into verified request
 * versions and inline `image_url` parts. Offloaded images retain the Harness
 * placeholder; a missing store or unsupported role fails rather than silently
 * discarding the attachment.
 *
 * Reasoning is dropped from assistant history: no signature or response id
 * accompanies it on this route, so there is nothing to replay and no wire field
 * to carry it.
 *
 * @module @elves-ai/dsh-llm-nowcoding/serialize
 */

import { LlmError, offloadedImageText, requestImageHandleText } from '@deepseek-ai/dsh-llm'
import type { AttachmentStore, RequestImageAttachment } from '@deepseek-ai/dsh-attachment'
import type {
  ContentBlock, GenerateOptions, ImageBlock, ReasoningEffortId, RequestMessage, ToolResultMessage,
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
  /** Host-owned image projection; optional so text-only/headless calls still work. */
  attachments?: Pick<AttachmentStore, 'readImageRequest'>
}

/** Refuse a request field or content block the wire cannot carry; never drop it silently. */
function unsupported(detail: string): never {
  throw new LlmError(`NowCoding chat completions cannot represent ${detail}`, 'UNSUPPORTED_CONTENT')
}

/** Resolve retained user images once per attachment, without changing request history. */
async function imagePartsOf(
  options: GenerateOptions,
  context: SerializeContext,
): Promise<ReadonlyMap<ImageBlock, readonly WirePart[]>> {
  const parts = new Map<ImageBlock, readonly WirePart[]>()
  const versions = new Map<string, RequestImageAttachment>()
  const entry = catalogEntry(context.catalog, options.model)
  for (const message of options.messages) {
    for (const block of message.content) {
      if (block.type !== 'image') continue
      options.signal?.throwIfAborted()
      if (message.role !== 'user') unsupported('an image in a non-user message')
      if (block.offloaded === true) {
        parts.set(block, [{ type: 'text', text: offloadedImageText(block.attachment) }])
        continue
      }
      if (entry !== undefined && !entry.input.includes('image')) {
        unsupported('an image for a text-only model')
      }
      if (context.attachments === undefined) unsupported('an image without the host attachment store')
      const ref = block.attachment
      let version = versions.get(ref.attachmentId)
      if (version === undefined) {
        try {
          version = await context.attachments.readImageRequest(ref, {
            width: ref.width, height: ref.height, maxBytes: ref.bytes,
          }, options.signal)
        } catch (error) {
          options.signal?.throwIfAborted()
          throw new LlmError('NowCoding could not resolve an image attachment', 'ATTACHMENT', { cause: error })
        }
        options.signal?.throwIfAborted()
        versions.set(ref.attachmentId, version)
      }
      parts.set(block, [
        { type: 'text', text: requestImageHandleText(ref, version) },
        { type: 'image_url', image_url: {
          url: 'data:' + version.mediaType + ';base64,' + Buffer.from(version.data).toString('base64'),
        } },
      ])
    }
  }
  return parts
}

/** Render accumulated text parts, or an ordered multimodal part list. */
function bodyOf(parts: readonly WirePart[]): string | WirePart[] {
  return parts.every(part => part.type === 'text')
    ? parts.map(part => part.type === 'text' ? part.text : '').join('')
    : [...parts]
}

/**
 * Project one message's content into a wire body.
 * @param content - durable or request-only content blocks.
 * @param role - the wire role the body belongs to, which decides what may appear.
 * @param images - resolved user-image parts for this operation.
 * @returns the joined text, or an ordered part list when an image is present.
 * @throws {LlmError} code `UNSUPPORTED_CONTENT` for an unresolved image or unknown block.
 */
function contentOf(content: readonly ContentBlock[], role: WireRole, images: ReadonlyMap<ImageBlock, readonly WirePart[]>): string | WirePart[] {
  const parts: WirePart[] = []
  for (const block of content) {
    switch (block.type) {
      case 'text':
        if (block.text.length > 0) parts.push({ type: 'text', text: block.text })
        break
      case 'reasoning':
        // Reasoning from an earlier turn is not model-visible input on this route.
        break
      case 'image': {
        const resolved = images.get(block)
        if (role !== 'user' || resolved === undefined) unsupported(`an unresolved image in a ${role} message`)
        parts.push(...resolved)
        break
      }
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
function toolMessage(message: ToolResultMessage, images: ReadonlyMap<ImageBlock, readonly WirePart[]>): WireMessage {
  const body = contentOf(message.content, 'tool', images)
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
function requestMessage(message: RequestMessage, images: ReadonlyMap<ImageBlock, readonly WirePart[]>): WireMessage {
  switch (message.role) {
    case 'system':
    case 'developer': {
      const body = contentOf(message.content, 'system', images)
      if (typeof body !== 'string') unsupported('a system message containing an image')
      return { role: 'system', content: body }
    }
    case 'user':
      return { role: 'user', content: contentOf(message.content, 'user', images) }
    case 'tool':
      return toolMessage(message, images)
    case 'assistant':
      return assistantMessage(message.content)
    default:
      unsupported(`message role "${String((message as { role: string }).role)}"`)
  }
}

/** Project the conversation, with the one-shot `system` slot ahead of it. */
function messagesOf(options: GenerateOptions, images: ReadonlyMap<ImageBlock, readonly WirePart[]>): WireMessage[] {
  const messages: WireMessage[] = []
  if (options.system !== undefined && options.system.length > 0) {
    messages.push({ role: 'system', content: options.system })
  }
  for (const message of options.messages) messages.push(requestMessage(message, images))
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
export async function serialize(options: GenerateOptions, context: SerializeContext): Promise<WireRequest> {
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
  const images = await imagePartsOf(options, context)
  return {
    // A '-fast' id selects a tier; it is never a model the gateway serves.
    model: wireModelId(options.model),
    messages: messagesOf(options, images),
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
