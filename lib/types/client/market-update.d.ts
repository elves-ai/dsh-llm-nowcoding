/**
 * Browser wire face for dsh-market's public plugin update API v1
 * (`/dsh-market/api/v1`), the contract that project documents in its
 * `UPDATE-API-V1.md`: capability discovery, a single-package update check,
 * mutation start, operation polling, and the restart delegate.
 *
 * The detail page never spawns a package manager of its own. The market's
 * Host plane owns the install algorithm, and when its discovery is absent
 * this feature degrades to a manual-command hint rather than poking the
 * market's legacy routes.
 *
 * This speaks dsh-market's envelope — a `schema` field on answers and bare
 * `{ error }` failures — NOT the plugin's fenced-route envelope owned by
 * `./api.ts`. Every read is structural: these shapes are another project's
 * contract and are parsed defensively rather than trusted.
 *
 * @module @elves-ai/dsh-llm-nowcoding/client/market-update
 */
/** One failure the market reports, as its v1 contract names the fields. */
export interface MarketUpdateFailure {
    /** Stable code, e.g. `OPERATION_BUSY` or `RELEASE_TOO_FRESH`. */
    code: string;
    /** Bounded user-facing message from the market. */
    message: string;
    /** Whether the market itself considers a plain retry worthwhile. */
    retryable: boolean;
}
/** An error reading the update API, carrying the stable code when one exists. */
export declare class MarketUpdateApiError extends Error {
    /** Stable failure code; synthesized from the status when the body has none. */
    readonly code: string;
    /** HTTP status of the answer, or 0 for a transport failure. */
    readonly status: number;
    /** Whether a plain retry is worthwhile; mirrors the market's verdict. */
    readonly retryable: boolean;
    constructor(
    /** Stable failure code; synthesized from the status when the body has none. */
    code: string, 
    /** HTTP status of the answer, or 0 for a transport failure. */
    status: number, message: string, 
    /** Whether a plain retry is worthwhile; mirrors the market's verdict. */
    retryable?: boolean);
}
/** What discovery reports about the market's update surface. */
export interface MarketUpdateCapabilities {
    /** The market package's own version, for display only. */
    marketVersion: string | null;
    /** `web` or `desktop` per the market's runtime report. */
    runtime: string | null;
    /** Whether the single-package check endpoint is offered. */
    canCheck: boolean;
    /** Whether the mutation endpoint is offered. */
    canUpdate: boolean;
    /** Whether the market can restart this Host itself. */
    canRestart: boolean;
}
/** One single-package update check. */
export interface MarketUpdateCheck {
    /** Install source the market assigned the package: `github`, `npm`, … */
    source: string | null;
    /** The version installed right now. */
    installedVersion: string | null;
    /** The version an update would move to; null when the source cannot say. */
    latestVersion: string | null;
    /** Whether the market sees a forward update. */
    updateAvailable: boolean;
}
/** One update operation as the polling endpoint reports it. */
export interface MarketUpdateOperation {
    operationId: string;
    /** `queued`, `running`, `succeeded`, `failed`, `cancelled`, `rolled-back`. */
    state: string;
    /** The version present before the operation touched anything. */
    beforeVersion: string | null;
    /** The version actually on disk at the last write of the record. */
    installedVersion: string | null;
    /** Install progress in percent, when pnpm provides a denominator. */
    percent: number | null;
    /** Progress phase label. */
    phase: string | null;
    /** Last progress line, for a detail row under the meter. */
    detail: string | null;
    /** The market says the browser should reload to pick the new bundle up. */
    refreshRequired: boolean;
    /** The market says the Host process itself must restart. */
    restartRequired: boolean;
    /** Whether a compatibility rollback is currently available for this operation. */
    rollbackAvailable: boolean;
    /** Present exactly when the operation failed. */
    failure: MarketUpdateFailure | null;
}
/** The update face the detail page renders its card from. */
export interface MarketUpdateClient {
    /**
     * Discover the market's update surface; null when there is none — the
     * compatibility policy's fallback signal, never an error to surface.
     */
    discover(): Promise<MarketUpdateCapabilities | null>;
    /** Check this plugin for updates; `force` bypasses the market's short cache. */
    check(force?: boolean): Promise<MarketUpdateCheck>;
    /** Start an update of this plugin and return the queued operation. */
    start(force?: boolean): Promise<MarketUpdateOperation>;
    /** Read one operation by id. */
    poll(operationId: string): Promise<MarketUpdateOperation>;
    /** Ask the market to restart the Host; resolves even if the answer is cut short. */
    restart(): Promise<void>;
}
/** Transport override for tests; defaults to the global `fetch`. */
export type MarketUpdateFetch = typeof fetch;
/**
 * Build the update face over one transport.
 * @param fetchImpl - transport seam; the page uses the default instance.
 * @returns the update face.
 */
export declare function createMarketUpdateClient(fetchImpl?: MarketUpdateFetch): MarketUpdateClient;
/** The instance the detail page renders from. */
export declare const marketUpdate: MarketUpdateClient;
