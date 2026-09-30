import { describe, expect, it } from 'vitest'
import { NowCodingQuotaError, createQuotaReader, normalizeQuota } from '../src/quota.ts'

const subscription = {
  object: 'billing_subscription',
  soft_limit_usd: 180,
  hard_limit_usd: 180,
  system_hard_limit_usd: 180,
  access_until: 1_800_000_000,
}

describe('normalizeQuota', () => {
  it('reads the grant as a total and the usage as hundredths', () => {
    const snapshot = normalizeQuota(subscription, { object: 'list', total_usage: 4_250 }, 1_000)
    expect(snapshot).toEqual({
      total: 180,
      used: 42.5,
      remaining: 137.5,
      unlimited: false,
      accessUntil: 1_800_000_000_000,
      fetchedAt: 1_000,
    })
  })

  it('floors the remaining balance at zero when usage exceeds the grant', () => {
    const snapshot = normalizeQuota(subscription, { total_usage: 90_000 }, 1_000)
    expect(snapshot?.remaining).toBe(0)
  })

  it('flags the gateway sentinel as an unmetered key', () => {
    const snapshot = normalizeQuota({ soft_limit_usd: 100_000_000 }, { total_usage: 0 }, 1_000)
    expect(snapshot?.unlimited).toBe(true)
  })

  it('treats a missing usage document as no consumption', () => {
    expect(normalizeQuota(subscription, undefined, 1_000)?.used).toBe(0)
  })

  it('reports no snapshot when the billing document carries no total', () => {
    expect(normalizeQuota({ object: 'billing_subscription' }, {}, 1_000)).toBeUndefined()
    expect(normalizeQuota('not json', {}, 1_000)).toBeUndefined()
  })

  it('treats access_until 0 as no expiry', () => {
    expect(normalizeQuota({ soft_limit_usd: 1, access_until: 0 }, {}, 1)?.accessUntil).toBe(0)
  })
})

describe('createQuotaReader', () => {
  const okFetch = (url: string): Response => new Response(
    url.includes('subscription') ? JSON.stringify(subscription) : JSON.stringify({ total_usage: 1_000 }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )

  it('reads both billing documents and joins the path without doubling the separator', async () => {
    const seen: string[] = []
    const reader = createQuotaReader({
      baseURL: 'https://nowcoding.ai/v1/',
      apiKey: 'sk-test',
      now: () => 7,
      fetchImpl: (async (input: RequestInfo | URL) => {
        seen.push(String(input))
        return okFetch(String(input))
      }) as typeof fetch,
    })
    const snapshot = await reader.read()
    expect(seen).toEqual([
      'https://nowcoding.ai/v1/dashboard/billing/subscription',
      'https://nowcoding.ai/v1/dashboard/billing/usage',
    ])
    expect(snapshot.remaining).toBe(170)
    expect(snapshot.fetchedAt).toBe(7)
  })

  it('sends the credential as a bearer token', async () => {
    let authorization: string | undefined
    const reader = createQuotaReader({
      baseURL: 'https://nowcoding.ai/v1',
      apiKey: 'sk-secret',
      fetchImpl: (async (_input: RequestInfo | URL, init?: RequestInit) => {
        authorization = new Headers(init?.headers).get('authorization') ?? undefined
        return okFetch('subscription')
      }) as typeof fetch,
    })
    await reader.read()
    expect(authorization).toBe('Bearer sk-secret')
  })

  it('classifies a rejected credential as unauthorized', async () => {
    const reader = createQuotaReader({
      baseURL: 'https://nowcoding.ai/v1',
      apiKey: 'sk-bad',
      fetchImpl: (async () => new Response('{"error":{"message":"Invalid token"}}', { status: 401 })) as typeof fetch,
    })
    await expect(reader.read()).rejects.toMatchObject({ code: 'unauthorized' })
  })

  it('classifies a transport failure as unreachable', async () => {
    const reader = createQuotaReader({
      baseURL: 'https://nowcoding.ai/v1',
      apiKey: 'sk-test',
      fetchImpl: (async () => { throw new Error('socket hang up') }) as typeof fetch,
    })
    const failure = await reader.read().catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(NowCodingQuotaError)
    expect((failure as NowCodingQuotaError).code).toBe('unreachable')
  })

  it('classifies a non-success status as a gateway error', async () => {
    const reader = createQuotaReader({
      baseURL: 'https://nowcoding.ai/v1',
      apiKey: 'sk-test',
      fetchImpl: (async () => new Response('nope', { status: 502 })) as typeof fetch,
    })
    await expect(reader.read()).rejects.toMatchObject({ code: 'gateway-error' })
  })
})
