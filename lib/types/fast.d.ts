/**
 * GPT fast-tier policy.
 *
 * OpenAI's fast mode is requested with a request-body `service_tier`; the
 * gateway forwards it only for channels that enable its own
 * `allow_service_tier` passthrough, and silently strips it otherwise. This
 * module owns the one decision an adapter request needs — whether to put the
 * field on the body — so the adapter never re-derives it.
 *
 * @module @elves-ai/dsh-llm-nowcoding/fast
 */
import { type NowCodingCatalogModel } from './catalog.ts';
import type { NowCodingFastServiceTier } from './settings-shared.ts';
/** What one request should send for the fast tier. */
export interface FastTierDecision {
    /** Whether the request asked for the fast tier, by alias or by route default. */
    readonly requested: boolean;
    /** `service_tier` value for the request body; absent omits the field entirely. */
    readonly serviceTier?: NowCodingFastServiceTier;
    /**
     * Set when a fast request named a model with no fast tier. The field is
     * dropped rather than sent, because a gateway that does not know the model's
     * tier rejects the whole request instead of ignoring the field.
     */
    readonly droppedForModel?: true;
}
/**
 * Decide the fast tier for one request.
 * @param input - the requested model id, the route's fast default, the resolved catalog entry, and the configured wire spelling.
 * @returns the decision; `serviceTier` appears only when the field should be sent.
 */
export declare function decideFastTier(input: {
    modelId: string;
    routeDefault: boolean;
    entry: NowCodingCatalogModel | undefined;
    wireValue: NowCodingFastServiceTier;
}): FastTierDecision;
/**
 * Whether the gateway can serve this model at the fast tier at all.
 * @param entry - the resolved catalog entry.
 * @returns whether a fast request is meaningful for the model.
 */
export declare function modelSupportsFast(entry: NowCodingCatalogModel | undefined): boolean;
