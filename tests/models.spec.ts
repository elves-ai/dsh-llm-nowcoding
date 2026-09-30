import { describe, expect, it } from 'vitest'
import { NOWCODING_BUILTIN_CATALOG, type NowCodingCatalogModel } from '../src/catalog.ts'
import { listSelectableModels } from '../src/models.ts'

/** A two-model slice of the shipped catalog: one fast-capable, one not. */
const CATALOG: readonly NowCodingCatalogModel[] = NOWCODING_BUILTIN_CATALOG.filter(
  entry => entry.id === 'gpt-5.6-sol' || entry.id === 'claude-haiku-4-5-20251001',
)

describe('listSelectableModels', () => {
  it('lists every selector entry when no allowlist is configured', () => {
    const ids = listSelectableModels('nowcoding', CATALOG).map(entry => entry.id)
    expect(ids).toEqual(['gpt-5.6-sol', 'gpt-5.6-sol-fast', 'claude-haiku-4-5-20251001'])
  })

  it('keeps a fast alias when the allowlist names its base model', () => {
    const ids = listSelectableModels('nowcoding', CATALOG, ['gpt-5.6-sol']).map(entry => entry.id)
    expect(ids).toEqual(['gpt-5.6-sol', 'gpt-5.6-sol-fast'])
  })

  it('keeps only the named model when the allowlist excludes the rest', () => {
    const ids = listSelectableModels('nowcoding', CATALOG, ['claude-haiku-4-5-20251001']).map(entry => entry.id)
    expect(ids).toEqual(['claude-haiku-4-5-20251001'])
  })

  it('shows everything again once the allowlist is emptied', () => {
    const ids = listSelectableModels('nowcoding', CATALOG, []).map(entry => entry.id)
    expect(ids).toEqual(['gpt-5.6-sol', 'gpt-5.6-sol-fast', 'claude-haiku-4-5-20251001'])
  })

  it('ignores allowlist ids the catalog does not carry instead of failing', () => {
    const ids = listSelectableModels('nowcoding', CATALOG, ['brand-new-model', 'gpt-5.6-sol']).map(entry => entry.id)
    expect(ids).toEqual(['gpt-5.6-sol', 'gpt-5.6-sol-fast'])
  })

  it('matches a hand-written alias id in the allowlist to its own row only', () => {
    const ids = listSelectableModels('nowcoding', CATALOG, ['gpt-5.6-sol-fast']).map(entry => entry.id)
    expect(ids).toEqual(['gpt-5.6-sol-fast'])
  })
})
