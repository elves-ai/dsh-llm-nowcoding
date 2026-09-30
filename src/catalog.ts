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
export type NowCodingModality = 'text' | 'image'

/**
 * Selectable reasoning levels for one model: each key is the level the picker
 * offers and the value is the spelling the request sends, so a gateway with
 * its own vocabulary needs no code change. `false` declares a model with no
 * selectable reasoning at all.
 */
export type NowCodingReasoningEfforts = Readonly<Record<string, string>> | false

/** One model the plugin ships knowledge of. */
export interface NowCodingCatalogModel {
  /** Model id sent to the gateway. */
  id: string
  /** Display name for selectors. */
  name: string
  /** Maximum combined request and response context in tokens. */
  contextWindow: number
  /** Output cap materialized when a caller proposes none. */
  maxTokens: number
  /** Accepted input types. */
  input: readonly NowCodingModality[]
  /** Selectable reasoning levels, or `false` for a non-reasoning model. */
  reasoningEfforts?: NowCodingReasoningEfforts
  /** Reasoning level used when a caller selects none. */
  defaultReasoningEffort?: string
  /**
   * Whether the gateway accepts a fast `service_tier` for this model. Only the
   * OpenAI line has a fast tier; declaring it elsewhere would request a tier
   * the gateway silently strips or rejects.
   */
  fast?: boolean
  /** One-line user-facing distinction shown beside the name. */
  description?: string
}

/** Reasoning levels the OpenAI GPT line accepts, in escalating order.
 *
 * `xhigh` and `max` mirror the gateway's Codex configuration, which serves
 * them identity-mapped beside `high`; a level the picker offers but the wire
 * rejects would fail the request, so the set matches what the gateway's own
 * Codex clients send.
 */
const GPT_REASONING: NowCodingReasoningEfforts = {
  minimal: 'minimal',
  low: 'low',
  medium: 'medium',
  high: 'high',
  xhigh: 'xhigh',
  max: 'max',
}

/** Suffix marking the fast-mode alias of a fast-capable model id. */
export const FAST_MODEL_SUFFIX = '-fast'

/**
 * The shipped catalog, snapshotted from the gateway's published pricing on
 * 2026-09-30. Keep ids version-exact and lowercase: a near miss surfaces as a
 * provider error on the first request rather than as a corrected model.
 */
export const NOWCODING_BUILTIN_CATALOG: readonly NowCodingCatalogModel[] = [
  {
    id: 'gpt-6-astra',
    name: 'GPT-6 Astra',
    description: 'OpenAI flagship; fast mode available',
    contextWindow: 400_000,
    maxTokens: 128_000,
    input: ['text', 'image'],
    reasoningEfforts: GPT_REASONING,
    defaultReasoningEffort: 'medium',
    fast: true,
  },
  {
    id: 'gpt-6-sol',
    name: 'GPT-6 Sol',
    description: 'OpenAI mainline; fast mode available',
    contextWindow: 400_000,
    maxTokens: 128_000,
    input: ['text', 'image'],
    reasoningEfforts: GPT_REASONING,
    defaultReasoningEffort: 'medium',
    fast: true,
  },
  {
    id: 'gpt-6.1-sol',
    name: 'GPT-6.1 Sol',
    description: 'OpenAI mainline; fast mode available',
    contextWindow: 400_000,
    maxTokens: 128_000,
    input: ['text', 'image'],
    reasoningEfforts: GPT_REASONING,
    defaultReasoningEffort: 'medium',
    fast: true,
  },
  {
    id: 'gpt-5.6-sol',
    name: 'GPT-5.6 Sol',
    description: 'OpenAI mainline; fast mode available',
    contextWindow: 400_000,
    maxTokens: 128_000,
    input: ['text', 'image'],
    reasoningEfforts: GPT_REASONING,
    defaultReasoningEffort: 'medium',
    fast: true,
  },
  {
    id: 'gpt-5.6-terra',
    name: 'GPT-5.6 Terra',
    description: 'OpenAI budget tier; fast mode available',
    contextWindow: 400_000,
    maxTokens: 128_000,
    input: ['text', 'image'],
    reasoningEfforts: GPT_REASONING,
    defaultReasoningEffort: 'medium',
    fast: true,
  },
  {
    id: 'gpt-5.6-luna',
    name: 'GPT-5.6 Luna',
    description: 'Gateway redirects requests to gpt-5.6-terra and bills at the terra rate',
    contextWindow: 400_000,
    maxTokens: 128_000,
    input: ['text', 'image'],
    reasoningEfforts: GPT_REASONING,
    defaultReasoningEffort: 'medium',
    fast: true,
  },
  {
    id: 'gpt-5.5',
    name: 'GPT-5.5',
    description: 'Previous flagship; fast mode available',
    contextWindow: 400_000,
    maxTokens: 128_000,
    input: ['text', 'image'],
    reasoningEfforts: GPT_REASONING,
    defaultReasoningEffort: 'medium',
    fast: true,
  },
  {
    id: 'gpt-5.4',
    name: 'GPT-5.4',
    description: 'Previous mainline; fast mode available',
    contextWindow: 400_000,
    maxTokens: 128_000,
    input: ['text', 'image'],
    reasoningEfforts: GPT_REASONING,
    defaultReasoningEffort: 'medium',
    fast: true,
  },
  {
    id: 'gpt-5.4-mini',
    name: 'GPT-5.4 mini',
    description: 'Low-cost OpenAI tier',
    contextWindow: 400_000,
    maxTokens: 64_000,
    input: ['text', 'image'],
    reasoningEfforts: GPT_REASONING,
    defaultReasoningEffort: 'low',
    fast: true,
  },
  {
    id: 'gpt-5.4-openai-compact',
    name: 'GPT-5.4 Compact',
    description: 'Compact-context variant used by the Codex endpoint',
    contextWindow: 128_000,
    maxTokens: 64_000,
    input: ['text'],
    reasoningEfforts: GPT_REASONING,
    defaultReasoningEffort: 'medium',
  },
  {
    id: 'gpt-5.3-codex',
    name: 'GPT-5.3 Codex',
    description: 'Agentic coding model',
    contextWindow: 400_000,
    maxTokens: 128_000,
    input: ['text', 'image'],
    reasoningEfforts: GPT_REASONING,
    defaultReasoningEffort: 'medium',
  },
  {
    id: 'gpt-5.3-codex-spark',
    name: 'GPT-5.3 Codex Spark',
    description: 'Low-latency agentic coding model',
    contextWindow: 400_000,
    maxTokens: 128_000,
    input: ['text', 'image'],
    reasoningEfforts: GPT_REASONING,
    defaultReasoningEffort: 'medium',
  },
  {
    id: 'codex-auto-review',
    name: 'Codex Auto Review',
    description: 'Gateway-hosted automated review model',
    contextWindow: 400_000,
    maxTokens: 64_000,
    input: ['text'],
    reasoningEfforts: GPT_REASONING,
    defaultReasoningEffort: 'medium',
  },
  {
    id: 'claude-opus-5',
    name: 'Claude Opus 5',
    description: 'Anthropic deep-reasoning model',
    contextWindow: 200_000,
    maxTokens: 64_000,
    input: ['text', 'image'],
    reasoningEfforts: { low: 'low', medium: 'medium', high: 'high' },
    defaultReasoningEffort: 'medium',
  },
  {
    id: 'claude-sonnet-5',
    name: 'Claude Sonnet 5',
    description: 'Anthropic coding default',
    contextWindow: 200_000,
    maxTokens: 64_000,
    input: ['text', 'image'],
    reasoningEfforts: { low: 'low', medium: 'medium', high: 'high' },
    defaultReasoningEffort: 'medium',
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    description: 'Previous Anthropic coding default',
    contextWindow: 200_000,
    maxTokens: 64_000,
    input: ['text', 'image'],
    reasoningEfforts: { low: 'low', medium: 'medium', high: 'high' },
    defaultReasoningEffort: 'medium',
  },
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    description: 'Anthropic fast tier',
    contextWindow: 200_000,
    maxTokens: 32_000,
    input: ['text', 'image'],
    reasoningEfforts: false,
  },
  {
    id: 'grok-4.6',
    name: 'Grok 4.6',
    description: 'xAI flagship',
    contextWindow: 256_000,
    maxTokens: 64_000,
    input: ['text', 'image'],
    reasoningEfforts: false,
  },
  {
    id: 'grok-4.5',
    name: 'Grok 4.5',
    description: 'xAI mainline',
    contextWindow: 256_000,
    maxTokens: 64_000,
    input: ['text', 'image'],
    reasoningEfforts: false,
  },
  {
    id: 'grok-4.3',
    name: 'Grok 4.3',
    description: 'xAI low-cost tier',
    contextWindow: 256_000,
    maxTokens: 64_000,
    input: ['text', 'image'],
    reasoningEfforts: false,
  },
]

/**
 * Whether an id is a fast-mode alias rather than a wire model id.
 * @param id - a catalog or requested model id.
 * @returns whether the id ends with {@link FAST_MODEL_SUFFIX}.
 */
export function isFastAlias(id: string): boolean {
  return id.endsWith(FAST_MODEL_SUFFIX)
}

/**
 * The fast-mode alias id for a fast-capable model.
 * @param id - the wire model id.
 * @returns the alias the model picker offers beside the plain entry.
 */
export function fastModelId(id: string): string {
  return isFastAlias(id) ? id : id + FAST_MODEL_SUFFIX
}

/**
 * The wire model id a requested id resolves to.
 * @param id - a requested id, with or without the fast alias.
 * @returns the id to send to the gateway.
 */
export function wireModelId(id: string): string {
  return isFastAlias(id) ? id.slice(0, -FAST_MODEL_SUFFIX.length) : id
}

/**
 * Look one model up in a catalog, resolving a fast alias to its base entry.
 * @param catalog - the effective catalog, built-in or configuration-supplied.
 * @param id - the requested model id.
 * @returns the entry, or undefined when the catalog does not describe the id.
 */
export function catalogEntry(
  catalog: readonly NowCodingCatalogModel[],
  id: string,
): NowCodingCatalogModel | undefined {
  const wire = wireModelId(id)
  return catalog.find(model => model.id === wire)
}

/**
 * Whether the gateway accepts a fast request for this model.
 * @param entry - the catalog entry the request resolved to.
 * @returns whether a fast `service_tier` may be sent.
 */
export function isFastCapable(entry: NowCodingCatalogModel | undefined): boolean {
  return entry?.fast === true
}

/**
 * Expand a catalog into the entries a model picker offers: every fast-capable
 * model contributes its plain entry plus its fast alias.
 * @param catalog - the effective catalog.
 * @returns selector entries in catalog order, each fast alias after its base.
 */
export function selectorEntries(catalog: readonly NowCodingCatalogModel[]): readonly NowCodingCatalogModel[] {
  const entries: NowCodingCatalogModel[] = []
  for (const model of catalog) {
    entries.push(model)
    if (model.fast !== true) continue
    entries.push({
      ...model,
      id: fastModelId(model.id),
      name: model.name + ' (fast)',
      description: 'Fast mode: same model, up to 2.5x faster, billed at the higher fast rate',
    })
  }
  return entries
}
