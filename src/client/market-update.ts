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

import { NOWCODING_PACKAGE_NAME } from './package.ts'

/** Root of the public update API the market serves beside its own UI. */
const API_ROOT = '/dsh-market/api/v1'

/** Schema string every v1 answer carries; a mismatch means a foreign route. */
const SCHEMA = 'dsh-market/update-api/v1'

/** One failure the market reports, as its v1 contract names the fields. */
export interface MarketUpdateFailure {
  /** Stable code, e.g. `OPERATION_BUSY` or `RELEASE_TOO_FRESH`. */
  code: string
  /** Bounded user-facing message from the market. */
  message: string
  /** Whether the market itself considers a plain retry worthwhile. */
  retryable: boolean
}

/** An error reading the update API, carrying the stable code when one exists. */
export class MarketUpdateApiError extends Error {
  constructor(
    /** Stable failure code; synthesized from the status when the body has none. */
    readonly code: string,
    /** HTTP status of the answer, or 0 for a transport failure. */
    readonly status: number,
    message: string,
    /** Whether a plain retry is worthwhile; mirrors the market's verdict. */
    readonly retryable: boolean = false,
  ) {
    super(message)
  }
}

/** What discovery reports about the market's update surface. */
export interface MarketUpdateCapabilities {
  /** The market package's own version, for display only. */
  marketVersion: string | null
  /** `web` or `desktop` per the market's runtime report. */
  runtime: string | null
  /** Whether the single-package check endpoint is offered. */
  canCheck: boolean
  /** Whether the mutation endpoint is offered. */
  canUpdate: boolean
  /** Whether the market can restart this Host itself. */
  canRestart: boolean
}

/** One single-package update check. */
export interface MarketUpdateCheck {
  /** Install source the market assigned the package: `github`, `npm`, … */
  source: string | null
  /** The version installed right now. */
  installedVersion: string | null
  /** The version an update would move to; null when the source cannot say. */
  latestVersion: string | null
  /** Whether the market sees a forward update. */
  updateAvailable: boolean
}

/** One update operation as the polling endpoint reports it. */
export interface MarketUpdateOperation {
  operationId: string
  /** `queued`, `running`, `succeeded`, `failed`, `cancelled`, `rolled-back`. */
  state: string
  /** The version present before the operation touched anything. */
  beforeVersion: string | null
  /** The version actually on disk at the last write of the record. */
  installedVersion: string | null
  /** Install progress in percent, when pnpm provides a denominator. */
  percent: number | null
  /** Progress phase label. */
  phase: string | null
  /** Last progress line, for a detail row under the meter. */
  detail: string | null
  /** The market says the browser should reload to pick the new bundle up. */
  refreshRequired: boolean
  /** The market says the Host process itself must restart. */
  restartRequired: boolean
  /** Whether a compatibility rollback is currently available for this operation. */
  rollbackAvailable: boolean
  /** Present exactly when the operation failed. */
  failure: MarketUpdateFailure | null
}

/** The update face the detail page renders its card from. */
export interface MarketUpdateClient {
  /**
   * Discover the market's update surface; null when there is none — the
   * compatibility policy's fallback signal, never an error to surface.
   */
  discover(): Promise<MarketUpdateCapabilities | null>
  /** Check this plugin for updates; `force` bypasses the market's short cache. */
  check(force?: boolean): Promise<MarketUpdateCheck>
  /** Start an update of this plugin and return the queued operation. */
  start(force?: boolean): Promise<MarketUpdateOperation>
  /** Read one operation by id. */
  poll(operationId: string): Promise<MarketUpdateOperation>
  /** Ask the market to restart the Host; resolves even if the answer is cut short. */
  restart(): Promise<void>
}

/** Transport override for tests; defaults to the global `fetch`. */
export type MarketUpdateFetch = typeof fetch

/**
 * Build the update face over one transport.
 * @param fetchImpl - transport seam; the page uses the default instance.
 * @returns the update face.
 */
export function createMarketUpdateClient(fetchImpl: MarketUpdateFetch = globalThis.fetch): MarketUpdateClient {
  const readError = async (status: number, response: Response): Promise<MarketUpdateApiError> => {
    let message = `dsh-market 更新接口返回 HTTP ${String(status)}`
    let code = status === 404 ? 'PLUGIN_NOT_INSTALLED' : status === 403 ? 'UPDATE_FORBIDDEN' : 'UPDATE_FAILED'
    let retryable = false
    try {
      const body = (await response.json()) as unknown
      if (body !== null && typeof body === 'object') {
        const record = body as Record<string, unknown>
        if (typeof record.error === 'string' && record.error.trim() !== '') message = record.error.trim()
        const failure = record.failure
        if (failure !== null && typeof failure === 'object') {
          const shaped = failure as Record<string, unknown>
          if (typeof shaped.code === 'string' && shaped.code !== '') code = shaped.code
          if (typeof shaped.message === 'string' && shaped.message.trim() !== '') message = shaped.message.trim()
          retryable = shaped.retryable === true
        }
      }
    } catch {
      // An unreadable body keeps the status-derived code and message.
    }
    return new MarketUpdateApiError(code, status, message, retryable)
  }

  const getJson = async (path: string): Promise<Record<string, unknown>> => {
    let response: Response
    try {
      response = await fetchImpl(path, { method: 'GET' })
    } catch (error) {
      throw new MarketUpdateApiError('MARKET_UNREACHABLE', 0, error instanceof Error ? error.message : String(error))
    }
    if (!response.ok) throw await readError(response.status, response)
    try {
      const body = (await response.json()) as unknown
      return body !== null && typeof body === 'object' && !Array.isArray(body)
        ? body as Record<string, unknown>
        : {}
    } catch {
      throw new MarketUpdateApiError('UPDATE_FAILED', response.status, 'dsh-market 更新接口返回了无法解析的响应体')
    }
  }

  const text = (value: unknown): string | null =>
    typeof value === 'string' && value.trim() !== '' ? value.trim() : null

  const operationOf = (value: unknown): MarketUpdateOperation => {
    const op = value !== null && typeof value === 'object' ? value as Record<string, unknown> : {}
    const progress = op.progress !== null && typeof op.progress === 'object' ? op.progress as Record<string, unknown> : {}
    const outcome = op.outcome !== null && typeof op.outcome === 'object' ? op.outcome as Record<string, unknown> : {}
    const rollback = outcome.rollback !== null && typeof outcome.rollback === 'object' ? outcome.rollback as Record<string, unknown> : {}
    const failureRaw = op.failure !== null && typeof op.failure === 'object' ? op.failure as Record<string, unknown> : null
    return {
      operationId: text(op.operationId) ?? '',
      state: text(op.state) ?? 'unknown',
      beforeVersion: text(op.beforeVersion),
      installedVersion: text(op.installedVersion),
      percent: typeof progress.percent === 'number' ? progress.percent : null,
      phase: text(progress.phase),
      detail: text(progress.detail),
      refreshRequired: outcome.refreshRequired === true,
      restartRequired: outcome.restartRequired === true,
      rollbackAvailable: rollback.available === true,
      failure: failureRaw === null
        ? null
        : {
            code: text(failureRaw.code) ?? 'UPDATE_FAILED',
            message: text(failureRaw.message) ?? '更新失败，原因未知。',
            retryable: failureRaw.retryable === true,
          },
    }
  }

  return {
    async discover(): Promise<MarketUpdateCapabilities | null> {
      let body: Record<string, unknown>
      try {
        body = await getJson(`${API_ROOT}/capabilities`)
      } catch {
        // Discovery is the feature gate: no market (or an old one) means the
        // card degrades to the manual command, never an error dialog.
        return null
      }
      if (body.schema !== SCHEMA) return null
      const features = body.features !== null && typeof body.features === 'object' ? body.features as Record<string, unknown> : {}
      const restart = body.restart !== null && typeof body.restart === 'object' ? body.restart as Record<string, unknown> : {}
      return {
        marketVersion: text(body.marketVersion),
        runtime: text(body.runtime),
        canCheck: features.check === true,
        canUpdate: features.update === true,
        canRestart: restart.supported === true,
      }
    },

    async check(force = false): Promise<MarketUpdateCheck> {
      const query = new URLSearchParams({ name: NOWCODING_PACKAGE_NAME })
      if (force) query.set('force', '1')
      const body = await getJson(`${API_ROOT}/updates?${query.toString()}`)
      if (body.schema !== SCHEMA) throw new MarketUpdateApiError('UPDATE_FAILED', 200, 'dsh-market 更新接口返回了不认识的响应')
      const pkg = body.package !== null && typeof body.package === 'object' ? body.package as Record<string, unknown> : {}
      return {
        source: text(pkg.source),
        installedVersion: text(pkg.installedVersion),
        latestVersion: text(pkg.latestVersion),
        updateAvailable: pkg.updateAvailable === true,
      }
    },

    async start(force = false): Promise<MarketUpdateOperation> {
      let response: Response
      const payload = JSON.stringify({ packageName: NOWCODING_PACKAGE_NAME, ...(force ? { force: true } : {}) })
      try {
        response = await fetchImpl(`${API_ROOT}/updates`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: payload,
        })
      } catch (error) {
        throw new MarketUpdateApiError('MARKET_UNREACHABLE', 0, error instanceof Error ? error.message : String(error))
      }
      if (!response.ok) throw await readError(response.status, response)
      const body = (await response.json()) as unknown
      return operationOf(body !== null && typeof body === 'object' ? (body as Record<string, unknown>).operation : null)
    },

    async poll(operationId: string): Promise<MarketUpdateOperation> {
      const body = await getJson(`${API_ROOT}/operations?operationId=${encodeURIComponent(operationId)}`)
      if (body.schema !== SCHEMA) throw new MarketUpdateApiError('UPDATE_FAILED', 200, 'dsh-market 更新接口返回了不认识的响应')
      return operationOf(body.operation)
    },

    async restart(): Promise<void> {
      let response: Response
      try {
        response = await fetchImpl(`${API_ROOT}/restart`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        })
      } catch {
        // The Host may go down before the answer arrives; that is a restart
        // in progress, not a refusal.
        return
      }
      if (!response.ok) throw await readError(response.status, response)
    },
  }
}

/** The instance the detail page renders from. */
export const marketUpdate: MarketUpdateClient = createMarketUpdateClient()
