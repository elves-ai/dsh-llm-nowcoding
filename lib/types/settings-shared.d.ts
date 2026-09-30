/**
 * Shared "NowCoding configuration" vocabulary (types + constants), consumed by
 * BOTH halves: the Host registers a settings namespace with a schemastery
 * schema over these values, and the settings page plus the sidebar quota card
 * in the browser read them through the plugin's own fenced `/nowcoding/api`
 * route. Kept free of schemastery and `@deepseek-ai/dsh-settings` so the
 * browser bundle never pulls the Host-only settings runtime in.
 * @module @elves-ai/dsh-llm-nowcoding/settings-shared
 */
/** User-settings namespace carrying the NowCoding provider configuration. */
export declare const NOWCODING_SETTINGS_NAMESPACE = "llm-nowcoding";
/** Settings fields editable from the NowCoding settings page. */
export declare const NOWCODING_SETTINGS_FIELDS: readonly ["apiKey", "baseURL", "fast", "fastServiceTier", "quotaCard", "panelToken", "panelUserId", "panelSession"];
/** One editable NowCoding settings field. */
export type NowCodingSettingsField = typeof NOWCODING_SETTINGS_FIELDS[number];
/** Default environment variable the plugin resolves the API key from. */
export declare const NOWCODING_DEFAULT_API_KEY_ENV = "NOWCODING_API_KEY";
/**
 * Endpoint base every NowCoding model request is sent to.
 *
 * The gateway publishes two front ends over one host: `https://nowcoding.ai/v1`
 * for the OpenAI-compatible routes and `https://nowcoding.ai` for the
 * Anthropic-compatible `/v1/messages` route. This plugin speaks the
 * OpenAI-compatible route, so its base carries the `/v1` segment.
 */
export declare const NOWCODING_DEFAULT_BASE_URL = "https://nowcoding.ai/v1";
/** The gateway's OpenAI-compatible chat route, appended to the base. */
export declare const NOWCODING_CHAT_PATH = "/chat/completions";
/** The gateway's model listing, appended to the base; reflects the key's groups. */
export declare const NOWCODING_MODELS_PATH = "/models";
/**
 * Public gateway catalog, appended to the gateway origin rather than the base.
 *
 * It needs no credential and reports the full lineup with each model's groups
 * and endpoint types, which makes it the better source for a model picker than
 * the key-scoped listing. Its records also carry the group multipliers the
 * plugin surfaces as model descriptions.
 */
export declare const NOWCODING_PRICING_PATH = "/api/pricing";
/**
 * Public gateway status document, appended to the gateway origin.
 *
 * It carries `quota_per_unit`, the divisor every displayed amount uses, which
 * is why reading a subscription balance takes two requests: the subscription
 * document reports raw units and the status document says how many make one
 * displayed unit.
 */
export declare const NOWCODING_STATUS_PATH = "/api/status";
/**
 * Subscription document, appended to the gateway **origin** rather than to the
 * endpoint base.
 *
 * This is the console API, not the relay API: it reports the monthly plan's
 * allowance and its consumption against it, which is the figure the gateway's
 * own console shows. It authenticates with a dashboard access token, or with
 * the sign-in session cookie, plus the `New-Api-User` header either way — the
 * `sk-` model key is rejected on this chain, and so is either credential
 * without the header.
 */
export declare const NOWCODING_SUBSCRIPTION_PATH = "/api/subscription/self";
/**
 * Console sign-in, appended to the gateway origin.
 *
 * The console answers with the session cookie that becomes the persisted
 * console credential. The password is a parameter of this one request; nothing
 * persists it.
 */
export declare const NOWCODING_LOGIN_PATH = "/api/user/login";
/** Second sign-in step, taken only when the account has 2FA enabled. */
export declare const NOWCODING_TWO_FACTOR_LOGIN_PATH = "/api/user/login/2fa";
/**
 * Site agreement confirmation, appended to the gateway origin.
 *
 * The console's own web app sends this right after a successful login, so
 * sign-in mirrors it once per sign-in. It is best-effort: a refusal here is
 * ignored and never fails the sign-in.
 */
export declare const NOWCODING_AGREEMENT_ACCEPT_PATH = "/api/agreement/accept?lang=zh-CN";
/** Console account document; its `access_token` member is a token fallback. */
export declare const NOWCODING_SELF_PATH = "/api/user/self";
/** Reads the account's dashboard token without rotating it. */
export declare const NOWCODING_SELF_ACCESS_TOKEN_PATH = "/api/user/self/access-token";
/**
 * Divisor assumed when the status document cannot be read.
 *
 * This deployment reports `quota_per_unit: 500000`. The fallback keeps a
 * balance readable while the status probe is unreachable; the snapshot records
 * how many units it divided by so a wrong divisor is visible rather than silent.
 */
export declare const NOWCODING_FALLBACK_QUOTA_PER_UNIT = 500000;
/**
 * Remaining-quota path appended to the endpoint base.
 *
 * The gateway is a new-api deployment, so it answers the OpenAI-compatible
 * billing pair. Both spellings resolve because the base already carries
 * `/v1`: `/v1/dashboard/billing/subscription` and the origin-level spelling
 * reach the same handler behind the same API-key authentication as `/v1/models`.
 */
export declare const NOWCODING_QUOTA_SUBSCRIPTION_PATH = "/dashboard/billing/subscription";
/** Companion usage path; its `total_usage` is in hundredths of the display currency. */
export declare const NOWCODING_QUOTA_USAGE_PATH = "/dashboard/billing/usage";
/**
 * `soft_limit_usd` value a gateway reports for a key with no quota limit.
 *
 * The field is populated from the license total, so an unmetered key reports
 * this sentinel instead of a real grant. The card shows "unlimited" rather
 * than a remaining balance computed against it.
 */
export declare const NOWCODING_UNLIMITED_QUOTA_SENTINEL = 100000000;
/**
 * Symbol the gateway's quota figures are displayed in.
 *
 * The billing document's fields are named `*_usd`, but this deployment sets
 * `quota_display_type` to CNY, so the numbers it carries are yuan. Labelling
 * them as dollars would overstate a balance by the exchange rate.
 */
export declare const NOWCODING_DISPLAY_CURRENCY_SYMBOL = "\u00A5";
/** How often the sidebar quota card re-reads the balance while it is mounted. */
export declare const NOWCODING_DEFAULT_QUOTA_REFRESH_SECONDS = 300;
/** Smallest accepted quota refresh interval, in seconds. */
export declare const NOWCODING_MIN_QUOTA_REFRESH_SECONDS = 30;
/**
 * Wire spelling of the GPT fast tier. Both values select OpenAI's fast mode;
 * `priority` is the older spelling and the safer default for gateways that
 * predate the rename.
 */
export type NowCodingFastServiceTier = 'priority' | 'fast';
/**
 * User-facing NowCoding provider settings. Every field is optional in the
 * composition entry; the Host schema fills the defaults below.
 */
export interface NowCodingSettings {
    /**
     * NowCoding API key literal. Stored in the settings namespace with
     * `role('secret')`: it never rides a settings response, so the settings page
     * and the quota card only learn whether a value is set. Empty falls back to
     * the environment variable named by the plugin's `apiKeyEnv` config.
     */
    apiKey?: string;
    /** Endpoint base; model, quota, and pricing paths are resolved against it. */
    baseURL?: string;
    /**
     * Route-level default for the GPT fast tier. `true` sends `service_tier` on
     * every fast-capable model, which the gateway bills at its higher fast rate.
     * A model picked by its `-fast` id alias overrides this per request.
     */
    fast?: boolean;
    /** Wire spelling sent when fast mode is on. */
    fastServiceTier?: NowCodingFastServiceTier;
    /** Show the remaining-quota card above Settings in the left sidebar. */
    quotaCard?: boolean;
    /**
     * Dashboard access token, used only to read the subscription document.
     *
     * The console API rejects the `sk-` model key, so a monthly-plan balance
     * needs this second credential; the console issues one on its system access
     * token page. Leaving it empty keeps the card on the relay billing pair,
     * which reports the pay-as-you-go balance instead.
     */
    panelToken?: string;
    /**
     * Dashboard user id, sent as `New-Api-User`.
     *
     * The console validates that header against the credential's owner — token
     * or session cookie alike — so it is required wherever either is set.
     */
    panelUserId?: string;
    /**
     * Sign-in session cookie, the `session=...` pair the console answered the
     * last account login with.
     *
     * Stored with `role('secret')` beside `panelToken`: it never rides a
     * settings response. The console chain accepts it in place of the access
     * token, which is how a sign-in alone — without a token read-back — unlocks
     * the subscription balance. It expires when the console expires the session;
     * signing in again refreshes it.
     */
    panelSession?: string;
}
/** Schema-default fallbacks used by the client while the settings route is unavailable. */
export declare const NOWCODING_SETTINGS_DEFAULTS: {
    readonly apiKey: "";
    readonly baseURL: "https://nowcoding.ai/v1";
    readonly fast: false;
    readonly fastServiceTier: NowCodingFastServiceTier;
    readonly quotaCard: true;
    readonly panelToken: "";
    readonly panelUserId: "";
    readonly panelSession: "";
};
