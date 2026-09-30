/**
 * Client wire face for the plugin's own fenced `/nowcoding/api` route.
 *
 * DRAFT (not installed): this is the on-disk `src/client/api.ts` extended with
 * the settings-half methods the brief's settings page needs. Every export the
 * existing file had is preserved verbatim, so the existing quota card keeps
 * compiling; the additions are the settings envelope, the path ops, the two
 * settings calls, and the commit notification the card can subscribe to.
 *
 * Wire contract, owned jointly with `src/settings-routes.ts`: one POST per
 * method, body `{ method, payload }`, answer `{ ok: true, value }` or
 * `{ ok: false, error: { code, message } }`.
 *
 * @module @elves-ai/dsh-llm-nowcoding/client/api
 */
import type { NowCodingFastServiceTier } from '../settings-shared.ts';
/** One remaining-quota snapshot as the Host route reports it. */
export interface NowCodingQuotaSnapshotView {
    /** Granted total in the gateway's display currency. */
    total: number;
    /** Consumed amount in the gateway's display currency. */
    used: number;
    /** `total - used`, floored at zero. */
    remaining: number;
    /** True for an unmetered key, where the three amounts are the gateway's sentinel. */
    unlimited: boolean;
    /** Epoch milliseconds when the grant lapses; 0 means it does not. */
    accessUntil: number;
    /** Epoch milliseconds when the Host read the balance. */
    fetchedAt: number;
}
/** Answer of `quota.get`. */
export interface NowCodingQuotaView {
    /** Whether the sidebar card should draw anything, per the user's setting. */
    enabled: boolean;
    /** Null when no API key is configured yet, so there is nothing to read. */
    snapshot: NowCodingQuotaSnapshotView | null;
    /** Symbol the amounts are expressed in. */
    currency: string;
    /** Seconds the card should wait before refreshing again. */
    refreshSeconds: number;
}
/** One redacted secret slot (`set` tells whether a value is configured). */
export interface NowCodingSettingsSecretView {
    path: string[];
    set: boolean;
}
/** Answer of `settings.get` and `settings.mutate` (`NowCodingSettingsView` `value`). */
export interface NowCodingSettingsEnvelope {
    /** Resolved settings document; narrow it with {@link settingsViewOf}. */
    value: unknown;
    /** Settings-document revision the next mutate is checked against. */
    revision: number;
    /** Deployment-level layer, when the namespace has one. */
    base?: unknown;
    /** User-layer document, when the namespace has one. */
    user?: unknown;
    /** Whether a commit reaches the running plugin or needs a restart. */
    applies: 'live' | 'restart';
    /** Redacted secret slots. */
    secrets: NowCodingSettingsSecretView[];
    /** False when the settings document is read-only in this deployment. */
    writable: boolean;
}
/** The NowCoding fields this client renders, read out of an envelope. */
export interface NowCodingSettingsView {
    /** Endpoint base every model, quota, and pricing path is resolved against. */
    baseURL?: string;
    /** Route-level default for the GPT fast tier. */
    fast?: boolean;
    /** Wire spelling sent when fast mode is on. */
    fastServiceTier?: NowCodingFastServiceTier;
    /** Show the remaining-quota card at the sidebar foot. */
    quotaCard?: boolean;
}
/** One path-addressed settings edit sent to the Host route. */
export type NowCodingSettingsOp = {
    op: 'set';
    path: [string];
    value: unknown;
} | {
    op: 'unset';
    path: [string];
};
/** Wire error carrying the route's stable machine code. */
export declare class NowCodingApiError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
/**
 * Read the configured key's remaining balance.
 * @param signal - cancellation for this read, honoured by the browser fetch.
 * @returns the balance view; `snapshot` is null until a key is configured.
 */
export declare function getQuota(signal?: AbortSignal): Promise<NowCodingQuotaView>;
/** Read the redacted NowCoding settings document. */
export declare function getNowCodingSettings(): Promise<NowCodingSettingsEnvelope>;
/**
 * Apply path ops and return the fresh redacted document.
 * @param ops - path-addressed edits applied in one commit.
 * @param expectedRevision - revision this caller read; the Host rejects a stale one.
 * @returns the committed document.
 */
export declare function mutateNowCodingSettings(ops: readonly NowCodingSettingsOp[], expectedRevision?: number): Promise<NowCodingSettingsEnvelope>;
/**
 * Subscribe to successful settings commits from this bundle.
 *
 * The settings page and the sidebar card are independent mounts with no shared
 * store, so the commit notification lives on the one module they share: the
 * card drops out as soon as a save setting `quotaCard` false lands, instead of
 * waiting out its refresh tick.
 * @param listener - called after every successful `settings.mutate`.
 * @returns the unsubscribe function.
 */
export declare function onNowCodingSettingsCommitted(listener: () => void): () => void;
/**
 * Narrow an envelope's `value` into the fields this client renders.
 * @param envelope - the route's answer.
 * @returns the known fields; unknown or mistyped fields stay absent.
 */
export declare function settingsViewOf(envelope: NowCodingSettingsEnvelope): NowCodingSettingsView;
/** True when the write-only `apiKey` slot currently holds a value. */
export declare function isNowCodingApiKeyConfigured(envelope: NowCodingSettingsEnvelope): boolean;
