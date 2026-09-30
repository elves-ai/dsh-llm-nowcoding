/**
 * The built-in NowCoding model catalog.
 *
 * This list is data, not policy: it lets a fresh install serve a usable model
 * picker before anything is configured. It snapshots the gateway's published
 * `/api/pricing` lineup, which moves as vendors ship models, so every entry is
 * overridable two ways — a route `models` list replaces the catalog wholesale,
 * a `modelOverrides` entry reshapes one model — and the plugin's discovery
 * probe reads the live lineup from the gateway.
 *
 * Model ids are grouped by the gateway's own multipliers rather than by vendor
 * tier, because a group multiplier is what a request actually costs.
 *
 * Fast-capable entries expand into a second selector entry whose id carries
 * the {@link FAST_MODEL_SUFFIX}; picking it sends the same wire model with a
 * fast `service_tier`. The alias never reaches the provider.
 *
 * @module @elves-ai/dsh-llm-nowcoding/catalog
 */
/** An input type a catalog model accepts. */
export type NowCodingModality = 'text' | 'image';
/**
 * Selectable reasoning levels for one model: each key is the level the picker
 * offers and the value is the spelling the request sends, so a gateway with
 * its own vocabulary needs no code change. `false` declares a model with no
 * selectable reasoning at all.
 */
export type NowCodingReasoningEfforts = Readonly<Record<string, string>> | false;
/** One model the plugin ships knowledge of. */
export interface NowCodingCatalogModel {
    /** Model id sent to the gateway. */
    id: string;
    /** Display name for selectors. */
    name: string;
    /** Maximum combined request and response context in tokens. */
    contextWindow: number;
    /** Output cap materialized when a caller proposes none. */
    maxTokens: number;
    /** Accepted input types. */
    input: readonly NowCodingModality[];
    /** Selectable reasoning levels, or `false` for a non-reasoning model. */
    reasoningEfforts?: NowCodingReasoningEfforts;
    /** Reasoning level used when a caller selects none. */
    defaultReasoningEffort?: string;
    /**
     * Whether the gateway accepts a fast `service_tier` for this model. Only the
     * OpenAI line has a fast tier; declaring it elsewhere would request a tier
     * the gateway silently strips or rejects.
     */
    fast?: boolean;
    /** One-line user-facing distinction shown beside the name. */
    description?: string;
}
/** Suffix marking the fast-mode alias of a fast-capable model id. */
export declare const FAST_MODEL_SUFFIX = "-fast";
/**
 * The shipped catalog, snapshotted from the gateway's published pricing on
 * 2026-09-30. Keep ids version-exact and lowercase: a near miss surfaces as a
 * provider error on the first request rather than as a corrected model.
 * GPT capacities/modalities follow https://developers.openai.com/api/docs/models
 * (one official page per exact id); gateway-only aliases remain explicitly unverified.
 */
export declare const NOWCODING_BUILTIN_CATALOG: readonly NowCodingCatalogModel[];
/**
 * Whether an id is a fast-mode alias rather than a wire model id.
 * @param id - a catalog or requested model id.
 * @returns whether the id ends with {@link FAST_MODEL_SUFFIX}.
 */
export declare function isFastAlias(id: string): boolean;
/**
 * The fast-mode alias id for a fast-capable model.
 * @param id - the wire model id.
 * @returns the alias the model picker offers beside the plain entry.
 */
export declare function fastModelId(id: string): string;
/**
 * The wire model id a requested id resolves to.
 * @param id - a requested id, with or without the fast alias.
 * @returns the id to send to the gateway.
 */
export declare function wireModelId(id: string): string;
/**
 * Look one model up in a catalog, resolving a fast alias to its base entry.
 * @param catalog - the effective catalog, built-in or configuration-supplied.
 * @param id - the requested model id.
 * @returns the entry, or undefined when the catalog does not describe the id.
 */
export declare function catalogEntry(catalog: readonly NowCodingCatalogModel[], id: string): NowCodingCatalogModel | undefined;
/**
 * Whether the gateway accepts a fast request for this model.
 * @param entry - the catalog entry the request resolved to.
 * @returns whether a fast `service_tier` may be sent.
 */
export declare function isFastCapable(entry: NowCodingCatalogModel | undefined): boolean;
/**
 * Expand a catalog into the entries a model picker offers: every fast-capable
 * model contributes its plain entry plus its fast alias.
 * @param catalog - the effective catalog.
 * @returns selector entries in catalog order, each fast alias after its base.
 */
export declare function selectorEntries(catalog: readonly NowCodingCatalogModel[]): readonly NowCodingCatalogModel[];
