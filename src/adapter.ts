/**
 * The NowCoding provider route: one OpenAI-compatible Chat Completions stream
 * per model call.
 *
 * Failure paths, decided per class:
 *
 * - Transport and protocol failures are THROWN from {@link NowCodingAdapter.stream}
 *   as `LlmError` with the stable codes documented on `transport.ts` and
 *   `translate.ts`. `LlmRuntime` normalizes a throw into a terminal
 *   `finish { kind: 'error' | 'aborted' }`, so consumers see one protocol.
 * - The gateway reports no failure in band: every error it can express is an
 *   HTTP status or a non-JSON body, both of which precede the event stream. This
 *   adapter therefore never ends a stream with `finish { kind: 'error' }`
 *   itself; a consumer that sees one received it from `LlmRuntime`.
 *
 * Responses carry no `replayState`. The OpenAI wire format has no
 * provider-issued signature or response id that a follow-up request must echo —
 * tool calls replay from their id, name, and raw argument string, which are
 * already durable message content — so an envelope would add bytes the next
 * request never reads. `wireModelId` therefore also serves as the model
 * identity in every rebuilt request.
 *
 * @module @elves-ai/dsh-llm-nowcoding/adapter
 */

import { LlmAdapter, LlmError } from '@deepseek-ai/dsh-llm'
import type {
  GenerateOptions, LlmModelInfo, LlmProviderInfo, LlmResolvedModelInfo, StreamChunk,
} from '@deepseek-ai/dsh-llm'
import type { NowCodingResolvedOptions } from './config.ts'
import { listSelectableModels, resolveModelInfo } from './models.ts'
import { serialize } from './serialize.ts'
import { parseSse } from './sse.ts'
import { postChatCompletion } from './transport.ts'
import { ChatStreamTranslator } from './translate.ts'

/** Everything the adapter reads from outside itself. */
export interface NowCodingAdapterOptions {
  /**
   * Current configuration, read once at the start of every operation so a
   * settings change applies to the next request instead of the running one.
   */
  options: () => NowCodingResolvedOptions
  /** Transport override for tests and for deployments that bring their own. */
  fetchImpl?: typeof fetch
}

/** NowCoding gateway adapter, speaking OpenAI Chat Completions over SSE. */
export class NowCodingAdapter extends LlmAdapter {
  private readonly settings: () => NowCodingResolvedOptions
  private readonly fetchImpl: typeof fetch | undefined

  /**
   * @param options - either the current-configuration reader, or that reader
   *   plus a transport override.
   */
  constructor(options: () => NowCodingResolvedOptions)
  /**
   * @param options - the current-configuration reader and a transport override.
   */
  constructor(options: NowCodingAdapterOptions)
  constructor(input: (() => NowCodingResolvedOptions) | NowCodingAdapterOptions) {
    super()
    if (typeof input === 'function') {
      this.settings = input
      this.fetchImpl = undefined
    } else {
      this.settings = input.options
      this.fetchImpl = input.fetchImpl
    }
  }

  /**
   * Describe this route.
   * @param provider - the registered provider route.
   * @returns the route key with the configured display name.
   */
  override providerInfo(provider: string): LlmProviderInfo {
    return { id: provider, name: this.settings().displayName }
  }

  /**
   * List the model picker's entries, fast aliases included, narrowed to the
   * configured `visibleModels` allowlist when one is set.
   * @param provider - one provider route owned by this adapter.
   * @returns one entry per selectable row, in catalog order.
   */
  override listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    const settings = this.settings()
    return Promise.resolve(listSelectableModels(provider, settings.catalog, settings.visibleModels))
  }

  /**
   * Resolve every attribute known about one exact model.
   * @param provider - one provider route owned by this adapter.
   * @param model - the exact model id requested.
   * @returns the catalog metadata, or bare identity for a model the catalog does not describe.
   */
  override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return Promise.resolve(resolveModelInfo({ provider, model, catalog: this.settings().catalog }))
  }

  /**
   * Stream one model call.
   * @param options - the fully assembled request; `options.signal` cancels both the
   *   request and the response stream, and the timeout covers the whole response.
   * @returns the translated chunk stream, obeying the protocol obligations documented
   *   on `translate.ts`.
   * @throws {LlmError} with a stable code when the request, the transport, or the
   *   provider protocol fails; see the module JSDoc for why nothing is reported in band.
   */
  override stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    return this.generate(options)
  }

  private async * generate(options: GenerateOptions): AsyncGenerator<StreamChunk> {
    // One snapshot per operation: the endpoint, credential, catalog, and timeout
    // of this request cannot change halfway through it.
    const settings = this.settings()
    const consumer = new AbortController()
    const signal = options.signal === undefined
      ? consumer.signal
      : AbortSignal.any([consumer.signal, options.signal])
    let translator: ChatStreamTranslator | undefined
    let dispose: (() => void) | undefined
    try {
      signal.throwIfAborted()
      const body = serialize(options, {
        catalog: settings.catalog,
        fast: settings.fast,
        fastServiceTier: settings.fastServiceTier,
      })
      const response = await postChatCompletion({
        baseURL: settings.baseURL,
        apiKey: settings.apiKey,
        body,
        signal,
        timeoutMs: settings.requestTimeoutMs,
        ...this.fetchImpl === undefined ? {} : { fetchImpl: this.fetchImpl },
      })
      dispose = response.dispose
      translator = new ChatStreamTranslator(parseSse(response.body))
      while (true) {
        const next = await translator.next()
        if (next.done) return
        yield next.value
      }
    } catch (error) {
      if (error instanceof LlmError) throw error
      if (options.signal?.aborted === true) {
        throw new LlmError('NowCoding request aborted', 'ABORTED', { cause: error })
      }
      throw new LlmError('NowCoding transport failed', 'TRANSPORT', { cause: error })
    } finally {
      // A consumer that stops early leaves an open response and a live timer;
      // abandoning the translator keeps it from closing blocks nobody reads.
      // Cleanup failures cannot replace the outcome that is already settling.
      await translator?.return().catch(() => undefined)
      try {
        dispose?.()
      } catch (_responseAlreadyClosed) {
        // Aborting an already-settled response cannot change its outcome.
      }
      consumer.abort()
    }
  }
}
