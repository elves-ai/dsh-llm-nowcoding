/**
 * Live model-list reader for the NowCoding gateway.
 *
 * `GET {base}/v1/models` is key-scoped: it answers with exactly the models the
 * configured key's groups may call, which makes it the truthful source for the
 * detail page's model allowlist — every id it returns is one the key can
 * actually serve. The gateway is a modified new-api deployment answering the
 * OpenAI list shape, and its catalog moves under it, so the normalization
 * below reads the body defensively rather than trusting it.
 *
 * This is a provider request: it carries `attributionHeaders()` like the chat
 * path, and it classifies failures with the same vocabulary the quota reader
 * uses so the fenced route maps both identically.
 *
 * @module @elves-ai/dsh-llm-nowcoding/live-models
 */

import { attributionHeaders } from '@deepseek-ai/dsh-llm'
import { NOWCODING_MODELS_PATH } from './settings-shared.ts'

/** Stable failure classification for one model-list read. */
export type NowCodingModelsErrorCode =
  /** The gateway could not be reached at all. */
  | 'unreachable'
  /** The gateway rejected the credential. */
  | 'unauthorized'
  /** The gateway answered with a non-success status. */
  | 'gateway-error'
  /** The gateway answered with a body this reader cannot read. */
  | 'unprocessable'
  /** The call exceeded its timeout. */
  | 'timeout'

/** One failed model-list read, carrying the classification callers branch on. */
export class NowCodingModelsError extends Error {
  constructor(
    readonly code: NowCodingModelsErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'NowCodingModelsError'
  }
}

/** One model the gateway reports for the configured key. */
export interface NowCodingRemoteModel {
  /** The wire model id, verbatim. */
  id: string
  /** Gateway-side owner tag, present when the listing carries one. */
  ownedBy?: string
}

/** Injection seam for tests and for deployments that bring their own transport. */
export interface NowCodingLiveModelListOptions {
  /** Endpoint base, including the `/v1` segment. */
  baseURL: string
  /** NowCoding model key sent as `Authorization: Bearer`. */
  apiKey: string
  /** Transport override; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch
  /** Per-attempt timeout in milliseconds. */
  timeoutMs?: number
}

/** Reads the gateway's key-scoped model listing. */
export interface NowCodingLiveModelLister {
  /**
   * Read the listing.
   * @param signal - caller cancellation; the read settles promptly after it aborts.
   * @returns one entry per distinct model id, in the order the gateway reported.
   */
  list(signal?: AbortSignal): Promise<readonly NowCodingRemoteModel[]>
}

/** Default per-attempt timeout for one model-list read. */
export const NOWCODING_DEFAULT_MODELS_TIMEOUT_MS = 15_000

/** True for a JSON object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** A non-empty string member, or undefined. */
function stringMember(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

/** Join an endpoint base and a gateway path without doubling or dropping the separator. */
function joinPath(baseURL: string, path: string): string {
  return baseURL.replace(/\/+$/, '') + path
}

/**
 * Project the listing body into model entries.
 *
 * Exported for tests and for callers that already hold the document: the
 * normalization carries the wire semantics, the request does not. The OpenAI
 * shape is `{ data: [...] }`; a bare array is tolerated because the gateway is
 * locally modified. Malformed entries are dropped, not fatal, and ids are
 * deduplicated in first-seen order.
 *
 * @param payload - the `/v1/models` body.
 * @returns one entry per distinct usable id.
 */
export function normalizeModelList(payload: unknown): readonly NowCodingRemoteModel[] {
  const data = isRecord(payload) && Array.isArray(payload['data'])
    ? payload['data']
    : Array.isArray(payload)
      ? payload
      : []
  const seen = new Set<string>()
  const models: NowCodingRemoteModel[] = []
  for (const entry of data) {
    if (!isRecord(entry)) continue
    const id = stringMember(entry, 'id')
    if (id === undefined || seen.has(id)) continue
    seen.add(id)
    const ownedBy = stringMember(entry, 'owned_by')
    models.push({ id, ...ownedBy === undefined ? {} : { ownedBy } })
  }
  return models
}

/**
 * Build a live model-list reader for one credential.
 * @param options - endpoint, credential, and optional transport seam.
 * @returns a reader that performs the one listing request.
 */
export function createLiveModelLister(options: NowCodingLiveModelListOptions): NowCodingLiveModelLister {
  const timeoutMs = options.timeoutMs ?? NOWCODING_DEFAULT_MODELS_TIMEOUT_MS
  const url = joinPath(options.baseURL, NOWCODING_MODELS_PATH)

  return {
    async list(signal?: AbortSignal): Promise<readonly NowCodingRemoteModel[]> {
      const fetchImpl = options.fetchImpl ?? globalThis.fetch
      const timer = new AbortController()
      const onAbort = (): void => timer.abort(signal?.reason)
      if (signal !== undefined) {
        if (signal.aborted) onAbort()
        else signal.addEventListener('abort', onAbort, { once: true })
      }
      const timeout = setTimeout(() => timer.abort(new Error('model list read timed out')), timeoutMs)
      let response: Response
      try {
        response = await fetchImpl(url, {
          method: 'GET',
          headers: {
            accept: 'application/json',
            authorization: `Bearer ${options.apiKey}`,
            ...attributionHeaders(),
          },
          signal: timer.signal,
        })
      } catch (error) {
        if (signal?.aborted === true) throw error
        if (timer.signal.aborted) {
          throw new NowCodingModelsError('timeout', `model list read from ${url} exceeded ${timeoutMs}ms`)
        }
        throw new NowCodingModelsError(
          'unreachable',
          `model list read from ${url} failed: ${error instanceof Error ? error.message : String(error)}`,
        )
      } finally {
        clearTimeout(timeout)
        signal?.removeEventListener('abort', onAbort)
      }
      if (response.status === 401 || response.status === 403) {
        throw new NowCodingModelsError('unauthorized', `the gateway rejected the API key (HTTP ${response.status})`)
      }
      if (!response.ok) {
        throw new NowCodingModelsError('gateway-error', `model list read from ${url} returned HTTP ${response.status}`)
      }
      let payload: unknown
      try {
        payload = await response.json() as unknown
      } catch (error) {
        throw new NowCodingModelsError(
          'unprocessable',
          `model list read from ${url} returned a body that is not JSON: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
      return normalizeModelList(payload)
    },
  }
}
