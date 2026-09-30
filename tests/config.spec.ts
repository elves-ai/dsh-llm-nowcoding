import { describe, expect, it } from 'vitest'
import { NOWCODING_BUILTIN_CATALOG } from '../src/catalog.ts'
import { DEFAULT_CONTEXT_WINDOW, DEFAULT_MAX_TOKENS, effectiveCatalog } from '../src/config.ts'

describe('effectiveCatalog', () => {
  it('serves the shipped catalog when nothing is configured', () => {
    expect(effectiveCatalog({}).map(entry => entry.id)).toEqual(NOWCODING_BUILTIN_CATALOG.map(entry => entry.id))
  })

  it('replaces the catalog wholesale when models is configured', () => {
    const catalog = effectiveCatalog({ models: [{ id: 'acme-think', contextWindow: 8_192 }] })
    expect(catalog.map(entry => entry.id)).toEqual(['acme-think'])
    expect(catalog[0]?.contextWindow).toBe(8_192)
    expect(catalog[0]?.name).toBe('acme-think')
    expect(catalog[0]?.input).toEqual(['text'])
  })

  it('defaults a configured entry from the shipped model of the same id', () => {
    const catalog = effectiveCatalog({ models: [{ id: 'gpt-5.6-sol', maxTokens: 4_096 }] })
    expect(catalog[0]?.maxTokens).toBe(4_096)
    expect(catalog[0]?.name).toBe('GPT-5.6 Sol')
    expect(catalog[0]?.contextWindow).toBe(
      NOWCODING_BUILTIN_CATALOG.find(entry => entry.id === 'gpt-5.6-sol')?.contextWindow,
    )
  })

  it('reshapes one shipped model through modelOverrides without replacing the rest', () => {
    const catalog = effectiveCatalog({ modelOverrides: { 'gpt-5.6-sol': { fast: false, name: 'Renamed' } } })
    expect(catalog).toHaveLength(NOWCODING_BUILTIN_CATALOG.length)
    const entry = catalog.find(candidate => candidate.id === 'gpt-5.6-sol')
    expect(entry?.fast).toBe(false)
    expect(entry?.name).toBe('Renamed')
  })

  it('adds an override that names a model the shipped catalog does not carry', () => {
    const catalog = effectiveCatalog({ modelOverrides: { 'brand-new-model': { contextWindow: 4_096 } } })
    const entry = catalog.find(candidate => candidate.id === 'brand-new-model')
    expect(entry?.contextWindow).toBe(4_096)
    expect(catalog).toHaveLength(NOWCODING_BUILTIN_CATALOG.length + 1)
  })

  it('ignores modelOverrides beside an explicit models list', () => {
    const catalog = effectiveCatalog({
      models: [{ id: 'acme-think' }],
      modelOverrides: { 'acme-think': { name: 'Should not apply' } },
    })
    expect(catalog[0]?.name).toBe('acme-think')
  })

  it('hides configured ids without deleting their catalog entry', () => {
    const catalog = effectiveCatalog({ hiddenModels: ['gpt-6-astra', 'grok-4.3'] })
    expect(catalog.map(entry => entry.id)).not.toContain('gpt-6-astra')
    expect(catalog).toHaveLength(NOWCODING_BUILTIN_CATALOG.length - 2)
  })

  it('falls back to the route capacity for an unsized model', () => {
    const catalog = effectiveCatalog({ models: [{ id: 'unsized' }], defaultContextWindow: 1_024, defaultMaxTokens: 64 })
    expect(catalog[0]?.contextWindow).toBe(1_024)
    expect(catalog[0]?.maxTokens).toBe(64)
    expect(catalog[0]?.contextWindow).not.toBe(DEFAULT_CONTEXT_WINDOW)
    expect(catalog[0]?.maxTokens).not.toBe(DEFAULT_MAX_TOKENS)
  })
})
