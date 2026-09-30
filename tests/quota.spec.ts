import { describe, expect, it } from 'vitest'
import {
  NowCodingQuotaError,
  createQuotaReader,
  normalizeQuota,
  normalizeSubscription,
  quotaUnitOf,
} from '../src/quota.ts'

const subscription = {
  object: 'billing_subscription',
  soft_limit_usd: 180,
  hard_limit_usd: 180,
  system_hard_limit_usd: 180,
  access_until: 1_800_000_000,
}

/** The console document, shaped as the live gateway answers it. */
const panel = {
  success: true,
  message: '',
  data: {
    billing_preference: 'subscription_first',
    subscriptions: [{
      subscription: {
        id: 3952,
        amount_total: 50_000_000,
        amount_used: 1_017_233,
        status: 'active',
        end_time: 1_792_134_221,
        next_reset_time: 1_790_784_000,
      },
      plan_title: '【畅享套餐】Codex 月卡 3000$',
      plan_quota_reset_period: 'daily',
    }],
    all_subscriptions: [
      {
        subscription: { id: 3952, amount_total: 50_000_000, amount_used: 1_017_233, status: 'active' },
        plan_title: '【畅享套餐】Codex 月卡 3000$',
      },
      {
        subscription: { id: 3278, amount_total: 50_000_000, amount_used: 48_645_083, status: 'expired' },
        plan_title: '【畅享套餐】Codex 月卡 3000$',
      },
    ],
  },
}

describe('normalizeQuota (relay billing pair)', () => {
  it('reads the grant as a total and the usage as hundredths', () => {
    expect(normalizeQuota(subscription, { object: 'list', total_usage: 4_250 }, 1_000)).toEqual({
      source: 'billing',
      total: 180,
      used: 42.5,
      remaining: 137.5,
      unlimited: false,
      accessUntil: 1_800_000_000_000,
      resetAt: 0,
      fetchedAt: 1_000,
      quotaPerUnit: 1,
    })
  })

  it('floors the remaining balance at zero when usage exceeds the grant', () => {
    expect(normalizeQuota(subscription, { total_usage: 90_000 }, 1_000)?.remaining).toBe(0)
  })

  it('flags the gateway sentinel as an unmetered key', () => {
    expect(normalizeQuota({ soft_limit_usd: 100_000_000 }, { total_usage: 0 }, 1_000)?.unlimited).toBe(true)
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

describe('quotaUnitOf', () => {
  it('reads the divisor from the status document', () => {
    expect(quotaUnitOf({ data: { quota_per_unit: 500_000 } })).toBe(500_000)
  })

  it('falls back when the status document is missing or nonsense', () => {
    expect(quotaUnitOf(undefined)).toBe(500_000)
    expect(quotaUnitOf({ data: {} })).toBe(500_000)
    expect(quotaUnitOf({ data: { quota_per_unit: 0 } })).toBe(500_000)
  })
})

describe('normalizeSubscription', () => {
  it('divides raw units by quota_per_unit, matching the console figure', () => {
    const snapshot = normalizeSubscription(panel, 500_000, 1_000)
    expect(snapshot?.source).toBe('subscription')
    expect(snapshot?.total).toBe(100)
    expect(snapshot?.used).toBeCloseTo(2.034466, 6)
    expect(snapshot?.remaining).toBeCloseTo(97.965534, 6)
    expect(snapshot?.quotaPerUnit).toBe(500_000)
  })

  it('carries the plan title, reset cadence, and reset instant', () => {
    const snapshot = normalizeSubscription(panel, 500_000, 1_000)
    expect(snapshot?.planTitle).toBe('【畅享套餐】Codex 月卡 3000$')
    expect(snapshot?.resetPeriod).toBe('daily')
    expect(snapshot?.resetAt).toBe(1_790_784_000_000)
    expect(snapshot?.accessUntil).toBe(1_792_134_221_000)
  })

  it('falls back to the full list when the active list is empty', () => {
    const onlyAll = {
      data: { subscriptions: [], all_subscriptions: [
        { subscription: { amount_total: 1_000, amount_used: 1_000, status: 'expired' } },
      ] },
    }
    expect(normalizeSubscription(onlyAll, 500_000, 1)?.total).toBe(0.002)
  })

  it('reports no snapshot when the document carries no usable plan', () => {
    expect(normalizeSubscription({ data: { subscriptions: [] } }, 500_000, 1)).toBeUndefined()
    expect(normalizeSubscription(undefined, 500_000, 1)).toBeUndefined()
    expect(normalizeSubscription({ data: { subscriptions: [{ subscription: { status: 'active' } }] } }, 1, 1))
      .toBeUndefined()
  })
})

describe('createQuotaReader', () => {
  const okFetch = (url: string): Response => new Response(
    url.includes('subscription/self')
      ? JSON.stringify(panel)
      : url.includes('/api/status')
        ? JSON.stringify({ data: { quota_per_unit: 500_000 } })
        : url.includes('subscription') ? JSON.stringify(subscription) : JSON.stringify({ total_usage: 1_000 }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )

  it('reads both relay documents and joins the path without doubling the separator', async () => {
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
    expect(snapshot.source).toBe('billing')
    expect(snapshot.remaining).toBe(170)
    expect(snapshot.fetchedAt).toBe(7)
  })

  it('prefers the console subscription when a dashboard token is configured', async () => {
    const seen: { url: string; headers: Headers }[] = []
    const reader = createQuotaReader({
      baseURL: 'https://nowcoding.ai/v1',
      apiKey: 'sk-test',
      panelToken: 'panel-token',
      panelUserId: '8893',
      fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
        seen.push({ url: String(input), headers: new Headers(init?.headers) })
        return okFetch(String(input))
      }) as typeof fetch,
    })
    const snapshot = await reader.read()
    expect(snapshot.source).toBe('subscription')
    expect(snapshot.remaining).toBeCloseTo(97.965534, 6)
    // The console lives at the origin, not under the /v1 relay base.
    expect(seen.map(entry => entry.url)).toEqual([
      'https://nowcoding.ai/api/subscription/self',
      'https://nowcoding.ai/api/status',
    ])
    expect(seen[0]?.headers.get('authorization')).toBe('Bearer panel-token')
    expect(seen[0]?.headers.get('new-api-user')).toBe('8893')
  })

  it('omits New-Api-User rather than sending it empty', async () => {
    let headers: Headers | undefined
    const reader = createQuotaReader({
      baseURL: 'https://nowcoding.ai/v1',
      apiKey: 'sk-test',
      panelToken: 'panel-token',
      fetchImpl: (async (_input: RequestInfo | URL, init?: RequestInit) => {
        headers ??= new Headers(init?.headers)
        return okFetch('subscription/self')
      }) as typeof fetch,
    })
    await reader.read()
    expect(headers?.has('new-api-user')).toBe(false)
  })

  it('falls back to the wallet when the token holds no active plan', async () => {
    const reader = createQuotaReader({
      baseURL: 'https://nowcoding.ai/v1',
      apiKey: 'sk-test',
      panelToken: 'panel-token',
      fetchImpl: (async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('subscription/self')) {
          return new Response(JSON.stringify({ success: true, data: { subscriptions: [] } }), { status: 200 })
        }
        return okFetch(url)
      }) as typeof fetch,
    })
    expect((await reader.read()).source).toBe('billing')
  })

  it('treats the console 200-with-success-false as a rejected credential', async () => {
    const reader = createQuotaReader({
      baseURL: 'https://nowcoding.ai/v1',
      apiKey: 'sk-test',
      panelToken: 'stale-token',
      fetchImpl: (async () => new Response(
        JSON.stringify({ message: 'Unauthorized, invalid access token', success: false }),
        { status: 200 },
      )) as typeof fetch,
    })
    await expect(reader.read()).rejects.toMatchObject({ code: 'unauthorized' })
  })

  it('reads the console subscription through the sign-in session cookie', async () => {
    const seen: { url: string; headers: Headers }[] = []
    const reader = createQuotaReader({
      baseURL: 'https://nowcoding.ai/v1',
      apiKey: 'sk-test',
      panelSession: 'session=abc123',
      panelUserId: '8893',
      fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
        seen.push({ url: String(input), headers: new Headers(init?.headers) })
        return okFetch(String(input))
      }) as typeof fetch,
    })
    const snapshot = await reader.read()
    expect(snapshot.source).toBe('subscription')
    expect(seen[0]?.headers.get('cookie')).toBe('session=abc123')
    expect(seen[0]?.headers.get('new-api-user')).toBe('8893')
    expect(seen[0]?.headers.has('authorization')).toBe(false)
  })

  it('falls back to the session cookie when the token is refused', async () => {
    let consoleAttempts = 0
    const reader = createQuotaReader({
      baseURL: 'https://nowcoding.ai/v1',
      apiKey: 'sk-test',
      panelToken: 'stale-token',
      panelSession: 'session=abc123',
      panelUserId: '8893',
      fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.includes('subscription/self')) {
          consoleAttempts += 1
          if (consoleAttempts === 1) {
            return new Response(
              JSON.stringify({ message: 'Unauthorized, invalid access token', success: false }),
              { status: 200 },
            )
          }
          expect(new Headers(init?.headers).get('cookie')).toBe('session=abc123')
        }
        return okFetch(url)
      }) as typeof fetch,
    })
    expect((await reader.read()).source).toBe('subscription')
  })

  it('reports unauthorized when both console credentials are refused', async () => {
    const reader = createQuotaReader({
      baseURL: 'https://nowcoding.ai/v1',
      apiKey: 'sk-test',
      panelToken: 'stale-token',
      panelSession: 'session=stale',
      fetchImpl: (async () => new Response(
        JSON.stringify({ message: 'Unauthorized, invalid access token', success: false }),
        { status: 200 },
      )) as typeof fetch,
    })
    await expect(reader.read()).rejects.toMatchObject({ code: 'unauthorized' })
  })

  it('sends the model key as a bearer token on the relay chain', async () => {
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
