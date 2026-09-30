/**
 * Configuration schema and resolution for the NowCoding provider route.
 *
 * Every deployment-varying choice is a validated `Config` field, and every
 * scalar field is `volatile`: the harness rewrites the profile patch when a
 * settings page saves, the field reference the plugin already holds reads the
 * new value, and the next request serves it without a restart. `apply` never
 * captures a value — it reads `.get()` at the start of each operation, which is
 * what makes a settings commit reach the next request.
 *
 * The structural fields (`models`, `modelOverrides`, `hiddenModels`) are
 * volatile too, so a catalog correction applies as soon as it is saved.
 *
 * @module @elves-ai/dsh-llm-nowcoding/config
 */

import type { Context, Volatile } from '@deepseek-ai/cordis'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import z from '@deepseek-ai/schemastery'
import {
  NOWCODING_BUILTIN_CATALOG,
  type NowCodingCatalogModel,
  type NowCodingModality,
  type NowCodingReasoningEfforts,
} from './catalog.ts'
import {
  NOWCODING_DEFAULT_API_KEY_ENV,
  NOWCODING_DEFAULT_BASE_URL,
  NOWCODING_DEFAULT_QUOTA_REFRESH_SECONDS,
  NOWCODING_MIN_QUOTA_REFRESH_SECONDS,
  NOWCODING_SETTINGS_NAMESPACE,
  type NowCodingFastServiceTier,
} from './settings-shared.ts'

/** Provider route this plugin registers on `ctx.llm`. */
export const NOWCODING_PROVIDER_ROUTE = 'nowcoding'

/** Name shown by selectors when configuration names none. */
export const NOWCODING_DEFAULT_DISPLAY_NAME = 'NowCoding'

/** Context capacity assumed for a model neither configuration nor the catalog sizes. */
export const DEFAULT_CONTEXT_WINDOW = 262_144

/** Output capability assumed for a model neither configuration nor the catalog sizes. */
export const DEFAULT_MAX_TOKENS = 32_768

/** Per-request timeout; a coding turn on a reasoning model can legitimately run long. */
export const NOWCODING_DEFAULT_REQUEST_TIMEOUT_MS = 300_000

/** Input types assumed for a model that declares none. */
const DEFAULT_INPUT: readonly NowCodingModality[] = ['text']

/** Fields a configuration entry may reshape on one catalog model. */
export interface NowCodingModelOverride {
  /** Display name for selectors; defaults to the shipped name, then the id. */
  name?: string
  /** Maximum combined request and response context in tokens. */
  contextWindow?: number
  /** Output cap materialized when a caller proposes none. */
  maxTokens?: number
  /** Accepted input types. */
  input?: readonly NowCodingModality[]
  /** Selectable reasoning levels, or `false` for a non-reasoning model. */
  reasoningEfforts?: NowCodingReasoningEfforts
  /** Reasoning level used when a caller selects none. */
  defaultReasoningEffort?: string
  /** Whether the gateway accepts a fast `service_tier` for this model. */
  fast?: boolean
  /** One-line user-facing distinction shown beside the name. */
  description?: string
}

/** One entry of a route `models` list: an override plus the wire model id. */
export interface NowCodingModelSpec extends NowCodingModelOverride {
  /** Model id sent to the gateway. */
  id: string
}

/**
 * The catalog-shaping subset of a configuration, as plain values.
 *
 * Resolution reads it once per operation; separating it from the schema keeps
 * catalog resolution a pure function that a test can call with literal input.
 */
export interface NowCodingCatalogConfig {
  /** Replaces the shipped catalog wholesale when present. */
  models?: readonly NowCodingModelSpec[] | undefined
  /** Reshapes individual shipped models; ignored beside an explicit `models` list. */
  modelOverrides?: Readonly<Record<string, NowCodingModelOverride>> | undefined
  /** Ids kept out of the picker without leaving the catalog. */
  hiddenModels?: readonly string[] | undefined
  /** Context capacity for a model neither the entry nor the shipped catalog sizes. */
  defaultContextWindow?: number | undefined
  /** Output capability for a model neither the entry nor the shipped catalog sizes. */
  defaultMaxTokens?: number | undefined
}

/**
 * Plugin configuration. Every field is optional in the composition entry; the
 * schema fills the defaults, and the harness hands back a live reference per
 * volatile field.
 */
export interface Config {
  /**
   * NowCoding API key literal. Written by a settings page as a secret: it never
   * rides a settings response, so surfaces only learn whether one is set.
   */
  apiKey: Volatile<string | undefined>
  /** Environment variable the key falls back to; naming it lets a second profile point at a second account. */
  apiKeyEnv: Volatile<string>
  /** Endpoint base, including the `/v1` segment. */
  baseURL: Volatile<string>
  /** Name shown by selectors and diagnostics. */
  displayName: Volatile<string>
  /** Route-level default for the GPT fast tier. */
  fast: Volatile<boolean>
  /** Wire spelling sent when fast mode is on. */
  fastServiceTier: Volatile<NowCodingFastServiceTier>
  /** Whether the sidebar quota card is shown. */
  quotaCard: Volatile<boolean>
  /** Dashboard access token; required to read a monthly plan's allowance. */
  panelToken: Volatile<string | undefined>
  /** Dashboard user id sent as `New-Api-User`; required by the console chain. */
  panelUserId: Volatile<string | undefined>
  /** Seconds between balance refreshes in the sidebar card. */
  quotaRefreshSeconds: Volatile<number>
  /**
   * Settings namespace this plugin's own Loader entry carries.
   *
   * The harness keys a plugin's configuration section by its Loader entry id,
   * so this must equal the `id` of the row that mounts the plugin. It is a
   * field rather than a constant because a profile may mount the same plugin
   * twice under different ids, and then each instance edits its own section.
   */
  settingsNs: Volatile<string>
  /** Replaces the shipped catalog wholesale when present. */
  models: Volatile<NowCodingModelSpec[] | undefined>
  /** Reshapes individual shipped models; ignored beside an explicit `models` list. */
  modelOverrides: Volatile<Record<string, NowCodingModelOverride> | undefined>
  /** Ids kept out of the picker without leaving the catalog. */
  hiddenModels: Volatile<string[] | undefined>
  /** Context capacity for a model neither the entry nor the shipped catalog sizes. */
  defaultContextWindow: Volatile<number>
  /** Output capability for a model neither the entry nor the shipped catalog sizes. */
  defaultMaxTokens: Volatile<number>
  /** Per-request timeout in milliseconds. */
  requestTimeoutMs: Volatile<number>
}

/** Input types the schema accepts. */
const MODALITIES = ['text', 'image'] as const

/** Reasoning levels: a mapping of offered level to wire spelling, or `false`. */
const reasoningEfforts = z.union([z.const(false), z.dict(z.string())])

/** Fields shared by a `models` entry and a `modelOverrides` entry. */
const overrideFields = {
  name: z.string(),
  contextWindow: z.number().step(1).min(1),
  maxTokens: z.number().step(1).min(1),
  input: z.array(z.union(MODALITIES)),
  reasoningEfforts,
  defaultReasoningEffort: z.string(),
  fast: z.boolean(),
  description: z.string(),
}

const modelOverride = z.object(overrideFields)

const modelSpec = z.object({
  id: z.string().required(),
  ...overrideFields,
})

/**
 * Composition and settings schema for the NowCoding provider route.
 *
 * Every field carries its default so a configuration surface renders the value
 * the route actually serves, rather than an empty control that reads as "unset".
 */
export const Config = z.object({
  apiKey: z.string().role('secret').volatile(),
  // A credential-reference field, so a configuration surface treats it as a
  // name to resolve rather than a secret to store.
  apiKeyEnv: z.string().role('credential-ref').default(NOWCODING_DEFAULT_API_KEY_ENV).volatile(),
  baseURL: z.string().default(NOWCODING_DEFAULT_BASE_URL).volatile(),
  displayName: z.string().default(NOWCODING_DEFAULT_DISPLAY_NAME).volatile(),
  fast: z.boolean().default(false).volatile(),
  fastServiceTier: z.union(['priority', 'fast']).default('priority').volatile(),
  quotaCard: z.boolean().default(true).volatile(),
  // The console chain rejects the `sk-` model key, so a plan balance needs its
  // own credential; both fields are write-only from a settings surface.
  panelToken: z.string().role('secret').volatile(),
  panelUserId: z.string().volatile(),
  quotaRefreshSeconds: z.number().step(1).min(NOWCODING_MIN_QUOTA_REFRESH_SECONDS)
    .default(NOWCODING_DEFAULT_QUOTA_REFRESH_SECONDS).volatile(),
  settingsNs: z.string().default(NOWCODING_SETTINGS_NAMESPACE).volatile(),
  models: z.array(modelSpec).volatile(),
  modelOverrides: z.dict(modelOverride).volatile(),
  hiddenModels: z.array(z.string()).volatile(),
  defaultContextWindow: z.number().step(1).min(1).default(DEFAULT_CONTEXT_WINDOW).volatile(),
  defaultMaxTokens: z.number().step(1).min(1).default(DEFAULT_MAX_TOKENS).volatile(),
  requestTimeoutMs: z.number().step(1).min(1).default(NOWCODING_DEFAULT_REQUEST_TIMEOUT_MS).volatile(),
})

/** One model as the adapter serves it: fully defaulted, no optional capacity. */
export interface ResolvedNowCodingModel extends NowCodingCatalogModel {
  /** Accepted input types, defaulted to text. */
  input: readonly NowCodingModality[]
}

/**
 * Build the route catalog from configuration.
 *
 * A `models` list replaces the shipped catalog; each entry defaults its unset
 * fields from the shipped model of the same id, so narrowing the route to two
 * models or correcting one capacity stays a one-line edit. An override naming
 * an id the catalog does not carry is added rather than refused: a gateway
 * serves models newer than any snapshot, and the entry carries what the adapter
 * needs. `hiddenModels` removes ids from the result without deleting their
 * catalog entry.
 *
 * @param config - the catalog-shaping configuration.
 * @returns the served catalog in configuration order.
 */
export function effectiveCatalog(config: NowCodingCatalogConfig): readonly ResolvedNowCodingModel[] {
  // A configured list carries only what the user wrote; a shipped entry carries
  // its own name and capacity. Both flow through the same defaulting chain.
  const base: readonly (NowCodingCatalogModel | NowCodingModelSpec)[] = config.models ?? NOWCODING_BUILTIN_CATALOG
  const overrides = config.models === undefined ? config.modelOverrides ?? {} : {}
  const defaultContextWindow = config.defaultContextWindow ?? DEFAULT_CONTEXT_WINDOW
  const defaultMaxTokens = config.defaultMaxTokens ?? DEFAULT_MAX_TOKENS
  const hidden = new Set(config.hiddenModels ?? [])

  const entries = base.map((entry): ResolvedNowCodingModel => {
    const override = overrides[entry.id] ?? {}
    const shipped = NOWCODING_BUILTIN_CATALOG.find(candidate => candidate.id === entry.id)
    return {
      id: entry.id,
      name: override.name ?? entry.name ?? shipped?.name ?? entry.id,
      contextWindow: override.contextWindow ?? entry.contextWindow ?? shipped?.contextWindow ?? defaultContextWindow,
      maxTokens: override.maxTokens ?? entry.maxTokens ?? shipped?.maxTokens ?? defaultMaxTokens,
      input: override.input ?? entry.input ?? shipped?.input ?? DEFAULT_INPUT,
      reasoningEfforts: override.reasoningEfforts ?? entry.reasoningEfforts ?? shipped?.reasoningEfforts,
      defaultReasoningEffort: override.defaultReasoningEffort
        ?? entry.defaultReasoningEffort
        ?? shipped?.defaultReasoningEffort,
      fast: override.fast ?? entry.fast ?? shipped?.fast,
      description: override.description ?? entry.description ?? shipped?.description,
    }
  })
  for (const [id, override] of Object.entries(overrides)) {
    if (entries.some(entry => entry.id === id)) continue
    entries.push({
      id,
      name: override.name ?? id,
      contextWindow: override.contextWindow ?? defaultContextWindow,
      maxTokens: override.maxTokens ?? defaultMaxTokens,
      input: override.input ?? DEFAULT_INPUT,
      reasoningEfforts: override.reasoningEfforts,
      defaultReasoningEffort: override.defaultReasoningEffort,
      fast: override.fast,
      description: override.description,
    })
  }
  return entries.filter(entry => !hidden.has(entry.id))
}

/** The immutable snapshot one adapter operation serves from. */
export interface NowCodingResolvedOptions {
  /** Credential sent as `Authorization: Bearer`; empty when the route is configured without one. */
  apiKey: string
  /** Endpoint base, including the `/v1` segment. */
  baseURL: string
  /** Name shown by selectors and diagnostics. */
  displayName: string
  /** Route-level fast default. */
  fast: boolean
  /** Wire spelling sent when fast mode is on. */
  fastServiceTier: NowCodingFastServiceTier
  /** The served catalog. */
  catalog: readonly ResolvedNowCodingModel[]
  /** Whether the sidebar quota card is shown. */
  quotaCard: boolean
  /** Dashboard access token; empty leaves the reader on the relay billing pair. */
  panelToken: string
  /** Dashboard user id sent as `New-Api-User`. */
  panelUserId: string
  /** Seconds between balance refreshes. */
  quotaRefreshSeconds: number
  /** Per-request timeout in milliseconds. */
  requestTimeoutMs: number
  /** Settings namespace this instance's configuration section lives under. */
  settingsNs: string
}

/**
 * Resolve the configuration a single operation serves from.
 *
 * A settings literal wins over the environment fallback; an empty one leaves
 * the route configured but keyless, which fails at the first request with a
 * named credential error rather than at load.
 *
 * @param ctx - plugin context, used to read the launch environment.
 * @param config - the live configuration references.
 * @returns the snapshot this operation serves from.
 */
export function resolveNowCodingOptions(ctx: Context, config: Config): NowCodingResolvedOptions {
  const literal = config.apiKey.get()
  const apiKey = typeof literal === 'string' && literal.trim().length > 0 ? literal.trim() : ''
  const envName = config.apiKeyEnv.get()
  const envValue = apiKey.length > 0 ? '' : launchEnvironmentOf(ctx).get(envName)?.value ?? ''
  const baseURL = config.baseURL.get()
  return {
    apiKey: apiKey.length > 0 ? apiKey : envValue,
    baseURL: typeof baseURL === 'string' && baseURL.trim().length > 0 ? baseURL.trim() : NOWCODING_DEFAULT_BASE_URL,
    displayName: config.displayName.get(),
    fast: config.fast.get(),
    fastServiceTier: config.fastServiceTier.get(),
    catalog: effectiveCatalog({
      models: config.models.get(),
      modelOverrides: config.modelOverrides.get(),
      hiddenModels: config.hiddenModels.get(),
      defaultContextWindow: config.defaultContextWindow.get(),
      defaultMaxTokens: config.defaultMaxTokens.get(),
    }),
    quotaCard: config.quotaCard.get(),
    panelToken: config.panelToken.get()?.trim() ?? '',
    panelUserId: config.panelUserId.get()?.trim() ?? '',
    quotaRefreshSeconds: config.quotaRefreshSeconds.get(),
    requestTimeoutMs: config.requestTimeoutMs.get(),
    settingsNs: config.settingsNs.get(),
  }
}
