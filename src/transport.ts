/**
 * HTTP transport for the NowCoding Chat Completions route: one request, one
 * timeout, one cancellation, and one classification of every way it can fail.
 *
 * Failures are mapped to stable codes the harness routes on:
 *
 * | condition | code |
 * | --- | --- |
 * | HTTP 401 or 403 | `UNAUTHORIZED` |
 * | HTTP 402, or an error payload naming an exhausted balance | `QUOTA` |
 * | HTTP 429 | `RATE_LIMIT` |
 * | any other non-success status | `PROVIDER_ERROR` |
 * | success without a readable body | `EMPTY_RESPONSE` |
 * | the request never completed (DNS, TLS, reset) | `TRANSPORT` |
 * | the request or stream exceeded `timeoutMs` | `TIMEOUT` |
 * | the caller aborted | `ABORTED` |
 *
 * @module @elves-ai/dsh-llm-nowcoding/transport
 */

import { attributionHeaders, EMPTY_RESPONSE_CODE, LlmError, ProviderRequestId } from '@deepseek-ai/dsh-llm'
import { NOWCODING_CHAT_PATH } from './settings-shared.ts'
import type { WireRequest } from './wire.ts'
import { isRecord } from './wire.ts'

/** One authenticated POST to the chat endpoint. */
export interface ChatRequestInput {
  /** Endpoint base, including the `/v1` segment. */
  baseURL: string
  /** Credential sent as `Authorization: Bearer`. */
  apiKey: string
  /** Serialized request body. */
  body: WireRequest
  /** Caller cancellation; the request and the response stream both honor it. */
  signal?: AbortSignal
  /** Wall-clock bound covering the request and the whole streamed response. */
  timeoutMs: number
  /** Transport override for tests and for deployments that bring their own. */
  fetchImpl?: typeof fetch
}

/** One live provider response. */
export interface ChatResponse {
  /** The response body, framed as SSE by `parseSse`. */
  body: ReadableStream<Uint8Array>
  /**
   * The caller's signal joined with the abort that ends this response.
   * Aborting it after a partial read releases the connection and any timer.
   */
  signal: AbortSignal
  /** Abort this response and release its timer. */
  dispose: () => void
}

/** Join an endpoint base and a gateway path without doubling or dropping the separator. */
function joinPath(baseURL: string, path: string): string {
  return baseURL.replace(/\/+$/u, '') + path
}

/** The `error` object of a gateway failure body, at either nesting level. */
function errorFields(raw: unknown): { message?: string; type?: string; code?: string; text: string } {
  const envelope = isRecord(raw) ? raw : {}
  const error = isRecord(envelope.error) ? envelope.error : envelope
  const message = typeof error.message === 'string' ? error.message : undefined
  const type = typeof error.type === 'string' ? error.type : undefined
  const code = typeof error.code === 'string' || typeof error.code === 'number' ? String(error.code) : undefined
  return {
    ...message === undefined ? {} : { message },
    ...type === undefined ? {} : { type },
    ...code === undefined ? {} : { code },
    text: [type, code, message].filter((value): value is string => value !== undefined).join(' '),
  }
}

/** Provider-requested retry delay, when the gateway states a valid one. */
function retryAfterMs(headers: Headers): number | undefined {
  const value = headers.get('retry-after')
  if (value === null) return undefined
  if (/^\d+(?:\.\d+)?$/u.test(value)) {
    const delay = Number(value) * 1000
    return delay > 0 ? delay : undefined
  }
  const at = Date.parse(value)
  if (Number.isNaN(at)) return undefined
  return at - Date.now() > 0 ? at - Date.now() : undefined
}

/** Provider-issued request id, from whichever header this gateway populates. */
function requestId(headers: Headers): ReturnType<typeof ProviderRequestId> | undefined {
  const value = headers.get('request-id') ?? headers.get('x-request-id') ?? headers.get('x-oneapi-request-id')
  return value === null || value.length === 0 ? undefined : ProviderRequestId(value)
}

/**
 * Classify one non-success response.
 * @param raw - the decoded response body, or undefined when it was not JSON.
 * @param status - the HTTP status.
 * @param headers - the response headers.
 * @returns the failure to throw, carrying status, retry delay, and request id when known.
 */
export function providerError(raw: unknown, status: number, headers: Headers): LlmError {
  const fields = errorFields(raw)
  const detail = `${fields.text} ${fields.message ?? ''}`
  const message = fields.message ?? `NowCoding request failed (HTTP ${status})`
  let code: string
  if (status === 401 || status === 403) code = 'UNAUTHORIZED'
  else if (status === 402 || /insufficient/iu.test(detail)) code = 'QUOTA'
  else if (status === 429) code = 'RATE_LIMIT'
  else code = 'PROVIDER_ERROR'
  const delay = retryAfterMs(headers)
  const id = requestId(headers)
  return new LlmError(message, code, {
    status,
    ...delay === undefined ? {} : { providerRetryAfterMs: delay },
    ...id === undefined ? {} : { requestId: id },
  })
}

/** Classify one transport-level failure that never produced a response. */
function transportError(error: unknown, outer: AbortSignal, timer: AbortSignal): LlmError {
  if (timer.aborted) return new LlmError('NowCoding request exceeded its timeout', 'TIMEOUT', { cause: error })
  if (outer.aborted) return new LlmError('NowCoding request aborted', 'ABORTED', { cause: error })
  return new LlmError('NowCoding transport failed', 'TRANSPORT', { cause: error })
}

/**
 * Send one authenticated chat request and classify every failure it can produce.
 * @param input - endpoint, credential, body, cancellation, timeout, and transport override.
 * @returns the response body plus the signal and disposer that own its lifetime.
 * @throws {LlmError} `UNAUTHORIZED`, `QUOTA`, `RATE_LIMIT`, or `PROVIDER_ERROR` for a
 *   non-success response; `EMPTY_RESPONSE` for a success without a body; `TRANSPORT`,
 *   `TIMEOUT`, or `ABORTED` when the request never produced one.
 */
export async function postChatCompletion(input: ChatRequestInput): Promise<ChatResponse> {
  const timer = new AbortController()
  const handle = setTimeout(() => { timer.abort(new Error('NowCoding request timed out')) }, input.timeoutMs)
  const signal = input.signal === undefined
    ? timer.signal
    : AbortSignal.any([timer.signal, input.signal])
  signal.throwIfAborted()
  const fetchImpl = input.fetchImpl ?? globalThis.fetch
  let response: Response
  try {
    response = await fetchImpl(joinPath(input.baseURL, NOWCODING_CHAT_PATH), {
      method: 'POST',
      signal,
      // A redirect would carry the credential to another origin.
      redirect: 'error',
      headers: {
        ...attributionHeaders(),
        'content-type': 'application/json',
        accept: 'text/event-stream',
        authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify(input.body),
    })
  } catch (error) {
    clearTimeout(handle)
    // The composed signal is the honest outer bound: it is aborted by either the
    // caller or the timer, and the timer is checked first so its own abort is
    // reported as a timeout rather than as caller cancellation.
    throw transportError(error, signal, timer.signal)
  }
  if (!response.ok) {
    clearTimeout(handle)
    const text = await response.text().catch(() => '')
    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch (_nonJsonGatewayError) {
      // A gateway that fails before its JSON layer answers in HTML or plain text;
      // the status is then the only classification input, so the text is carried
      // as the reported message rather than parsed.
      raw = { error: { message: text.length > 0 ? text : `HTTP ${response.status}` } }
    }
    throw providerError(raw, response.status, response.headers)
  }
  if (response.body === null) {
    clearTimeout(handle)
    throw new LlmError('NowCoding returned no response body', EMPTY_RESPONSE_CODE)
  }
  return {
    body: response.body,
    signal,
    dispose: () => {
      clearTimeout(handle)
      timer.abort()
    },
  }
}
