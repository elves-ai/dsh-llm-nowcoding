/**
 * Fenced `/nowcoding/api` route for the NowCoding settings page and sidebar
 * quota card.
 *
 * The DSH settings RPC domain only serves an allowlist of product-owned
 * namespaces, so a third-party plugin cannot read or write its own namespace
 * through `ctx.settingsScope`. This route reaches the settings seam in-process
 * from the plugin's own webserver route, gated by the same browser-trust fence
 * as the `/api` gateway: a Host-header loopback or configured trusted host,
 * and no cross-site browser markers.
 *
 * @module @elves-ai/dsh-llm-nowcoding/settings-routes
 */
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';
import type { Context } from '@deepseek-ai/cordis';
import { type SettingsDescriptor, type SettingsPathOp } from '@deepseek-ai/dsh-settings';
import type { NowCodingResolvedOptions } from './config.ts';
import { type NowCodingPanelCredential, type NowCodingPanelLogin } from './panel-login.ts';
import { type NowCodingQuotaSnapshot } from './quota.ts';
/** Structural webServer face (mirror of `@deepseek-ai/dsh-host-webserver`). */
export interface NowCodingWebServer {
    register(route: {
        kind: 'exact';
        path: string;
        handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
    }): () => void;
}
/** Structural webRuntime face (the bind-derived trusted host list). */
export interface NowCodingWebRuntime {
    trustedHosts: readonly string[];
}
/** The settings-seam members this route uses; the service satisfies it structurally. */
export interface NowCodingSettingsFace {
    readonly writable: boolean;
    describe(options: {
        redactSecrets: true;
    }): readonly SettingsDescriptor[];
    mutate(ns: string, ops: readonly SettingsPathOp[], expectedRevision?: number): Promise<unknown>;
}
/** Everything one route method runs against, so dispatch is testable without a cordis context. */
export interface NowCodingRouteDeps {
    /** The settings seam, or undefined in a deployment that mounts none. */
    settings: NowCodingSettingsFace | undefined;
    /** Resolved plugin options for this request. */
    options: NowCodingResolvedOptions;
    /** Console sign-in, held across requests so a two-factor challenge survives the gap. */
    login: NowCodingPanelLogin;
    /** Transport override for the gateway reads; production uses the global `fetch`. */
    fetchImpl?: typeof fetch;
}
/** Answer of the two sign-in methods; the credential itself never rides it. */
export type NowCodingLoginAnswer = {
    status: 'two-factor-required';
} | {
    status: 'ok';
    /** Account id written to `panelUserId`. */
    userId: string;
    /** Account name, for the page's confirmation copy. */
    username: string;
    /** How the token was obtained; absent when the sign-in stored only the session. */
    tokenSource?: NowCodingPanelCredential['tokenSource'];
};
/** One redacted secret slot as returned by `settings.describe({ redactSecrets: true })`. */
export interface NowCodingSettingsSecretView {
    path: string[];
    set: boolean;
}
/** Redacted settings view served to the settings page. */
export interface NowCodingSettingsView {
    value: unknown;
    revision: number;
    base?: unknown;
    user?: unknown;
    applies: 'live' | 'restart';
    secrets: NowCodingSettingsSecretView[];
    writable: boolean;
}
/** Balance payload returned by `quota.get`. */
export interface NowCodingQuotaView {
    /**
     * Whether the sidebar card should draw anything. False means the user turned
     * the card off; the route still answers so the card can hide itself without
     * a second round trip when the setting changes.
     */
    enabled: boolean;
    /** Null when no credential is configured yet, so there is nothing to read. */
    snapshot: NowCodingQuotaSnapshot | null;
    /** Symbol the snapshot amounts are expressed in. */
    currency: string;
    /** Seconds the card should wait before refreshing again. */
    refreshSeconds: number;
}
/** One model of the key-scoped listing as `models.list` reports it. */
export interface NowCodingRemoteModelView {
    /** The wire model id, verbatim. */
    id: string;
    /** Gateway-side owner tag, present when the listing carries one. */
    ownedBy?: string;
    /** Whether the served catalog describes the id, so the picker can list it once kept. */
    known: boolean;
}
/** Model-list payload returned by `models.list`. */
export interface NowCodingModelListView {
    models: readonly NowCodingRemoteModelView[];
}
/** One picker entry as the conversation model selector serves it right now. */
export interface NowCodingServedModelView {
    id: string;
    name: string;
}
/** Answer of `models.served`: exactly what the conversation picker lists. */
export interface NowCodingServedModelsView {
    models: readonly NowCodingServedModelView[];
}
/** Wire failure envelope of the NowCoding route. */
export interface NowCodingRouteErrorBody {
    code: string;
    message: string;
}
/** Route-level error with an HTTP status and a stable machine code. */
export declare class NowCodingRouteError extends Error {
    readonly code: string;
    readonly status: number;
    constructor(code: string, message: string, status?: number);
}
/**
 * Dispatch one API method against the seams this route uses.
 *
 * Exported so the browser-facing contract is exercised without a cordis
 * context; `registerNowCodingSettingsRoutes` is the only production caller.
 *
 * @param deps - settings seam, resolved options, and the console sign-in client.
 * @param method - the method name the request body carried.
 * @param payload - the payload the request body carried.
 * @returns the method's value.
 */
export declare function dispatchNowCodingMethod(deps: NowCodingRouteDeps, method: unknown, payload: unknown): Promise<unknown>;
/**
 * Register `/nowcoding/api` while `webServer` and `webRuntime` are mounted.
 *
 * The optional-inject shape keeps the provider usable in deployments without a
 * web server; the settings page and the quota card simply have no route to call.
 *
 * @param ctx - plugin context.
 * @param options - thunk returning the route's current resolved options.
 */
export declare function registerNowCodingSettingsRoutes(ctx: Context, options: () => NowCodingResolvedOptions): void;
/**
 * Whether a hostname names the local loopback authority.
 * @param hostname - a URL hostname.
 * @returns whether the host is loopback.
 */
export declare function isLoopbackHostname(hostname: string): boolean;
/**
 * Whether the browser request comes from the DSH host itself.
 * @param headers - the incoming request headers.
 * @param trustedHosts - the runtime's bind-derived trusted host list.
 * @returns whether the request may reach the plugin's route.
 */
export declare function isTrustedApiRequest(headers: IncomingHttpHeaders, trustedHosts: readonly string[]): boolean;
