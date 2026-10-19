import { afterEach, describe, expect, it, vi } from 'vitest'
import { getQuota, NowCodingApiError } from '../src/client/api.ts'

/** A fetch answer carrying one body, with the status the Host route would send. */
function answer(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('the client wire face', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('unwraps the success envelope', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => answer(200, {
      ok: true,
      value: { enabled: true, snapshot: null, currency: '¥', refreshSeconds: 300 },
    })))
    await expect(getQuota()).resolves.toMatchObject({ enabled: true })
  })

  it('carries the route\'s failure code and message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => answer(401, {
      ok: false,
      error: { code: 'unauthorized', message: 'no API key is configured' },
    })))
    await expect(getQuota()).rejects.toMatchObject({ code: 'unauthorized', message: 'no API key is configured' })
  })

  it('names a blank 405 as a missing route rather than a generic unreachable host', async () => {
    // The SPA fallback answers a POST it has no named route for with 405 and no
    // body. Reporting that as "unreachable" hid the real cause: the plugin's
    // route was never registered on this dsh line.
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 405 })))
    const failure = await getQuota().catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(NowCodingApiError)
    expect((failure as NowCodingApiError).code).toBe('route-unavailable')
    expect((failure as NowCodingApiError).message).toContain('405')
    expect((failure as NowCodingApiError).message).toContain('路由')
  })

  it('keeps a blank answer other than 405 generic', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 502 })))
    await expect(getQuota()).rejects.toMatchObject({ code: 'unreachable' })
  })
})
