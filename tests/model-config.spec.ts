import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NowCodingDetailPage } from '../src/client/NowCodingDetailPage.tsx'
import { modelConfigDraftOf, modelConfigOps } from '../src/client/model-config.ts'
import * as api from '../src/client/api.ts'
import type { NowCodingRemoteModelView, NowCodingSettingsEnvelope } from '../src/client/api.ts'

vi.mock('../src/client/NowCodingDetailPage.module.css', () => ({ default: {} }))
vi.mock('../src/client/api.ts', async importOriginal => ({
  ...await importOriginal<typeof import('../src/client/api.ts')>(),
  getNowCodingSettings: vi.fn(), getModelList: vi.fn(), getQuota: vi.fn(), getServedModels: vi.fn(), mutateNowCodingSettings: vi.fn(),
}))
const MODEL: NowCodingRemoteModelView = { id: 'gpt-5.4', known: true, configuration: { contextWindow: 1_050_000, maxTokens: 128_000, fast: true, input: ['text', 'image'] } }
const ENVELOPE: NowCodingSettingsEnvelope = { value: {}, revision: 3, writable: true, secrets: [], applies: 'live' }

beforeEach(() => {
  vi.mocked(api.getNowCodingSettings).mockReset().mockResolvedValue(ENVELOPE)
  vi.mocked(api.getModelList).mockReset().mockResolvedValue({ models: [MODEL] })
  vi.mocked(api.getServedModels).mockReset().mockResolvedValue({ models: [] })
  vi.mocked(api.getQuota).mockReset().mockResolvedValue({ enabled: false, snapshot: null, currency: '¥', refreshSeconds: 300 })
  vi.mocked(api.mutateNowCodingSettings).mockReset().mockResolvedValue({ ...ENVELOPE, revision: 4 })
})

describe('model configuration drafts', () => {
  it('uses Host metadata without bundling client defaults', () => {
    expect(modelConfigDraftOf(MODEL)).toEqual({ contextWindow: '1050000', maxTokens: '128000', fast: true, image: true })
    expect(modelConfigDraftOf({ id: 'new', known: false })).toEqual({ contextWindow: '', maxTokens: '', fast: false, image: false })
  })
  it('writes only changed leaves without replacing unrelated overrides', () => {
    expect(modelConfigOps({ [MODEL.id]: { ...modelConfigDraftOf(MODEL), fast: false } }, [MODEL], ENVELOPE)).toEqual([
      { op: 'set', path: ['modelOverrides', MODEL.id, 'fast'], value: false },
    ])
    expect(modelConfigOps({ [MODEL.id]: modelConfigDraftOf(MODEL) }, [MODEL], ENVELOPE)).toEqual([])
  })
  it('toggles image capability in overrides and explicit catalogs', () => {
    const draft = { ...modelConfigDraftOf(MODEL), image: false }
    expect(modelConfigOps({ [MODEL.id]: draft }, [MODEL], ENVELOPE)).toEqual([
      { op: 'set', path: ['modelOverrides', MODEL.id, 'input'], value: ['text'] },
    ])
    const envelope = { ...ENVELOPE, value: { models: [{ id: MODEL.id }] } }
    expect(modelConfigOps({ [MODEL.id]: draft }, [MODEL], envelope)).toEqual([
      { op: 'set', path: ['models', '0', 'input'], value: ['text'] },
    ])
    const textOnly = { ...MODEL, configuration: { ...MODEL.configuration!, input: ['text'] as const } }
    expect(modelConfigOps({ [MODEL.id]: modelConfigDraftOf(MODEL) }, [textOnly], ENVELOPE)).toEqual([
      { op: 'set', path: ['modelOverrides', MODEL.id, 'input'], value: ['text', 'image'] },
    ])
  })
  it('edits explicit models entries instead of ignored overrides', () => {
    const envelope = { ...ENVELOPE, value: { models: [{ id: 'other' }, { id: MODEL.id, input: ['text', 'image'] }] } }
    expect(modelConfigOps({ [MODEL.id]: { ...modelConfigDraftOf(MODEL), maxTokens: '8192' } }, [MODEL], envelope)).toEqual([
      { op: 'set', path: ['models', '1', 'maxTokens'], value: 8192 },
    ])
    expect(() => modelConfigOps({ new: { contextWindow: '100', maxTokens: '10', fast: false, image: false } }, [], envelope)).toThrow('不在自定义')
  })
  it('requires positive safe integer capacities and output within the context', () => {
    for (const number of ['', '0', '-1', '1.5', 'NaN', 'Infinity', '9007199254740992']) {
      expect(() => modelConfigOps({ [MODEL.id]: { ...modelConfigDraftOf(MODEL), contextWindow: number } }, [MODEL], ENVELOPE)).toThrow('正整数')
    }
    expect(() => modelConfigOps({ [MODEL.id]: { contextWindow: '10', maxTokens: '11', fast: true, image: true } }, [MODEL], ENVELOPE)).toThrow('不能超过')
  })
  it('adds unknown key-served models through explicit capacities', () => {
    expect(modelConfigOps({ new: { contextWindow: '4096', maxTokens: '1024', fast: false, image: false } }, [], ENVELOPE)).toEqual([
      { op: 'set', path: ['modelOverrides', 'new', 'contextWindow'], value: 4096 },
      { op: 'set', path: ['modelOverrides', 'new', 'maxTokens'], value: 1024 },
      { op: 'set', path: ['modelOverrides', 'new', 'fast'], value: false },
      { op: 'set', path: ['modelOverrides', 'new', 'input'], value: ['text'] },
    ])
  })
})

async function mount() {
  let view!: ReactTestRenderer
  await act(async () => { view = create(createElement(NowCodingDetailPage)) })
  const button = (text: string) => view.root.findAllByType('button').find(node => node.children.join('') === text)!
  await act(async () => { button('拉取模型列表').props.onClick() })
  const field = (label: string) => view.root.findByProps({ 'aria-label': MODEL.id + ' ' + label })
  return { view, button, field }
}

describe('model configuration page', () => {
  it('renders effective limits and saves token and fast edits with the revision', async () => {
    const { view, button, field } = await mount()
    expect(field('上下文窗口').props.value).toBe('1050000')
    expect(field('支持 fast').props.checked).toBe(true)
    expect(field('支持图片').props.checked).toBe(true)
    act(() => { field('支持图片').props.onChange({ currentTarget: { checked: false } }) })
    act(() => { field('上下文窗口').props.onChange({ currentTarget: { value: '200000' } }) })
    act(() => { field('最大输出').props.onChange({ currentTarget: { value: '8192' } }) })
    act(() => { field('支持 fast').props.onChange({ currentTarget: { checked: false } }) })
    await act(async () => { button('保存').props.onClick() })
    expect(api.mutateNowCodingSettings).toHaveBeenCalledWith(expect.arrayContaining([
      { op: 'set', path: ['modelOverrides', MODEL.id, 'contextWindow'], value: 200000 },
      { op: 'set', path: ['modelOverrides', MODEL.id, 'maxTokens'], value: 8192 },
      { op: 'set', path: ['modelOverrides', MODEL.id, 'input'], value: ['text'] },
      { op: 'set', path: ['modelOverrides', MODEL.id, 'fast'], value: false },
    ]), 3)
    act(() => { view.unmount() })
  })
  it('blocks invalid values without sending a save', async () => {
    const { view, button, field } = await mount()
    act(() => { field('最大输出').props.onChange({ currentTarget: { value: '0' } }) })
    await act(async () => { button('保存').props.onClick() })
    expect(api.mutateNowCodingSettings).not.toHaveBeenCalled()
    expect(view.root.findAllByProps({ role: 'alert' }).some(node => node.children.join('').includes('正整数'))).toBe(true)
    act(() => { view.unmount() })
  })
  it('resets drafts and disables edits in read-only deployments', async () => {
    const { view, button, field } = await mount()
    act(() => { field('支持 fast').props.onChange({ currentTarget: { checked: false } }) })
    await act(async () => { button('重置').props.onClick() })
    expect(field('支持 fast').props.checked).toBe(true)
    act(() => { view.unmount() })
    vi.mocked(api.getNowCodingSettings).mockResolvedValue({ ...ENVELOPE, writable: false })
    const readOnly = await mount()
    expect(readOnly.field('上下文窗口').props.disabled).toBe(true)
    expect(readOnly.field('最大输出').props.disabled).toBe(true)
    expect(readOnly.field('支持图片').props.disabled).toBe(true)
    expect(readOnly.field('支持 fast').props.disabled).toBe(true)
    expect(readOnly.button('保存').props.disabled).toBe(true)
    act(() => { readOnly.view.unmount() })
  })
})
