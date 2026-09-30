import { describe, expect, it } from 'vitest'
import { NOWCODING_BUILTIN_CATALOG, catalogEntry } from '../src/catalog.ts'
import { decideFastTier, modelSupportsFast } from '../src/fast.ts'

const gpt = catalogEntry(NOWCODING_BUILTIN_CATALOG, 'gpt-5.6-sol')
const claude = catalogEntry(NOWCODING_BUILTIN_CATALOG, 'claude-sonnet-5')

describe('decideFastTier', () => {
  it('sends no service tier when neither the alias nor the route asks for fast', () => {
    expect(decideFastTier({ modelId: 'gpt-5.6-sol', routeDefault: false, entry: gpt, wireValue: 'priority' }))
      .toEqual({ requested: false })
  })

  it('sends the configured spelling when the route default is on', () => {
    expect(decideFastTier({ modelId: 'gpt-5.6-sol', routeDefault: true, entry: gpt, wireValue: 'priority' }))
      .toEqual({ requested: true, serviceTier: 'priority' })
    expect(decideFastTier({ modelId: 'gpt-5.6-sol', routeDefault: true, entry: gpt, wireValue: 'fast' }))
      .toEqual({ requested: true, serviceTier: 'fast' })
  })

  it('treats the alias as an explicit request even when the route default is off', () => {
    expect(decideFastTier({ modelId: 'gpt-5.6-sol-fast', routeDefault: false, entry: gpt, wireValue: 'priority' }))
      .toEqual({ requested: true, serviceTier: 'priority' })
  })

  it('drops the field rather than sending it for a model with no fast tier', () => {
    expect(decideFastTier({ modelId: 'claude-sonnet-5', routeDefault: true, entry: claude, wireValue: 'priority' }))
      .toEqual({ requested: true, droppedForModel: true })
  })

  it('drops the field for a model the catalog does not describe', () => {
    expect(decideFastTier({ modelId: 'unknown', routeDefault: true, entry: undefined, wireValue: 'priority' }))
      .toEqual({ requested: true, droppedForModel: true })
  })

  it('reports fast capability from the catalog entry', () => {
    expect(modelSupportsFast(gpt)).toBe(true)
    expect(modelSupportsFast(claude)).toBe(false)
    expect(modelSupportsFast(undefined)).toBe(false)
  })
})
