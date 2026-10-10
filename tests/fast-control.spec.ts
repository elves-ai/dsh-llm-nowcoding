import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fastControlOf, type ModelDirectory, type ModelDirectoryState, type ModelSelection } from '../src/client/fast-control.ts'
import { NowCodingFastToggle, type NowCodingFastToggleProps } from '../src/client/NowCodingFastToggle.tsx'
import { apply, type ClientContext } from '../src/client/index.tsx'
import { getFastModels, getSessionFast, setSessionFast, notifyNowCodingSettingsCommitted } from '../src/client/api.ts'

vi.mock('../src/client/api.ts', async importOriginal => ({
  ...await importOriginal<typeof import('../src/client/api.ts')>(),
  getFastModels: vi.fn(), getSessionFast: vi.fn(), setSessionFast: vi.fn(),
}))
vi.mock('../src/client/NowCodingFastToggle.module.css', () => ({ default: {} }))
vi.mock('../src/client/NowCodingDetailPage.module.css', () => ({ default: {} }))
vi.mock('../src/client/NowCodingQuotaCard.module.css', () => ({ default: {} }))
beforeEach(() => {
  vi.mocked(getFastModels).mockReset().mockResolvedValue({ models: ['gpt-5.4'] })
  vi.mocked(getSessionFast).mockReset().mockResolvedValue({ enabled: false })
  vi.mocked(setSessionFast).mockReset().mockImplementation(async (_session, _model, enabled) => ({ enabled }))
})

function directoryDouble(current: ModelSelection | null = { provider: 'nowcoding', model: 'gpt-5.4', reasoningEffort: 'xhigh' }) {
  let state: ModelDirectoryState = { current, status: 'ready', groups: [{ id: 'nowcoding', models: [{ id: 'gpt-5.4' }] }] }
  const listeners = new Set<() => void>()
  const update = (patch: Partial<ModelDirectoryState>) => {
    state = { ...state, ...patch }
    for (const listener of listeners) listener()
  }
  const directory: ModelDirectory = {
    store: { getSnapshot: () => state, subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener) } } },
    load: vi.fn(async () => undefined), select: vi.fn(async () => undefined),
  }
  return { directory, update }
}
async function mount(directory: ModelDirectory, overrides: Partial<NowCodingFastToggleProps> = {}) {
  let view!: ReactTestRenderer
  const props = { directory, sessionId: 'first', available: true, input: { phase: 'plain' }, session: { running: false }, ...overrides }
  await act(async () => { view = create(createElement(NowCodingFastToggle, props)) })
  return { view, props, button: () => view.root.findByType('button') }
}

describe('session fast control', () => {
  it('switches both ways without changing the host model or reasoning', async () => {
    const { directory } = directoryDouble()
    const { view, button } = await mount(directory)
    expect(button().props['aria-pressed']).toBe(false)
    await act(async () => { button().props.onClick() })
    expect(setSessionFast).toHaveBeenLastCalledWith('first', 'gpt-5.4', true)
    expect(button().props['aria-pressed']).toBe(true)
    await act(async () => { button().props.onClick() })
    expect(setSessionFast).toHaveBeenLastCalledWith('first', 'gpt-5.4', false)
    expect(button().props['aria-pressed']).toBe(false)
    expect(directory.select).not.toHaveBeenCalled()
    expect(directory.store.getSnapshot().current).toEqual({ provider: 'nowcoding', model: 'gpt-5.4', reasoningEffort: 'xhigh' })
    act(() => { view.unmount() })
  })
  it('hides other providers and models not marked fast-capable', async () => {
    for (const current of [null, { provider: 'openai-codex', model: 'gpt-5.4' }, { provider: 'nowcoding', model: 'unknown' }]) {
      const { directory } = directoryDouble(current)
      expect(fastControlOf(directory.store.getSnapshot(), ['gpt-5.4'])).toBeUndefined()
      const { view } = await mount(directory)
      expect(view.toJSON()).toBeNull()
      act(() => { view.unmount() })
    }
  })
  it('follows host capability edits and preserves a base-only picker', async () => {
    const { directory } = directoryDouble()
    const { view } = await mount(directory)
    vi.mocked(getFastModels).mockResolvedValue({ models: [] })
    await act(async () => { notifyNowCodingSettingsCommitted() })
    expect(view.toJSON()).toBeNull()
    expect(directory.select).not.toHaveBeenCalled()
    act(() => { view.unmount() })
  })
  it('loads an idle directory without opening the model picker', async () => {
    const { directory, update } = directoryDouble(null)
    update({ status: 'idle' })
    vi.mocked(directory.load).mockImplementation(async () => { update({ current: { provider: 'nowcoding', model: 'gpt-5.4' }, status: 'ready' }) })
    const { view, button } = await mount(directory)
    expect(directory.load).toHaveBeenCalledOnce()
    expect(button().props.disabled).toBe(false)
    act(() => { view.unmount() })
  })
  it('locks during running, submitting, selection and addressed child sessions', async () => {
    const { directory, update } = directoryDouble()
    const { view, props, button } = await mount(directory, { available: false })
    expect(view.toJSON()).toBeNull()
    await act(async () => { view.update(createElement(NowCodingFastToggle, { ...props, available: true, session: { running: true } })) })
    expect(button().props.disabled).toBe(true)
    await act(async () => { button().props.onClick() })
    expect(setSessionFast).not.toHaveBeenCalled()
    await act(async () => { view.update(createElement(NowCodingFastToggle, { ...props, available: true, input: { phase: 'submitting' } })) })
    expect(button().props.disabled).toBe(true)
    act(() => { view.update(createElement(NowCodingFastToggle, { ...props, available: true })); update({ status: 'selecting' }) })
    expect(button().props.disabled).toBe(true)
    act(() => { view.unmount() })
  })
  it('keeps host-confirmed mode on rejection and allows retry', async () => {
    const { directory } = directoryDouble()
    vi.mocked(setSessionFast).mockRejectedValueOnce(new Error('offline'))
    const { view, button } = await mount(directory)
    await act(async () => { button().props.onClick() })
    expect(button().props['aria-pressed']).toBe(false)
    expect(view.root.findByProps({ role: 'alert' }).children.join('')).toContain('offline')
    await act(async () => { button().props.onClick() })
    expect(button().props['aria-pressed']).toBe(true)
    act(() => { view.unmount() })
  })
  it('deduplicates rapid clicks and isolates sessions', async () => {
    const first = await mount(directoryDouble().directory)
    const second = await mount(directoryDouble().directory, { sessionId: 'second' })
    let resolve!: (value: { enabled: boolean }) => void
    vi.mocked(setSessionFast).mockImplementationOnce(() => new Promise(done => { resolve = done }))
    act(() => { first.button().props.onClick(); first.button().props.onClick() })
    expect(setSessionFast).toHaveBeenCalledTimes(1)
    expect(first.button().props.disabled).toBe(true)
    expect(second.button().props['aria-pressed']).toBe(false)
    await act(async () => { resolve({ enabled: true }) })
    expect(first.button().props['aria-pressed']).toBe(true)
    act(() => { first.view.unmount(); second.view.unmount() })
  })
  it('uses host hooks without legacy snapshots', async () => {
    const { directory } = directoryDouble()
    let running = false
    const { view, props, button } = await mount(directory, {
      input: undefined, session: undefined,
      useInput: selector => selector({ phase: 'plain' }),
      useSession: selector => selector({ running }),
    })
    expect(button().props.disabled).toBe(false)
    await act(async () => { button().props.onClick() })
    expect(button().props['aria-pressed']).toBe(true)
    running = true
    await act(async () => { view.update(createElement(NowCodingFastToggle, props)) })
    expect(button().props.disabled).toBe(true)
    act(() => { view.unmount() })
  })
  it('does not apply an old toggle response to a newly selected model', async () => {
    const { directory, update } = directoryDouble()
    vi.mocked(getFastModels).mockResolvedValue({ models: ['gpt-5.4', 'custom'] })
    const { view, button } = await mount(directory)
    let resolve!: (value: { enabled: boolean }) => void
    vi.mocked(setSessionFast).mockImplementationOnce(() => new Promise(done => { resolve = done }))
    act(() => { button().props.onClick() })
    await act(async () => { update({ current: { provider: 'nowcoding', model: 'custom' } }) })
    await act(async () => { resolve({ enabled: true }) })
    expect(button().props['aria-pressed']).toBe(false)
    expect(directory.select).not.toHaveBeenCalled()
    act(() => { view.unmount() })
  })
  it('does not assume a mode when its host read fails', async () => {
    vi.mocked(getSessionFast).mockRejectedValueOnce(new Error('offline'))
    const { view, button } = await mount(directoryDouble().directory)
    expect(button().props.disabled).toBe(true)
    expect(view.root.findByProps({ role: 'alert' }).children.join('')).toContain('offline')
    await act(async () => { button().props.onClick() })
    expect(setSessionFast).not.toHaveBeenCalled()
    act(() => { view.unmount() })
  })
  it('restores host mode on remount and ignores stale reads after model changes', async () => {
    const { directory, update } = directoryDouble()
    vi.mocked(getSessionFast).mockResolvedValueOnce({ enabled: true })
    const { view, button } = await mount(directory)
    expect(button().props['aria-pressed']).toBe(true)
    vi.mocked(getFastModels).mockResolvedValue({ models: ['gpt-5.4', 'custom'] })
    await act(async () => { notifyNowCodingSettingsCommitted() })
    let resolve!: (value: { enabled: boolean }) => void
    vi.mocked(getSessionFast).mockImplementationOnce(() => new Promise(done => { resolve = done }))
    act(() => { update({ current: { provider: 'nowcoding', model: 'custom' } }) })
    expect(button().props.disabled).toBe(true)
    await act(async () => { update({ current: { provider: 'nowcoding', model: 'gpt-5.4' } }) })
    await act(async () => { resolve({ enabled: true }) })
    expect(button().props['aria-pressed']).toBe(false)
    act(() => { view.unmount() })
  })
  it('registers the lightning control with exact session identity', () => {
    const { directory } = directoryDouble()
    const registrations: { options: any; component: any }[] = []
    const ctx = {
      slots: { inject: (_: string, contribute: () => void) => contribute(), register: (options: any, component: any) => { registrations.push({ options, component }); return () => {} } },
      get: (name: string) => name === 'sessions' ? { subagentAddress: (id: string) => id === 'child' ? {} : undefined } : { directoryFor: () => directory },
      inject: (_: string[], contribute: (scope: ClientContext) => void) => contribute(ctx as ClientContext),
    }
    apply(ctx as ClientContext)
    const slot = registrations.find(entry => entry.options.id === 'nowcoding-fast')!
    expect(slot.options.name).toBe('conversation.input.right')
    expect(slot.options.inject('parent')).toEqual({ directory, sessionId: 'parent', available: true })
    expect(slot.options.inject('child').available).toBe(false)
  })
})
