/** Browser-only per-model drafts; persist capability leaves without replacing other metadata. */
import type { NowCodingRemoteModelView, NowCodingSettingsEnvelope, NowCodingSettingsOp } from './api.ts'

export interface ModelConfigDraft {
  contextWindow: string
  maxTokens: string
  fast: boolean
  image: boolean
}

export function modelConfigDraftOf(model: NowCodingRemoteModelView): ModelConfigDraft {
  return {
    contextWindow: model.configuration === undefined ? '' : String(model.configuration.contextWindow),
    maxTokens: model.configuration === undefined ? '' : String(model.configuration.maxTokens),
    fast: model.configuration?.fast ?? false,
    image: model.configuration?.input.includes('image') ?? false,
  }
}

/** An explicit models list owns its entries; otherwise edit modelOverrides. */
export function modelConfigOps(
  drafts: Readonly<Record<string, ModelConfigDraft>>,
  models: readonly NowCodingRemoteModelView[],
  envelope: NowCodingSettingsEnvelope,
): NowCodingSettingsOp[] {
  const value = envelope.value as { models?: readonly { id: string }[] } | null
  const configured = value?.models
  const explicit = Array.isArray(configured) && configured.length > 0
  const ops: NowCodingSettingsOp[] = []
  for (const [id, draft] of Object.entries(drafts)) {
    const contextWindow = Number(draft.contextWindow)
    const maxTokens = Number(draft.maxTokens)
    if (!Number.isSafeInteger(contextWindow) || contextWindow < 1 || !Number.isSafeInteger(maxTokens) || maxTokens < 1) {
      throw new Error(id + '：上下文窗口和最大输出必须是正整数。')
    }
    if (maxTokens > contextWindow) throw new Error(id + '：最大输出不能超过上下文窗口（输入与输出合计）。')
    const index = explicit ? configured.findIndex(model => model.id === id) : -1
    if (explicit && index < 0) throw new Error(id + '：不在自定义 models 目录中，请先在 profile 中添加该模型。')
    const original = models.find(model => model.id === id)?.configuration
    for (const [field, next] of Object.entries({ contextWindow, maxTokens, fast: draft.fast })) {
      const key = field as 'contextWindow' | 'maxTokens' | 'fast'
      if (original !== undefined && original[key] === next) continue
      ops.push({ op: 'set', path: explicit ? ['models', String(index), key] : ['modelOverrides', id, key], value: next })
    }
    if (original === undefined || original.input.includes('image') !== draft.image) {
      ops.push({ op: 'set', path: explicit ? ['models', String(index), 'input'] : ['modelOverrides', id, 'input'],
        value: draft.image ? ['text', 'image'] : ['text'] })
    }
  }
  return ops
}
