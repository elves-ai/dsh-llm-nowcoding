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

/** Literal official specifications; no network is reached by the unit suite. */
describe('official GPT model specifications', () => {
  it.each([
    ['gpt-6-astra', 1_050_000], ['gpt-6-sol', 1_050_000], ['gpt-6.1-sol', 1_050_000],
    ['gpt-5.6-sol', 1_050_000], ['gpt-5.6-terra', 1_050_000], ['gpt-5.6-luna', 1_050_000],
    ['gpt-5.5', 1_050_000], ['gpt-5.4', 1_050_000],
    ['gpt-5.4-mini', 400_000], ['gpt-5.3-codex', 400_000],
  ])('declares the official window, output cap and vision input for %s', (id, contextWindow) => {
    expect(catalogEntry(NOWCODING_BUILTIN_CATALOG, String(id))).toMatchObject({
      contextWindow, maxTokens: 128_000, input: ['text', 'image'],
    })
  })

  it('does not invent vision or a larger context for the text-only Spark preview', () => {
    expect(catalogEntry(NOWCODING_BUILTIN_CATALOG, 'gpt-5.3-codex-spark')).toMatchObject({
      contextWindow: 128_000, input: ['text'],
    })
  })

  it.each([
    ['gpt-6.1-sol', ['low', 'medium', 'high', 'xhigh', 'max']],
    ['gpt-6-astra', ['low', 'medium', 'high', 'xhigh', 'max']],
    ['gpt-6-sol', ['none', 'low', 'medium', 'high', 'xhigh', 'max']],
    ['gpt-5.6-sol', ['none', 'low', 'medium', 'high', 'xhigh', 'max']],
    ['gpt-5.4', ['none', 'low', 'medium', 'high', 'xhigh']],
    ['gpt-5.3-codex', ['low', 'medium', 'high', 'xhigh']],
  ])('offers only the official reasoning levels for %s', (id, efforts) => {
    expect(Object.keys(catalogEntry(NOWCODING_BUILTIN_CATALOG, id)?.reasoningEfforts ?? {})).toEqual(efforts)
  })

  it('keeps gateway-only aliases visibly unverified', () => {
    for (const id of ['gpt-5.4-openai-compact', 'codex-auto-review']) {
      expect(catalogEntry(NOWCODING_BUILTIN_CATALOG, id)?.description).toContain('unverified')
    }
  })
})
