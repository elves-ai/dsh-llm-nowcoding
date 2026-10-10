import { createElement } from 'react'
import { NOWCODING_BUILTIN_CATALOG } from '../src/catalog.ts'
import { listSelectableModels } from '../src/models.ts'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fastControlOf, type ModelDirectory, type ModelDirectoryState, type ModelSelection } from '../src/client/fast-control.ts'
import { NowCodingFastToggle, type NowCodingFastToggleProps } from '../src/client/NowCodingFastToggle.tsx'
import { apply, type ClientContext } from '../src/client/index.tsx'
import { getFastModels, notifyNowCodingSettingsCommitted } from '../src/client/api.ts'

vi.mock('../src/client/api.ts', async importOriginal => ({
  ...await importOriginal<typeof import('../src/client/api.ts')>(),
  getFastModels: vi.fn(),
}))
const FAST_MODELS = ['gpt-5.4']
beforeEach(() => { vi.mocked(getFastModels).mockReset().mockResolvedValue({ models: FAST_MODELS }) })

vi.mock('../src/client/NowCodingFastToggle.module.css', () => ({ default: {} }))
vi.mock('../src/client/NowCodingDetailPage.module.css', () => ({ default: {} }))
vi.mock('../src/client/NowCodingQuotaCard.module.css', () => ({ default: {} }))

function directoryDouble(current: ModelSelection | null = { provider: 'nowcoding', model: 'gpt-5.4', reasoningEffort: 'xhigh' }) {
  let state: ModelDirectoryState = {
    current, status: 'ready',
    groups: [{ id: 'nowcoding', models: [{ id: 'gpt-5.4' }] }],
  }
  const listeners = new Set<() => void>()
  const update = (patch: Partial<ModelDirectoryState>) => {
    state = { ...state, ...patch }
    for (const listener of listeners) listener()
  }
  const select = vi.fn(async (selection: ModelSelection) => { update({ current: selection }) })
  const directory: ModelDirectory = {
    store: { getSnapshot: () => state, subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener) } } },
    load: vi.fn(async () => undefined), select,
  }
  return { directory, select, update }
}

async function mount(directory: ModelDirectory, overrides: Partial<NowCodingFastToggleProps> = {}) {
  let view!: ReactTestRenderer
  const props = { directory, available: true, input: { phase: 'plain' }, session: { running: false }, ...overrides }
  await act(async () => { view = create(createElement(NowCodingFastToggle, props)) })
  return { view, props, button: () => view.root.findByType('button') }
}

describe('session fast control', () => {
  it('switches both ways, preserves reasoning, and follows host selection changes', async () => {
    const { directory, select, update } = directoryDouble()
    const { view, button } = await mount(directory)
    expect(button().props['aria-pressed']).toBe(false)
    await act(async () => { button().props.onClick() })
    expect(select).toHaveBeenLastCalledWith({ provider: 'nowcoding', model: 'gpt-5.4-fast', reasoningEffort: 'xhigh' })
    expect(button().props['aria-pressed']).toBe(true)
    await act(async () => { button().props.onClick() })
    expect(select).toHaveBeenLastCalledWith({ provider: 'nowcoding', model: 'gpt-5.4', reasoningEffort: 'xhigh' })
    act(() => { update({ current: { provider: 'nowcoding', model: 'gpt-5.4-fast' } }) })
    expect(button().props['aria-pressed']).toBe(true)
    act(() => { view.unmount() })
  })

  it('switches both ways through the Host exact advertised-id availability guard', async () => {
    const { directory, update } = directoryDouble()
    const rows = listSelectableModels('nowcoding', NOWCODING_BUILTIN_CATALOG, ['gpt-5.4'])
    directory.select = vi.fn(async selection => {
      // The Host checks listModels membership before selecting AND before sending.
      if (!rows.some(row => row.id === selection.model)) return {
        ok: false as const,
        error: { code: 'session/model-unavailable', message: 'Select an available model before sending a message.' },
      }
      update({ current: selection })
      return { ok: true as const }
    })
    const { view, button } = await mount(directory)
    await act(async () => { button().props.onClick() })
    expect(button().props['aria-pressed']).toBe(true)
    expect(directory.store.getSnapshot().current).toEqual({ provider: 'nowcoding', model: 'gpt-5.4-fast', reasoningEffort: 'xhigh' })
    expect(view.root.findAllByProps({ role: 'alert' })).toHaveLength(0)
    await act(async () => { button().props.onClick() })
    expect(button().props['aria-pressed']).toBe(false)
    expect(directory.store.getSnapshot().current?.reasoningEffort).toBe('xhigh')
    act(() => { view.unmount() })
  })

  it('does not offer fast for other providers, unsupported, unknown or unloaded models', async () => {
    for (const current of [null, { provider: 'openai-codex', model: 'gpt-5.4' }, { provider: 'nowcoding', model: 'claude-sonnet-5' }, { provider: 'nowcoding', model: 'unknown' }]) {
      const { directory } = directoryDouble(current)
      expect(fastControlOf(directory.store.getSnapshot(), FAST_MODELS)).toBeUndefined()
      const { view } = await mount(directory)
      expect(view.toJSON()).toBeNull()
      act(() => { view.unmount() })
    }
  })

  it('uses Host capability without fast picker rows or a client catalog', () => {
    const { directory, update } = directoryDouble({ provider: 'nowcoding', model: 'custom' })
    expect(fastControlOf(directory.store.getSnapshot(), [])).toBeUndefined()
    update({ groups: [] })
    expect(fastControlOf(directory.store.getSnapshot(), ['custom'])?.selection.model).toBe('custom-fast')
    update({ current: { provider: 'nowcoding', model: 'custom-fast' } })
    expect(fastControlOf(directory.store.getSnapshot(), [])?.selection.model).toBe('custom')
  })

  it('updates visibility when the selected model or Host capability changes', async () => {
    const { directory, update } = directoryDouble()
    const { view, button } = await mount(directory)
    expect(button().props['aria-pressed']).toBe(false)
    act(() => { update({ current: { provider: 'nowcoding', model: 'unknown' } }) })
    expect(view.toJSON()).toBeNull()
    act(() => { update({ current: { provider: 'nowcoding', model: 'gpt-5.4' } }) })
    expect(button().props['aria-pressed']).toBe(false)
    vi.mocked(getFastModels).mockResolvedValueOnce({ models: [] })
    await act(async () => { notifyNowCodingSettingsCommitted() })
    expect(view.toJSON()).toBeNull()
    act(() => { view.unmount() })
  })

  it('loads an idle directory on mount, without needing the picker to open', async () => {
    const { directory, update } = directoryDouble(null)
    update({ status: 'idle' })
    vi.mocked(directory.load).mockImplementation(async () => {
      update({ current: { provider: 'nowcoding', model: 'gpt-5.4' }, status: 'ready' })
    })
    const { view, button } = await mount(directory)
    expect(directory.load).toHaveBeenCalledOnce()
    expect(button().props['aria-pressed']).toBe(false)
    act(() => { view.unmount() })
  })

  it('reads current Host hook props without requiring legacy owner snapshots', async () => {
    const { directory, select } = directoryDouble()
    let running = false
    const { view, props, button } = await mount(directory, {
      input: undefined, session: undefined,
      useInput: selector => selector({ phase: 'plain' }),
      useSession: selector => selector({ running }),
    })
    expect(button().props.disabled).toBe(false)
    await act(async () => { button().props.onClick() })
    expect(select).toHaveBeenCalledOnce()
    running = true
    act(() => { view.update(createElement(NowCodingFastToggle, props)) })
    expect(button().props.disabled).toBe(true)
    act(() => { view.unmount() })
  })

  it('reports returned Host failures as well as thrown failures', async () => {
    const { directory } = directoryDouble()
    directory.select = vi.fn(async () => ({ ok: false as const, error: { code: 'OFFLINE', message: 'offline' } }))
    const { view, button } = await mount(directory)
    await act(async () => { button().props.onClick() })
    expect(button().props['aria-pressed']).toBe(false)
    expect(view.root.findByProps({ role: 'alert' }).children.join('')).toContain('OFFLINE')
    act(() => { view.unmount() })
  })

  it('hides addressed child controls and locks during running/submitting/selecting', async () => {
    const { directory, select, update } = directoryDouble()
    const { view, props, button } = await mount(directory, { available: false })
    expect(view.toJSON()).toBeNull()
    await act(async () => { view.update(createElement(NowCodingFastToggle, { ...props, available: true, session: { running: true } })) })
    expect(button().props.disabled).toBe(true)
    await act(async () => { button().props.onClick() })
    expect(select).not.toHaveBeenCalled()
    act(() => { view.update(createElement(NowCodingFastToggle, { ...props, available: true, input: { phase: 'submitting' } })) })
    expect(button().props.disabled).toBe(true)
    act(() => { view.update(createElement(NowCodingFastToggle, { ...props, available: true })); update({ status: 'selecting' }) })
    expect(button().props.disabled).toBe(true)
    act(() => { view.unmount() })
  })

  it('keeps the host-confirmed mode on rejection and allows retry', async () => {
    const { directory, select } = directoryDouble()
    select.mockRejectedValueOnce(new Error('offline'))
    const { view, button } = await mount(directory)
    await act(async () => { button().props.onClick() })
    expect(button().props['aria-pressed']).toBe(false)
    expect(view.root.findByProps({ role: 'alert' }).children.join('')).toContain('offline')
    await act(async () => { button().props.onClick() })
    expect(button().props['aria-pressed']).toBe(true)
    expect(view.root.findAllByProps({ role: 'alert' })).toHaveLength(0)
    act(() => { view.unmount() })
  })

  it('deduplicates rapid clicks and does not change another session', async () => {
    const first = directoryDouble()
    const second = directoryDouble()
    let resolve!: () => void
    first.select.mockImplementationOnce(() => new Promise<void>(done => { resolve = done }))
    const { view, button } = await mount(first.directory)
    act(() => { button().props.onClick(); button().props.onClick() })
    expect(first.select).toHaveBeenCalledTimes(1)
    expect(button().props.disabled).toBe(true)
    expect(second.directory.store.getSnapshot().current?.model).toBe('gpt-5.4')
    await act(async () => { resolve() })
    act(() => { view.unmount() })
  })

  it('registers the lightning control in the model-left slot with a scoped directory', () => {
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
    expect(slot.component).toBe(NowCodingFastToggle)
    expect(slot.options.inject('parent')).toEqual({ directory, available: true })
    expect(slot.options.inject('child').available).toBe(false)
  })
})
