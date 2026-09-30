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
export declare function serialize(options: GenerateOptions, context: SerializeContext): WireRequest;
