/**
 * `@elves-ai/dsh-llm-nowcoding`: an unofficial DeepSeek Harness LLM provider
 * plugin for the NowCoding gateway (nowcoding.ai).
 *
 * A function/namespace plugin (NOT a default-export service): a provider does
 * not own the `ctx.llm` key — it registers an adapter INTO the seam's
 * registry, exactly as `@deepseek-ai/dsh-llm-deepseek` does. The key is owned
 * by `@deepseek-ai/dsh-llm`.
 *
 * Three contributions, all effect-based:
 * 1. the `nowcoding` provider route on `ctx.llm`, serving the built-in model
 *    catalog, the GPT fast tier, and reasoning levels;
 * 2. a configurable-provider entry, so configuration surfaces offer the route
 *    and name the section that edits it;
 * 3. the fenced `/nowcoding/api` route, which is how the sidebar quota card
 *    and the client half's detail page read the balance and the settings.
 *
 * Configuration is not registered here. The harness projects the exported
 * `Config` schema into a settings form keyed by the Loader entry id; this
 * plugin turns that projection off, because its client half renders the
 * configuration page itself — on the Plugins page's bundle detail, the seat
 * the host names `plugins.bundle.config` — see `config.ts` for the fields.
 *
 * @module @elves-ai/dsh-llm-nowcoding
 */
import type { Context } from '@deepseek-ai/cordis';
import { type Config as NowCodingConfig } from './config.ts';
export { NowCodingAdapter } from './adapter.ts';
export { Config, DEFAULT_CONTEXT_WINDOW, DEFAULT_MAX_TOKENS, NOWCODING_DEFAULT_DISPLAY_NAME, NOWCODING_DEFAULT_REQUEST_TIMEOUT_MS, NOWCODING_PROVIDER_ROUTE, effectiveCatalog, resolveNowCodingOptions, } from './config.ts';
export type { Config as NowCodingConfig, NowCodingCatalogConfig, NowCodingModelOverride, NowCodingModelSpec, NowCodingResolvedOptions, ResolvedNowCodingModel, } from './config.ts';
export { FAST_MODEL_SUFFIX, NOWCODING_BUILTIN_CATALOG, catalogEntry, fastModelId, isFastAlias, isFastCapable, selectorEntries, wireModelId, } from './catalog.ts';
export type { NowCodingCatalogModel, NowCodingModality, NowCodingReasoningEfforts } from './catalog.ts';
export { decideFastTier, modelSupportsFast } from './fast.ts';
export { listSelectableModels, reasoningInfoFor, resolveModelInfo } from './models.ts';
export { NOWCODING_DEFAULT_QUOTA_TIMEOUT_MS, NowCodingQuotaError, createQuotaReader, normalizeQuota, } from './quota.ts';
export type { NowCodingQuotaErrorCode, NowCodingQuotaReader, NowCodingQuotaSnapshot } from './quota.ts';
export { registerNowCodingSettingsRoutes } from './settings-routes.ts';
export type { NowCodingQuotaView, NowCodingSettingsView } from './settings-routes.ts';
export { NOWCODING_DEFAULT_API_KEY_ENV, NOWCODING_DEFAULT_BASE_URL, NOWCODING_DEFAULT_QUOTA_REFRESH_SECONDS, NOWCODING_DISPLAY_CURRENCY_SYMBOL, NOWCODING_SETTINGS_FIELDS, NOWCODING_SETTINGS_NAMESPACE, } from './settings-shared.ts';
export type { NowCodingFastServiceTier } from './settings-shared.ts';
/** Cordis plugin name used by loader diagnostics. */
export declare const name = "llm-nowcoding";
/** The LLM seam this adapter registers into. */
export declare const inject: string[];
/**
 * Register the NowCoding provider route and its balance route.
 *
 * The adapter and the settings route share one resolved-options thunk that
 * reads the live config references, so a settings commit reaches the next
 * request and the next balance read without re-registering the route.
 *
 * @param ctx - plugin context.
 * @param config - live configuration references; see {@link NowCodingConfig}.
 */
export declare function apply(ctx: Context, config: NowCodingConfig): void;
