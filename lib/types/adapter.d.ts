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
import { LlmAdapter } from '@deepseek-ai/dsh-llm';
import type { GenerateOptions, LlmModelInfo, LlmProviderInfo, LlmResolvedModelInfo, StreamChunk } from '@deepseek-ai/dsh-llm';
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment';
import type { NowCodingResolvedOptions } from './config.ts';
/** Everything the adapter reads from outside itself. */
export interface NowCodingAdapterOptions {
    /**
     * Current configuration, read once at the start of every operation so a
     * settings change applies to the next request instead of the running one.
     */
    options: () => NowCodingResolvedOptions;
    /** Transport override for tests and for deployments that bring their own. */
    fetchImpl?: typeof fetch;
    /** Current host-owned attachment store, resolved at the start of each request. */
    attachments?: () => Pick<AttachmentStore, 'readImageRequest'> | undefined;
}
/** NowCoding gateway adapter, speaking OpenAI Chat Completions over SSE. */
export declare class NowCodingAdapter extends LlmAdapter {
    private readonly settings;
    private readonly fetchImpl;
    private readonly attachments;
    /**
     * @param options - either the current-configuration reader, or that reader
     *   plus a transport override.
     */
    constructor(options: () => NowCodingResolvedOptions);
    /**
     * @param options - the current-configuration reader and a transport override.
     */
    constructor(options: NowCodingAdapterOptions);
    /**
     * Describe this route.
     * @param provider - the registered provider route.
     * @returns the route key with the configured display name.
     */
    providerInfo(provider: string): LlmProviderInfo;
    /**
     * List the model picker's entries, fast aliases included, narrowed to the
     * configured `visibleModels` allowlist when one is set.
     * @param provider - one provider route owned by this adapter.
     * @returns one entry per selectable row, in catalog order.
     */
    listModels(provider: string): Promise<readonly LlmModelInfo[]>;
    /**
     * Resolve every attribute known about one exact model.
     * @param provider - one provider route owned by this adapter.
     * @param model - the exact model id requested.
     * @returns the catalog metadata, or bare identity for a model the catalog does not describe.
     */
    resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo>;
    /**
     * Stream one model call.
     * @param options - the fully assembled request; `options.signal` cancels both the
     *   request and the response stream, and the timeout covers the whole response.
     * @returns the translated chunk stream, obeying the protocol obligations documented
     *   on `translate.ts`.
     * @throws {LlmError} with a stable code when the request, the transport, or the
     *   provider protocol fails; see the module JSDoc for why nothing is reported in band.
     */
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
    private generate;
}
