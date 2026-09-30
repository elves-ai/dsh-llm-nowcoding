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
import type { Context, Volatile } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { type NowCodingCatalogModel, type NowCodingModality, type NowCodingReasoningEfforts } from './catalog.ts';
import { type NowCodingFastServiceTier } from './settings-shared.ts';
/** Provider route this plugin registers on `ctx.llm`. */
export declare const NOWCODING_PROVIDER_ROUTE = "nowcoding";
/** Name shown by selectors when configuration names none. */
export declare const NOWCODING_DEFAULT_DISPLAY_NAME = "NowCoding";
/** Context capacity assumed for a model neither configuration nor the catalog sizes. */
export declare const DEFAULT_CONTEXT_WINDOW = 262144;
/** Output capability assumed for a model neither configuration nor the catalog sizes. */
export declare const DEFAULT_MAX_TOKENS = 32768;
/** Per-request timeout; a coding turn on a reasoning model can legitimately run long. */
export declare const NOWCODING_DEFAULT_REQUEST_TIMEOUT_MS = 300000;
/** Fields a configuration entry may reshape on one catalog model. */
export interface NowCodingModelOverride {
    /** Display name for selectors; defaults to the shipped name, then the id. */
    name?: string;
    /** Maximum combined request and response context in tokens. */
    contextWindow?: number;
    /** Output cap materialized when a caller proposes none. */
    maxTokens?: number;
    /** Accepted input types. */
    input?: readonly NowCodingModality[];
    /** Selectable reasoning levels, or `false` for a non-reasoning model. */
    reasoningEfforts?: NowCodingReasoningEfforts;
    /** Reasoning level used when a caller selects none. */
    defaultReasoningEffort?: string;
    /** Whether the gateway accepts a fast `service_tier` for this model. */
    fast?: boolean;
    /** One-line user-facing distinction shown beside the name. */
    description?: string;
}
/** One entry of a route `models` list: an override plus the wire model id. */
export interface NowCodingModelSpec extends NowCodingModelOverride {
    /** Model id sent to the gateway. */
    id: string;
}
/**
 * The catalog-shaping subset of a configuration, as plain values.
 *
 * Resolution reads it once per operation; separating it from the schema keeps
 * catalog resolution a pure function that a test can call with literal input.
 */
export interface NowCodingCatalogConfig {
    /** Replaces the shipped catalog wholesale when present. */
    models?: readonly NowCodingModelSpec[] | undefined;
    /** Reshapes individual shipped models; ignored beside an explicit `models` list. */
    modelOverrides?: Readonly<Record<string, NowCodingModelOverride>> | undefined;
    /** Ids kept out of the picker without leaving the catalog. */
    hiddenModels?: readonly string[] | undefined;
    /** Context capacity for a model neither the entry nor the shipped catalog sizes. */
    defaultContextWindow?: number | undefined;
    /** Output capability for a model neither the entry nor the shipped catalog sizes. */
    defaultMaxTokens?: number | undefined;
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
    apiKey: Volatile<string | undefined>;
    /** Environment variable the key falls back to; naming it lets a second profile point at a second account. */
    apiKeyEnv: Volatile<string>;
    /** Endpoint base, including the `/v1` segment. */
    baseURL: Volatile<string>;
    /** Name shown by selectors and diagnostics. */
    displayName: Volatile<string>;
    /** Route-level default for the GPT fast tier. */
    fast: Volatile<boolean>;
    /** Wire spelling sent when fast mode is on. */
    fastServiceTier: Volatile<NowCodingFastServiceTier>;
    /** Whether the sidebar quota card is shown. */
    quotaCard: Volatile<boolean>;
    /** Dashboard access token; required to read a monthly plan's allowance without a sign-in. */
    panelToken: Volatile<string | undefined>;
    /** Dashboard user id sent as `New-Api-User`; required by the console chain. */
    panelUserId: Volatile<string | undefined>;
    /** Sign-in session cookie; the console chain accepts it in place of the token. */
    panelSession: Volatile<string | undefined>;
    /** Seconds between balance refreshes in the sidebar card. */
    quotaRefreshSeconds: Volatile<number>;
    /**
     * Settings namespace this plugin's own Loader entry carries.
     *
     * The harness keys a plugin's configuration section by its Loader entry id,
     * so this must equal the `id` of the row that mounts the plugin. It is a
     * field rather than a constant because a profile may mount the same plugin
     * twice under different ids, and then each instance edits its own section.
     */
    settingsNs: Volatile<string>;
    /** Replaces the shipped catalog wholesale when present. */
    models: Volatile<NowCodingModelSpec[] | undefined>;
    /** Reshapes individual shipped models; ignored beside an explicit `models` list. */
    modelOverrides: Volatile<Record<string, NowCodingModelOverride> | undefined>;
    /** Ids kept out of the picker without leaving the catalog. */
    hiddenModels: Volatile<string[] | undefined>;
    /** Context capacity for a model neither the entry nor the shipped catalog sizes. */
    defaultContextWindow: Volatile<number>;
    /** Output capability for a model neither the entry nor the shipped catalog sizes. */
    defaultMaxTokens: Volatile<number>;
    /** Per-request timeout in milliseconds. */
    requestTimeoutMs: Volatile<number>;
}
/**
 * Composition and settings schema for the NowCoding provider route.
 *
 * Every field carries its default so a configuration surface renders the value
 * the route actually serves, rather than an empty control that reads as "unset".
 */
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    apiKey: z<string, string, "volatile">;
    apiKeyEnv: z<string, string, "volatile-defined">;
    baseURL: z<string, string, "volatile-defined">;
    displayName: z<string, string, "volatile-defined">;
    fast: z<boolean, boolean, "volatile-defined">;
    fastServiceTier: z<"fast" | "priority", "fast" | "priority", "volatile-defined">;
    quotaCard: z<boolean, boolean, "volatile-defined">;
    panelToken: z<string, string, "volatile">;
    panelUserId: z<string, string, "volatile">;
    panelSession: z<string, string, "volatile">;
    quotaRefreshSeconds: z<number, number, "volatile-defined">;
    settingsNs: z<string, string, "volatile-defined">;
    models: z<NoInfer<({
        name?: string | null | undefined;
        contextWindow?: number | null | undefined;
        maxTokens?: number | null | undefined;
        input?: ("text" | "image")[] | null | undefined;
        reasoningEfforts?: false | import("@deepseek-ai/cosmokit").Dict<string, string> | null | undefined;
        defaultReasoningEffort?: string | null | undefined;
        fast?: boolean | null | undefined;
        description?: string | null | undefined;
        id?: string | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[]>, NoInfer<Schemastery.ObjectT<NoInfer<{
        name: z<string, string, "plain">;
        contextWindow: z<number, number, "plain">;
        maxTokens: z<number, number, "plain">;
        input: z<("text" | "image")[], ("text" | "image")[], "plain">;
        reasoningEfforts: z<false | import("@deepseek-ai/cosmokit").Dict<string, string>, false | import("@deepseek-ai/cosmokit").Dict<string, string>, "plain">;
        defaultReasoningEffort: z<string, string, "plain">;
        fast: z<boolean, boolean, "plain">;
        description: z<string, string, "plain">;
        id: z<string, string, "defined">;
    }>>[]>, "volatile">;
    modelOverrides: z<NoInfer<import("@deepseek-ai/cosmokit").Dict<{
        name?: string | null | undefined;
        contextWindow?: number | null | undefined;
        maxTokens?: number | null | undefined;
        input?: ("text" | "image")[] | null | undefined;
        reasoningEfforts?: false | import("@deepseek-ai/cosmokit").Dict<string, string> | null | undefined;
        defaultReasoningEffort?: string | null | undefined;
        fast?: boolean | null | undefined;
        description?: string | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict, string>>, NoInfer<import("@deepseek-ai/cosmokit").Dict<Schemastery.ObjectT<NoInfer<{
        name: z<string, string, "plain">;
        contextWindow: z<number, number, "plain">;
        maxTokens: z<number, number, "plain">;
        input: z<("text" | "image")[], ("text" | "image")[], "plain">;
        reasoningEfforts: z<false | import("@deepseek-ai/cosmokit").Dict<string, string>, false | import("@deepseek-ai/cosmokit").Dict<string, string>, "plain">;
        defaultReasoningEffort: z<string, string, "plain">;
        fast: z<boolean, boolean, "plain">;
        description: z<string, string, "plain">;
    }>>, string>>, "volatile">;
    hiddenModels: z<NoInfer<string[]>, NoInfer<string[]>, "volatile">;
    defaultContextWindow: z<number, number, "volatile-defined">;
    defaultMaxTokens: z<number, number, "volatile-defined">;
    requestTimeoutMs: z<number, number, "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    apiKey: z<string, string, "volatile">;
    apiKeyEnv: z<string, string, "volatile-defined">;
    baseURL: z<string, string, "volatile-defined">;
    displayName: z<string, string, "volatile-defined">;
    fast: z<boolean, boolean, "volatile-defined">;
    fastServiceTier: z<"fast" | "priority", "fast" | "priority", "volatile-defined">;
    quotaCard: z<boolean, boolean, "volatile-defined">;
    panelToken: z<string, string, "volatile">;
    panelUserId: z<string, string, "volatile">;
    panelSession: z<string, string, "volatile">;
    quotaRefreshSeconds: z<number, number, "volatile-defined">;
    settingsNs: z<string, string, "volatile-defined">;
    models: z<NoInfer<({
        name?: string | null | undefined;
        contextWindow?: number | null | undefined;
        maxTokens?: number | null | undefined;
        input?: ("text" | "image")[] | null | undefined;
        reasoningEfforts?: false | import("@deepseek-ai/cosmokit").Dict<string, string> | null | undefined;
        defaultReasoningEffort?: string | null | undefined;
        fast?: boolean | null | undefined;
        description?: string | null | undefined;
        id?: string | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict)[]>, NoInfer<Schemastery.ObjectT<NoInfer<{
        name: z<string, string, "plain">;
        contextWindow: z<number, number, "plain">;
        maxTokens: z<number, number, "plain">;
        input: z<("text" | "image")[], ("text" | "image")[], "plain">;
        reasoningEfforts: z<false | import("@deepseek-ai/cosmokit").Dict<string, string>, false | import("@deepseek-ai/cosmokit").Dict<string, string>, "plain">;
        defaultReasoningEffort: z<string, string, "plain">;
        fast: z<boolean, boolean, "plain">;
        description: z<string, string, "plain">;
        id: z<string, string, "defined">;
    }>>[]>, "volatile">;
    modelOverrides: z<NoInfer<import("@deepseek-ai/cosmokit").Dict<{
        name?: string | null | undefined;
        contextWindow?: number | null | undefined;
        maxTokens?: number | null | undefined;
        input?: ("text" | "image")[] | null | undefined;
        reasoningEfforts?: false | import("@deepseek-ai/cosmokit").Dict<string, string> | null | undefined;
        defaultReasoningEffort?: string | null | undefined;
        fast?: boolean | null | undefined;
        description?: string | null | undefined;
    } & import("@deepseek-ai/cosmokit").Dict, string>>, NoInfer<import("@deepseek-ai/cosmokit").Dict<Schemastery.ObjectT<NoInfer<{
        name: z<string, string, "plain">;
        contextWindow: z<number, number, "plain">;
        maxTokens: z<number, number, "plain">;
        input: z<("text" | "image")[], ("text" | "image")[], "plain">;
        reasoningEfforts: z<false | import("@deepseek-ai/cosmokit").Dict<string, string>, false | import("@deepseek-ai/cosmokit").Dict<string, string>, "plain">;
        defaultReasoningEffort: z<string, string, "plain">;
        fast: z<boolean, boolean, "plain">;
        description: z<string, string, "plain">;
    }>>, string>>, "volatile">;
    hiddenModels: z<NoInfer<string[]>, NoInfer<string[]>, "volatile">;
    defaultContextWindow: z<number, number, "volatile-defined">;
    defaultMaxTokens: z<number, number, "volatile-defined">;
    requestTimeoutMs: z<number, number, "volatile-defined">;
}>>, "plain">;
/** One model as the adapter serves it: fully defaulted, no optional capacity. */
export interface ResolvedNowCodingModel extends NowCodingCatalogModel {
    /** Accepted input types, defaulted to text. */
    input: readonly NowCodingModality[];
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
export declare function effectiveCatalog(config: NowCodingCatalogConfig): readonly ResolvedNowCodingModel[];
/** The immutable snapshot one adapter operation serves from. */
export interface NowCodingResolvedOptions {
    /** Credential sent as `Authorization: Bearer`; empty when the route is configured without one. */
    apiKey: string;
    /** Endpoint base, including the `/v1` segment. */
    baseURL: string;
    /** Name shown by selectors and diagnostics. */
    displayName: string;
    /** Route-level fast default. */
    fast: boolean;
    /** Wire spelling sent when fast mode is on. */
    fastServiceTier: NowCodingFastServiceTier;
    /** The served catalog. */
    catalog: readonly ResolvedNowCodingModel[];
    /** Whether the sidebar quota card is shown. */
    quotaCard: boolean;
    /** Dashboard access token; empty leaves the reader on the session cookie, then the relay pair. */
    panelToken: string;
    /** Dashboard user id sent as `New-Api-User`. */
    panelUserId: string;
    /** Sign-in session cookie; empty leaves the reader on the token, then the relay pair. */
    panelSession: string;
    /** Seconds between balance refreshes. */
    quotaRefreshSeconds: number;
    /** Per-request timeout in milliseconds. */
    requestTimeoutMs: number;
    /** Settings namespace this instance's configuration section lives under. */
    settingsNs: string;
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
export declare function resolveNowCodingOptions(ctx: Context, config: Config): NowCodingResolvedOptions;
