import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NowCodingQuotaCard } from '../src/client/NowCodingQuotaCard.tsx'
import { getQuota, notifyNowCodingSettingsCommitted, type NowCodingQuotaView } from '../src/client/api.ts'

vi.mock('../src/client/api.ts', async importOriginal => ({
  ...await importOriginal<typeof import('../src/client/api.ts')>(),
  getQuota: vi.fn(),
}))
vi.mock('../src/client/NowCodingQuotaCard.module.css', () => ({ default: {} }))
beforeEach(() => { vi.mocked(getQuota).mockReset() })

const quota: NowCodingQuotaView = {
  enabled: true, currency: '¥', refreshSeconds: 300,
  snapshot: {
    source: 'subscription', total: 150, used: 30, remaining: 120, unlimited: false,
    accessUntil: 0, resetAt: 2_000, fetchedAt: 1_000, subscriptionCount: 2,
    planTitle: 'Daily + Monthly',
  },
}

async function mount(): Promise<ReactTestRenderer> {
  let view!: ReactTestRenderer
  await act(async () => { view = create(createElement(NowCodingQuotaCard)) })
  return view
}

function text(view: ReactTestRenderer): string {
  return JSON.stringify(view.toJSON())
}

describe('quota card', () => {
  it('shows the aggregate allowance, plan count and nearest reset without implying a shared period', async () => {
    vi.mocked(getQuota).mockResolvedValue(quota)
    const view = await mount()
    expect(text(view)).toContain('订阅合计剩余 ¥120')
    expect(text(view)).toContain('/ ¥150')
    expect(text(view)).toContain('2 份订阅合计 · 最近')
    expect(text(view)).not.toContain('每日额度')
    act(() => { view.unmount() })
  })

  it('preserves the single-plan label and period when talking to an older host', async () => {
    vi.mocked(getQuota).mockResolvedValue({ ...quota, snapshot: { ...quota.snapshot!, subscriptionCount: undefined, resetPeriod: 'daily' } })
    const view = await mount()
    expect(text(view)).toContain('订阅剩余 ¥120')
    expect(text(view)).toContain('每日额度')
    expect(text(view)).not.toContain('份订阅')
    act(() => { view.unmount() })
  })

  it.each(['success', 'failure'])('does not let an old %s overwrite a newer refresh', async outcome => {
    let resolveOld!: (value: NowCodingQuotaView) => void
    let rejectOld!: (reason: Error) => void
    vi.mocked(getQuota).mockImplementationOnce(() => new Promise((resolve, reject) => {
      resolveOld = resolve
      rejectOld = reject
    })).mockResolvedValue(quota)
    const view = await mount()
    expect(text(view)).toContain('余量读取中')
    await act(async () => { notifyNowCodingSettingsCommitted() })
    expect(text(view)).toContain('订阅合计剩余 ¥120')
    await act(async () => {
      if (outcome === 'failure') rejectOld(new Error('old read failed'))
      else resolveOld({ ...quota, snapshot: { ...quota.snapshot!, remaining: 1 } })
    })
    expect(text(view)).toContain('订阅合计剩余 ¥120')
    expect(text(view)).not.toContain('余量读取失败')
    act(() => { view.unmount() })
  })

  it('replaces the balance with an error rather than showing stale numbers on the latest failure', async () => {
    vi.mocked(getQuota).mockResolvedValueOnce(quota).mockRejectedValue(new Error('offline'))
    const view = await mount()
    await act(async () => { notifyNowCodingSettingsCommitted() })
    expect(text(view)).toContain('余量读取失败')
    expect(text(view)).not.toContain('¥120')
    act(() => { view.unmount() })
  })
})
