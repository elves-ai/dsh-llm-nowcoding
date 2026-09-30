/**
 * Adapter behavior driven by recorded SSE transcripts and an injected fetch.
 *
 * No spec here reaches the network: every provider call is answered by the fake
 * transport built below, so the suite runs in CI without a NowCoding key.
 */
import { BlockAssembler, LlmError } from '@deepseek-ai/dsh-llm'
import type { ContentBlock, GenerateOptions, StreamChunk, ToolSchema } from '@deepseek-ai/dsh-llm'
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm/brand'
import { describe, expect, it } from 'vitest'
import { NowCodingAdapter } from '../src/adapter.ts'
import { NOWCODING_BUILTIN_CATALOG, type NowCodingCatalogModel } from '../src/catalog.ts'
import type { NowCodingResolvedOptions } from '../src/config.ts'
import { parseSse } from '../src/sse.ts'
import { ChatStreamTranslator } from '../src/translate.ts'
import type { WireRequest } from '../src/wire.ts'

const KEY = 'sk-nowcoding-test'
const BASE_URL = 'https://nowcoding.ai/v1'
/** A fast-capable catalog model: its `-fast` alias selects a tier, never a wire id. */
const MODEL = 'gpt-5.4'
const FAST_MODEL = `${MODEL}-fast`

/** Route configuration with every field the adapter reads. */
function options(overrides: Partial<NowCodingResolvedOptions> = {}): NowCodingResolvedOptions {
  return {
    apiKey: KEY,
    baseURL: BASE_URL,
    displayName: 'NowCoding',
    fast: false,
    fastServiceTier: 'priority',
    catalog: NOWCODING_BUILTIN_CATALOG,
    quotaCard: false,
    panelToken: '',
    panelUserId: '',
    quotaRefreshSeconds: 300,
    requestTimeoutMs: 300_000,
    settingsNs: 'llm-nowcoding',
    ...overrides,
  }
}

/** One request-only user turn, in the shape the loop sends. */
function user(text: string): GenerateOptions['messages'][number] {
  return { role: 'user', content: [{ type: 'text', text }] }
}

/** The request one spec sends, with the response its fake transport answers with. */
function request(overrides: Partial<GenerateOptions> = {}): GenerateOptions {
  return { provider: 'nowcoding', model: MODEL, messages: [user('hello')], ...overrides }
}

/** One chunk envelope; `usage` appears only on the trailing entry. */
function chunk(choices: readonly unknown[], usage?: unknown): unknown {
  return {
    id: 'chatcmpl-test',
    object: 'chat.completion.chunk',
    model: MODEL,
    choices,
    ...usage === undefined ? {} : { usage },
  }
}

/** One streamed content delta. */
function textDelta(text: string): unknown {
  return chunk([{ index: 0, delta: { content: text }, finish_reason: null }])
}

/** One streamed tool-call fragment. */
function toolDelta(call: unknown): unknown {
  return chunk([{ index: 0, delta: { tool_calls: [call] }, finish_reason: null }])
}

/** Frame one event list as the gateway's SSE body, `[DONE]` included. */
function sse(events: readonly unknown[]): string {
  return events.map(event => `data: ${JSON.stringify(event)}\n\n`).join('') + 'data: [DONE]\n\n'
}

/** A recorded completion: two text deltas, a stop, then the usage-only trailing entry. */
const TEXT_TRANSCRIPT = sse([
  chunk([{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }]),
  textDelta('Hello '),
  textDelta('世界'),
  chunk([{ index: 0, delta: {}, finish_reason: 'stop' }]),
  chunk([], { prompt_tokens: 11, completion_tokens: 3, total_tokens: 14 }),
])

/** A recorded tool turn: identity first, then the argument text split across two entries. */
const TOOL_TRANSCRIPT = sse([
  toolDelta({ index: 0, id: 'call_1', function: { name: 'bash', arguments: '' } }),
  toolDelta({ index: 0, function: { arguments: '{"command":' } }),
  toolDelta({ index: 0, function: { arguments: '"echo hi"}' } }),
  chunk([{ index: 0, delta: {}, finish_reason: 'tool_calls' }]),
  chunk([], { prompt_tokens: 20, completion_tokens: 9, total_tokens: 29 }),
])

/** One captured provider call. */
interface Captured {
  url: string
  headers: Headers
  body: WireRequest
  signal: AbortSignal | null | undefined
}

/** One fake transport: it records what the adapter sent and answers with fixed text. */
interface Transport {
  calls: Captured[]
  fetchImpl: typeof fetch
}

/** Record one call and answer it with `transcript`. */
function capture(input: string | URL | Request, init: RequestInit | undefined, calls: Captured[]): Captured {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const captured: Captured = {
    url,
    headers: new Headers(init?.headers),
    body: JSON.parse(String(init?.body)) as WireRequest,
    signal: init?.signal,
  }
  calls.push(captured)
  return captured
}

/** Serve a successful SSE response on every call. */
function stubFetch(transcript: string): Transport {
  const calls: Captured[] = []
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    capture(input, init, calls)
    return new Response(transcript, { status: 200, headers: { 'content-type': 'text/event-stream' } })
  }) as typeof fetch
  return { calls, fetchImpl }
}

/** Serve one non-success response, so error classification can be asserted. */
function stubFailure(status: number, body: unknown): Transport {
  const calls: Captured[] = []
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    capture(input, init, calls)
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
  return { calls, fetchImpl }
}

/** Collect a stream so a spec can assert on order as well as content. */
async function collect(stream: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return chunks
}

/** Assemble a stream the way the loop does, to prove the protocol is consumable. */
function assemble(chunks: readonly StreamChunk[]): BlockAssembler {
  const assembler = new BlockAssembler()
  for (const chunk of chunks) assembler.push(chunk)
  return assembler
}

/** Read one block out of assembled content. */
function blockAt(blocks: readonly ContentBlock[], index: number): ContentBlock {
  const block = blocks[index]
  if (block === undefined) throw new Error(`no assembled block at ${index}`)
  return block
}

/** Run one request against a fixed transcript. */
async function run(transcript: string, overrides: Partial<GenerateOptions> = {}): Promise<{
  chunks: StreamChunk[]
  calls: Captured[]
}> {
  const { calls, fetchImpl } = stubFetch(transcript)
  const adapter = new NowCodingAdapter({ options: () => options(), fetchImpl })
  return { chunks: await collect(adapter.stream(request(overrides))), calls }
}

describe('NowCodingAdapter text streaming', () => {
  it('merges text deltas into one block and closes it before usage and finish', async () => {
    const { chunks, calls } = await run(TEXT_TRANSCRIPT)

    expect(chunks.map(chunk => chunk.type)).toEqual([
      'block-start', 'text-delta', 'text-delta', 'block-end', 'usage', 'finish',
    ])
    const assembler = assemble(chunks)
    expect(assembler.blocks()).toEqual([{ type: 'text', text: 'Hello 世界' }])
    expect(assembler.finish).toEqual({ kind: 'stop' })
    // No native metadata is needed to replay this route.
    expect(assembler.replayState).toBeUndefined()
    expect(calls[0]?.url).toBe(`${BASE_URL}/chat/completions`)
    expect(calls[0]?.headers.get('authorization')).toBe(`Bearer ${KEY}`)
    expect(calls[0]?.headers.get('accept')).toBe('text/event-stream')
    expect(calls[0]?.body).toMatchObject({
      model: MODEL,
      stream: true,
      stream_options: { include_usage: true },
      messages: [{ role: 'user', content: 'hello' }],
    })
  })

  it('emits usage before finish and nothing after finish', async () => {
    const { chunks } = await run(TEXT_TRANSCRIPT)

    const types = chunks.map(chunk => chunk.type)
    expect(types.filter(type => type === 'usage')).toHaveLength(1)
    expect(types.filter(type => type === 'finish')).toHaveLength(1)
    expect(types.indexOf('usage')).toBeLessThan(types.indexOf('finish'))
    expect(types.at(-1)).toBe('finish')
    expect(chunks.at(-1)).toEqual({ type: 'finish', reason: { kind: 'stop' } })
  })

  it('translates gateway usage into disjoint harness token counts', async () => {
    const transcript = sse([
      textDelta('hi'),
      chunk([{ index: 0, delta: {}, finish_reason: 'stop' }]),
      chunk([], {
        prompt_tokens: 100,
        completion_tokens: 7,
        total_tokens: 107,
        prompt_tokens_details: { cached_tokens: 40 },
        completion_tokens_details: { reasoning_tokens: 5 },
      }),
    ])
    const { chunks } = await run(transcript)

    expect(chunks.find(chunk => chunk.type === 'usage')).toEqual({
      type: 'usage',
      usage: { inputTokens: 60, outputTokens: 7, totalTokens: 107, cacheReadTokens: 40, reasoningTokens: 5 },
    })
  })

  it('streams model reasoning as a reasoning block', async () => {
    const transcript = sse([
      chunk([{ index: 0, delta: { reasoning_content: 'let me think' }, finish_reason: null }]),
      textDelta('done'),
      chunk([{ index: 0, delta: {}, finish_reason: 'stop' }]),
    ])
    const { chunks } = await run(transcript)

    expect(chunks.filter(chunk => chunk.type === 'reasoning-delta')).toEqual([
      { type: 'reasoning-delta', index: 0, text: 'let me think' },
    ])
    expect(chunks.filter(chunk => chunk.type === 'block-start')).toEqual([
      { type: 'block-start', index: 0, blockType: 'reasoning' },
      { type: 'block-start', index: 1, blockType: 'text' },
    ])
  })
})

describe('NowCodingAdapter tool calls', () => {
  it('streams argument fragments and closes the raw JSON string unparsed', async () => {
    const { chunks } = await run(TOOL_TRANSCRIPT)

    expect(chunks.filter(chunk => chunk.type === 'tool-call-delta')).toEqual([
      { type: 'tool-call-delta', index: 0, id: 'call_1', name: 'bash', argumentsDelta: '' },
      { type: 'tool-call-delta', index: 0, id: 'call_1', name: 'bash', argumentsDelta: '{"command":' },
      { type: 'tool-call-delta', index: 0, id: 'call_1', name: 'bash', argumentsDelta: '"echo hi"}' },
    ])
    expect(chunks.find(chunk => chunk.type === 'block-end')).toEqual({
      type: 'block-end',
      index: 0,
      block: { type: 'tool-call', id: 'call_1', name: 'bash', arguments: '{"command":"echo hi"}' },
    })
    const assembler = assemble(chunks)
    expect(assembler.finish).toEqual({ kind: 'tool-calls' })
    const assembled = blockAt(assembler.blocks(), 0)
    if (assembled.type !== 'tool-call') throw new Error('expected an assembled tool call')
    expect(typeof assembled.arguments).toBe('string')
    expect(JSON.parse(assembled.arguments)).toEqual({ command: 'echo hi' })
  })

  it('allocates block indexes in first-seen order across text and tool calls', async () => {
    const transcript = sse([
      textDelta('thinking out loud'),
      chunk([{ index: 0, delta: { tool_calls: [
        { index: 0, id: 'call_a', function: { name: 'read', arguments: '{}' } },
        { index: 1, id: 'call_b', function: { name: 'write', arguments: '{}' } },
      ] }, finish_reason: null }]),
      chunk([{ index: 0, delta: {}, finish_reason: 'tool_calls' }]),
    ])
    const { chunks } = await run(transcript)

    expect(chunks.filter(chunk => chunk.type === 'block-start')).toEqual([
      { type: 'block-start', index: 0, blockType: 'text' },
      { type: 'block-start', index: 1, blockType: 'tool-call' },
      { type: 'block-start', index: 2, blockType: 'tool-call' },
    ])
    expect(chunks.flatMap(chunk => chunk.type === 'block-end' ? [chunk.index] : [])).toEqual([0, 1, 2])
  })
})

describe('NowCodingAdapter request mapping', () => {
  it('passes the caller signal to fetch and refuses an already-aborted request', async () => {
    const { calls, fetchImpl } = stubFetch(TEXT_TRANSCRIPT)
    const adapter = new NowCodingAdapter({ options: () => options(), fetchImpl })
    const controller = new AbortController()

    const chunks = await collect(adapter.stream(request({ signal: controller.signal })))
    expect(chunks.at(-1)).toMatchObject({ type: 'finish' })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.signal).toBeInstanceOf(AbortSignal)
    // The stream completed, so this request's own timeout controller has ended;
    // cancellation of an open request is covered by the mid-stream spec below.
    expect(calls[0]?.signal?.aborted).toBe(true)

    const aborted = new AbortController()
    aborted.abort()
    await expect(collect(adapter.stream(request({ signal: aborted.signal }))))
      .rejects.toMatchObject({ code: 'ABORTED' })
    // An already-cancelled request never reaches the provider.
    expect(calls).toHaveLength(1)
  })

  it('aborts the in-flight request when the caller cancels mid-stream', async () => {
    let seen: AbortSignal | null | undefined
    const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      seen = init?.signal
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(sse([textDelta('partial')])))
          // The stream stays open: only the caller's abort can end it.
        },
      })
      return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
    }) as typeof fetch
    const adapter = new NowCodingAdapter({ options: () => options(), fetchImpl })
    const controller = new AbortController()
    const iterator = adapter.stream(request({ signal: controller.signal }))[Symbol.asyncIterator]()

    // One pull starts the request and reads the first queued chunks.
    expect((await iterator.next()).value).toMatchObject({ type: 'block-start' })
    expect(seen?.aborted).toBe(false)
    controller.abort()
    expect(seen?.aborted).toBe(true)
    // The open response is released when the consumer stops reading.
    await iterator.return?.(undefined)
  })

  it('sends service_tier with the wire model id for a fast alias', async () => {
    const { calls } = await run(TEXT_TRANSCRIPT, { model: FAST_MODEL })

    expect(calls[0]?.body.model).toBe(MODEL)
    expect(calls[0]?.body.service_tier).toBe('priority')
  })

  it('sends the configured wire spelling and honours the route fast default', async () => {
    const { calls, fetchImpl } = stubFetch(TEXT_TRANSCRIPT)
    const adapter = new NowCodingAdapter({ options: () => options({ fast: true, fastServiceTier: 'fast' }), fetchImpl })
    await collect(adapter.stream(request()))

    expect(calls[0]?.body.model).toBe(MODEL)
    expect(calls[0]?.body.service_tier).toBe('fast')
  })

  it('omits service_tier entirely when the request is not fast', async () => {
    const { calls } = await run(TEXT_TRANSCRIPT)

    expect(calls[0]?.body.model).toBe(MODEL)
    expect(calls[0]?.body.service_tier).toBeUndefined()
    expect(Object.hasOwn(calls[0]?.body ?? {}, 'service_tier')).toBe(false)
  })

  it('drops the fast tier for a model the catalog marks as having none', async () => {
    const catalog: readonly NowCodingCatalogModel[] = [
      { id: MODEL, name: 'GPT-5.4', contextWindow: 1_000, maxTokens: 100, input: ['text'] },
    ]
    const { calls, fetchImpl } = stubFetch(TEXT_TRANSCRIPT)
    const adapter = new NowCodingAdapter({ options: () => options({ catalog, fast: true }), fetchImpl })
    await collect(adapter.stream(request({ model: FAST_MODEL })))

    expect(calls[0]?.body.model).toBe(MODEL)
    expect(Object.hasOwn(calls[0]?.body ?? {}, 'service_tier')).toBe(false)
  })

  it('maps the selected reasoning effort through the catalog table', async () => {
    const { calls } = await run(TEXT_TRANSCRIPT, { reasoningEffort: ReasoningEffortId('high') })

    expect(calls[0]?.body.reasoning_effort).toBe('high')
  })

  it('sends no reasoning field for a model that declares only disabled reasoning', async () => {
    const { calls } = await run(TEXT_TRANSCRIPT, { model: 'grok-4.6' })

    expect(calls[0]?.body.reasoning_effort).toBeUndefined()
  })

  it('refuses an effort the exact model does not offer instead of dropping it', async () => {
    const catalog: readonly NowCodingCatalogModel[] = [
      {
        id: MODEL, name: 'GPT-5.4', contextWindow: 1_000, maxTokens: 100, input: ['text'], reasoningEfforts: false,
      },
    ]
    const { calls, fetchImpl } = stubFetch(TEXT_TRANSCRIPT)
    const adapter = new NowCodingAdapter({ options: () => options({ catalog }), fetchImpl })

    await expect(collect(adapter.stream(request({ reasoningEffort: ReasoningEffortId('high') }))))
      .rejects.toMatchObject({ code: 'UNSUPPORTED_REASONING_EFFORT' })
    expect(calls).toHaveLength(0)
  })

  it('refuses an image occurrence rather than dropping the attachment', async () => {
    const { calls, fetchImpl } = stubFetch(TEXT_TRANSCRIPT)
    const image = {
      type: 'image',
      attachment: { attachmentId: 'sha256:abc', width: 1, height: 1, bytes: 1, mediaType: 'image/png' },
    } as unknown as ContentBlock
    const adapter = new NowCodingAdapter({ options: () => options(), fetchImpl })

    await expect(collect(adapter.stream(request({ messages: [{ role: 'user', content: [image] }] }))))
      .rejects.toMatchObject({ code: 'UNSUPPORTED_CONTENT' })
    expect(calls).toHaveLength(0)
  })

  it('refuses a stop list longer than the wire accepts', async () => {
    const { calls, fetchImpl } = stubFetch(TEXT_TRANSCRIPT)
    const adapter = new NowCodingAdapter({ options: () => options(), fetchImpl })

    await expect(collect(adapter.stream(request({ stop: ['a', 'b', 'c', 'd', 'e'] }))))
      .rejects.toMatchObject({ code: 'UNSUPPORTED_OPTION' })
    expect(calls).toHaveLength(0)
  })

  it('serializes the system slot, tools, tool calls, and tool results', async () => {
    const { calls } = await run(TEXT_TRANSCRIPT, {
      system: 'system prompt',
      messages: [
        user('run it'),
        {
          role: 'assistant',
          id: 'm2',
          source: { kind: 'model', provider: 'nowcoding', model: MODEL },
          content: [{ type: 'tool-call', id: 'call_9', name: 'bash', arguments: '{"command":"ls"}' }],
        },
        {
          role: 'tool',
          id: 'm3',
          source: { kind: 'tool', callId: 'call_9' },
          toolCallId: 'call_9',
          content: [{ type: 'text', text: 'failed' }],
          isError: true,
        },
      ] as GenerateOptions['messages'],
      tools: [{ name: 'bash', description: 'Run a command', parameters: { type: 'object' } }] as ToolSchema[],
    })

    expect(calls[0]?.body.messages).toEqual([
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'run it' },
      {
        role: 'assistant',
        content: '',
        tool_calls: [{ id: 'call_9', type: 'function', function: { name: 'bash', arguments: '{"command":"ls"}' } }],
      },
      { role: 'tool', tool_call_id: 'call_9', content: '[tool error] failed' },
    ])
    expect(calls[0]?.body.tools).toEqual([
      { type: 'function', function: { name: 'bash', description: 'Run a command', parameters: { type: 'object' } } },
    ])
  })

  it('reads the configuration once per request so a settings change applies to the next one', async () => {
    const first = stubFetch(TEXT_TRANSCRIPT)
    const second = stubFetch(TEXT_TRANSCRIPT)
    let current = options({ baseURL: 'https://first.example/v1' })
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> =>
      current.baseURL.includes('first')
        ? first.fetchImpl(input, init)
        : second.fetchImpl(input, init)) as typeof fetch
    const adapter = new NowCodingAdapter({ options: () => current, fetchImpl })

    await collect(adapter.stream(request()))
    current = options({ baseURL: 'https://second.example/v1' })
    await collect(adapter.stream(request()))

    expect(first.calls[0]?.url).toBe('https://first.example/v1/chat/completions')
    expect(second.calls[0]?.url).toBe('https://second.example/v1/chat/completions')
  })
})

describe('NowCodingAdapter failures', () => {
  it('throws LlmError UNAUTHORIZED for HTTP 401 before any event is read', async () => {
    const body = { error: { message: 'invalid api key', type: 'invalid_request_error' } }
    const { calls, fetchImpl } = stubFailure(401, body)
    const adapter = new NowCodingAdapter({ options: () => options(), fetchImpl })

    const error: unknown = await collect(adapter.stream(request())).catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(LlmError)
    expect(error).toMatchObject({ code: 'UNAUTHORIZED', failure: { status: 401, message: 'invalid api key' } })
    expect(calls).toHaveLength(1)
  })

  it('classifies an exhausted balance as QUOTA', async () => {
    const { fetchImpl } = stubFailure(402, { error: { code: 'insufficient_quota', message: 'no balance' } })
    const adapter = new NowCodingAdapter({ options: () => options(), fetchImpl })

    await expect(collect(adapter.stream(request())))
      .rejects.toMatchObject({ code: 'QUOTA', failure: { status: 402 } })
  })

  it('classifies a rate limit as RATE_LIMIT with its retry delay', async () => {
    const headers = { 'content-type': 'application/json', 'retry-after': '2' }
    const fetchImpl = (async (): Promise<Response> =>
      new Response(JSON.stringify({ error: { message: 'slow down' } }), { status: 429, headers })) as typeof fetch
    const adapter = new NowCodingAdapter({ options: () => options(), fetchImpl })

    await expect(collect(adapter.stream(request())))
      .rejects.toMatchObject({ code: 'RATE_LIMIT', failure: { status: 429, providerRetryAfterMs: 2000 } })
  })

  it('classifies any other non-success response as PROVIDER_ERROR', async () => {
    const { fetchImpl } = stubFailure(500, { error: { message: 'upstream exploded' } })
    const adapter = new NowCodingAdapter({ options: () => options(), fetchImpl })

    await expect(collect(adapter.stream(request())))
      .rejects.toMatchObject({ code: 'PROVIDER_ERROR', failure: { status: 500 } })
  })

  it('classifies a connection failure as TRANSPORT', async () => {
    const fetchImpl = (async (): Promise<Response> => { throw new TypeError('network down') }) as typeof fetch
    const adapter = new NowCodingAdapter({ options: () => options(), fetchImpl })

    await expect(collect(adapter.stream(request()))).rejects.toMatchObject({ code: 'TRANSPORT' })
  })

  it('classifies a request that outlives its timeout as TIMEOUT', async () => {
    const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit): Promise<Response> =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
      })) as typeof fetch
    const adapter = new NowCodingAdapter({ options: () => options({ requestTimeoutMs: 5 }), fetchImpl })

    await expect(collect(adapter.stream(request()))).rejects.toMatchObject({ code: 'TIMEOUT' })
  })

  it('throws STREAM_CLOSED when the body ends before the channel finished', async () => {
    const { fetchImpl } = stubFetch(sse([textDelta('truncated')]))
    const adapter = new NowCodingAdapter({ options: () => options(), fetchImpl })

    // The deltas stream normally; only the missing terminal entry is a failure.
    await expect(collect(adapter.stream(request()))).rejects.toMatchObject({ code: 'STREAM_CLOSED' })
  })

  it('throws EMPTY_RESPONSE when the channel stops without any content', async () => {
    const { fetchImpl } = stubFetch(sse([chunk([{ index: 0, delta: {}, finish_reason: 'stop' }])]))
    const adapter = new NowCodingAdapter({ options: () => options(), fetchImpl })

    await expect(collect(adapter.stream(request()))).rejects.toMatchObject({ code: 'EMPTY_RESPONSE' })
  })
})

describe('NowCodingAdapter metadata', () => {
  it('delegates provider, model, and catalog answers to the configuration snapshot', async () => {
    const adapter = new NowCodingAdapter(() => options())

    expect(adapter.providerInfo('nowcoding')).toEqual({ id: 'nowcoding', name: 'NowCoding' })
    expect(await adapter.resolveModel('nowcoding', MODEL)).toMatchObject({
      provider: 'nowcoding',
      id: MODEL,
      context: { contextWindow: 400_000 },
      defaultMaxTokens: 128_000,
    })
    expect(await adapter.resolveModel('nowcoding', 'unknown-model')).toEqual({
      provider: 'nowcoding',
      id: 'unknown-model',
      name: 'unknown-model',
    })
    const models = await adapter.listModels('nowcoding')
    expect(models.map(model => model.id)).toContain(FAST_MODEL)
    expect(models.every(model => model.provider === 'nowcoding')).toBe(true)
  })

  it('reports the configured display name', () => {
    expect(new NowCodingAdapter(() => options({ displayName: 'Gateway' })).providerInfo('nowcoding'))
      .toEqual({ id: 'nowcoding', name: 'Gateway' })
  })
})
/** A body that delivers pre-encoded chunks exactly as given, boundaries included. */
function bodyOf(chunks: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
}

describe('SSE framing', () => {
  it('joins frames split across chunk boundaries and stops at [DONE]', async () => {
    // The terminator between the two data lines of frame one never arrives, and
    // a comment-only frame sits between the two events.
    const chunks = [
      'data: {"a":1}\n',
      '\ndata: {"b":2}\n\n',
      ': heartbeat\n\n',
      'data: [DONE]\n\ndata: {"c":3}\n',
      '\n',
    ]
    const events: string[] = []
    for await (const event of parseSse(bodyOf(chunks))) events.push(event)

    // The heartbeat frame carries no data and never becomes an event, and the
    // payload after [DONE] is never read.
    expect(events).toEqual(['{"a":1}', '{"b":2}'])
  })

  it('reassembles a multi-byte character split across chunk boundaries', async () => {
    const encoded = new TextEncoder().encode('data: {"text":"世界"}\n\n')
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        // Split inside the three-byte sequence for 世.
        controller.enqueue(encoded.slice(0, 16))
        controller.enqueue(encoded.slice(16))
        controller.close()
      },
    })
    const events: string[] = []
    for await (const event of parseSse(body)) events.push(event)

    expect(events).toEqual(['{"text":"世界"}'])
  })

  it('honours bare CR line endings and discards an unterminated tail', async () => {
    const body = bodyOf(['data: {"a":1}\r\rdata: {"b":2}', '\r\r'])
    const events: string[] = []
    for await (const event of parseSse(body)) events.push(event)

    expect(events).toEqual(['{"a":1}', '{"b":2}'])
  })
})

describe('ChatStreamTranslator', () => {
  /** Feed one payload list through the translator and collect its chunks. */
  async function translate(payloads: readonly string[]): Promise<StreamChunk[]> {
    async function* events(): AsyncGenerator<string> {
      yield* payloads
    }
    const translator = new ChatStreamTranslator(events())
    const chunks: StreamChunk[] = []
    while (true) {
      const next = await translator.next()
      if (next.done) break
      chunks.push(next.value)
    }
    return chunks
  }

  it('reports the terminal outcome it translated', async () => {
    const usage = { prompt_tokens: 4, completion_tokens: 1 }
    const translator = new ChatStreamTranslator((async function* () {
      yield JSON.stringify({ choices: [{ delta: { content: 'hi' } }] })
      yield JSON.stringify({ choices: [{ delta: {}, finish_reason: 'length' }], usage })
    })())
    while (!(await translator.next()).done) continue

    expect(translator.translation).toEqual({
      reason: { kind: 'max-tokens' },
      usage: { inputTokens: 4, outputTokens: 1, totalTokens: 5 },
    })
  })

  it('throws MALFORMED_RESPONSE for an undecodable payload', async () => {
    await expect(translate(['not json'])).rejects.toMatchObject({ code: 'MALFORMED_RESPONSE' })
  })

  it('carries no chunk past the finish it produced', async () => {
    const chunks = await translate([
      JSON.stringify({ choices: [{ delta: { content: 'hi' } }] }),
      JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
      JSON.stringify({ choices: [{ delta: { content: 'after finish' } }] }),
    ])

    // The trailing content never becomes a chunk: the finish already settled
    // the response, and nothing may follow the terminal chunk.
    expect(chunks.map(chunk => chunk.type)).toEqual(['block-start', 'text-delta', 'block-end', 'finish'])
    expect(JSON.stringify(chunks)).not.toContain('after finish')
  })

  it('abandons the stream without closing blocks when the consumer stops early', async () => {
    const translator = new ChatStreamTranslator((async function* () {
      yield JSON.stringify({ choices: [{ delta: { content: 'partial' } }] })
    })())
    expect((await translator.next()).value).toEqual({ type: 'block-start', index: 0, blockType: 'text' })
    expect((await translator.next()).value).toEqual({ type: 'text-delta', index: 0, text: 'partial' })
    expect((await translator.return()).done).toBe(true)
    expect((await translator.next()).done).toBe(true)
  })
})
