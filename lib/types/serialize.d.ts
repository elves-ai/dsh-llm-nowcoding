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
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment';
import type { GenerateOptions } from '@deepseek-ai/dsh-llm';
import { type NowCodingCatalogModel } from './catalog.ts';
import type { NowCodingFastServiceTier } from './settings-shared.ts';
import type { WireRequest } from './wire.ts';
/** Everything serialization needs beyond the request itself. */
export interface SerializeContext {
    /** The served catalog, which owns fast-tier and reasoning eligibility. */
    catalog: readonly NowCodingCatalogModel[];
    /** Route-level fast default. */
    fast: boolean;
    /** Wire spelling sent when fast mode is on. */
    fastServiceTier: NowCodingFastServiceTier;
    /** Host-owned image projection; optional so text-only/headless calls still work. */
    attachments?: Pick<AttachmentStore, 'readImageRequest'>;
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
export declare function serialize(options: GenerateOptions, context: SerializeContext): Promise<WireRequest>;
