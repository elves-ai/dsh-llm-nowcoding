import { describe, expect, it } from 'vitest'
import { NOWCODING_BUILTIN_CATALOG, type NowCodingCatalogModel } from '../src/catalog.ts'
import { listSelectableModels, resolveModelInfo } from '../src/models.ts'

/** A two-model slice of the shipped catalog: one fast-capable, one not. */
const CATALOG: readonly NowCodingCatalogModel[] = NOWCODING_BUILTIN_CATALOG.filter(
  entry => entry.id === 'gpt-5.6-sol' || entry.id === 'claude-haiku-4-5-20251001',
)

describe('listSelectableModels', () => {
  it('lists every selector entry when no allowlist is configured', () => {
    const ids = listSelectableModels('nowcoding', CATALOG).map(entry => entry.id)
    expect(ids).toEqual(['gpt-5.6-sol', 'claude-haiku-4-5-20251001'])
  })

  it('lists only the base even when base and legacy alias are allowed', () => {
    const ids = listSelectableModels('nowcoding', CATALOG, ['gpt-5.6-sol', 'gpt-5.6-sol-fast']).map(entry => entry.id)
    expect(ids).toEqual(['gpt-5.6-sol'])
  })

  it('keeps only the named model when the allowlist excludes the rest', () => {
    const ids = listSelectableModels('nowcoding', CATALOG, ['claude-haiku-4-5-20251001']).map(entry => entry.id)
    expect(ids).toEqual(['claude-haiku-4-5-20251001'])
  })

  it('shows everything again once the allowlist is emptied', () => {
    const ids = listSelectableModels('nowcoding', CATALOG, []).map(entry => entry.id)
    expect(ids).toEqual(['gpt-5.6-sol', 'claude-haiku-4-5-20251001'])
  })

  it('ignores allowlist ids the catalog does not carry instead of failing', () => {
    const ids = listSelectableModels('nowcoding', CATALOG, ['brand-new-model', 'gpt-5.6-sol']).map(entry => entry.id)
    expect(ids).toEqual(['gpt-5.6-sol'])
  })

  it('normalizes a legacy fast allowlist id to the base row', () => {
    const ids = listSelectableModels('nowcoding', CATALOG, ['gpt-5.6-sol-fast']).map(entry => entry.id)
    expect(ids).toEqual(['gpt-5.6-sol'])
  })
})

describe('official model metadata projection', () => {
  it('keeps vision and resolved metadata on base rows', () => {
    const rows = listSelectableModels('nowcoding', NOWCODING_BUILTIN_CATALOG, ['gpt-6.1-sol'])
    expect(rows.map(row => row.id)).toEqual(['gpt-6.1-sol'])
    for (const row of rows) {
      expect(row.inputModalities).toEqual(['text', 'image'])
      expect(resolveModelInfo({ provider: 'nowcoding', model: row.id, catalog: NOWCODING_BUILTIN_CATALOG }))
        .toMatchObject({ context: { contextWindow: 1_050_000 }, defaultMaxTokens: 128_000, inputModalities: ['text', 'image'] })
    }
  })
})
