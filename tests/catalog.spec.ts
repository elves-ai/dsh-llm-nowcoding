import { describe, expect, it } from 'vitest'
import {
  FAST_MODEL_SUFFIX,
  NOWCODING_BUILTIN_CATALOG,
  catalogEntry,
  fastModelId,
  isFastAlias,
  isFastCapable,
  selectorEntries,
  wireModelId,
} from '../src/catalog.ts'

describe('fast model aliases', () => {
  it('round-trips a wire id through its alias', () => {
    expect(fastModelId('gpt-5.6-sol')).toBe('gpt-5.6-sol' + FAST_MODEL_SUFFIX)
    expect(wireModelId('gpt-5.6-sol' + FAST_MODEL_SUFFIX)).toBe('gpt-5.6-sol')
    expect(wireModelId('gpt-5.6-sol')).toBe('gpt-5.6-sol')
    expect(fastModelId('gpt-5.6-sol' + FAST_MODEL_SUFFIX)).toBe('gpt-5.6-sol' + FAST_MODEL_SUFFIX)
  })

  it('recognizes only the alias suffix', () => {
    expect(isFastAlias('gpt-5.6-sol-fast')).toBe(true)
    expect(isFastAlias('gpt-5.6-sol')).toBe(false)
    expect(isFastAlias('fast')).toBe(false)
  })

  it('resolves an alias to its base entry', () => {
    expect(catalogEntry(NOWCODING_BUILTIN_CATALOG, 'gpt-5.6-sol-fast')?.id).toBe('gpt-5.6-sol')
    expect(catalogEntry(NOWCODING_BUILTIN_CATALOG, 'no-such-model')).toBeUndefined()
  })
})

describe('selector expansion', () => {
  it('offers a fast alias directly after every fast-capable model', () => {
    const entries = selectorEntries(NOWCODING_BUILTIN_CATALOG)
    const base = entries.findIndex(entry => entry.id === 'gpt-5.6-sol')
    expect(base).toBeGreaterThanOrEqual(0)
    expect(entries[base + 1]?.id).toBe('gpt-5.6-sol-fast')
  })

  it('offers no alias for a model without a fast tier', () => {
    const claude = NOWCODING_BUILTIN_CATALOG.find(entry => entry.id === 'claude-sonnet-5')
    expect(isFastCapable(claude)).toBe(false)
    const ids = selectorEntries(NOWCODING_BUILTIN_CATALOG).map(entry => entry.id)
    expect(ids).not.toContain('claude-sonnet-5' + FAST_MODEL_SUFFIX)
  })

  it('keeps every declared fast model aliasable and every other model plain', () => {
    for (const entry of NOWCODING_BUILTIN_CATALOG) {
      const expanded = selectorEntries([entry]).map(candidate => candidate.id)
      expect(expanded).toHaveLength(entry.fast === true ? 2 : 1)
    }
  })
})
