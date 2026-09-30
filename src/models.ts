/**
 * Exact-route model metadata for the NowCoding provider route.
 *
 * The catalog is advisory for routing and authoritative for metadata: the loop
 * may request any model id, and this module answers what is known about the one
 * it names. Nothing here performs I/O — a missing catalog entry is answered
 * from the route fallbacks rather than by interrogating the gateway mid-request.
 *
 * @module @elves-ai/dsh-llm-nowcoding/models
 */

import type { LlmModelInfo, LlmModelReasoningInfo, LlmReasoningEffortInfo, LlmResolvedModelInfo } from '@deepseek-ai/dsh-llm'
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm/brand'
import { catalogEntry, selectorEntries, type NowCodingCatalogModel } from './catalog.ts'

/**
 * Project one catalog entry's reasoning levels into the seam's selectable shape.
 * @param entry - the resolved catalog entry.
 * @returns the selectable efforts in catalog order, or undefined for a model that declares none.
 */
export function reasoningInfoFor(entry: NowCodingCatalogModel | undefined): LlmModelReasoningInfo | undefined {
  const efforts = entry?.reasoningEfforts
  if (efforts === undefined || efforts === false) return undefined
  const ids = Object.keys(efforts)
  if (ids.length === 0) return undefined
  const list: LlmReasoningEffortInfo[] = ids.map(id => ({ id: ReasoningEffortId(id), name: id }))
  const fallback = entry?.defaultReasoningEffort
  return {
    efforts: list,
    ...fallback !== undefined && ids.includes(fallback) ? { defaultEffort: ReasoningEffortId(fallback) } : {},
  }
}

/**
 * Resolve every attribute known about one exact model.
 *
 * A model the catalog does not describe still answers: the route serves any id
 * the gateway accepts, so an unknown one reports its identity and the route's
 * fallback capacity instead of being refused.
 *
 * @param input - the provider route, the requested model id, and the served catalog.
 * @returns the resolved metadata; `context` is present only when a window is known.
 */
export function resolveModelInfo(input: {
  provider: string
  model: string
  catalog: readonly NowCodingCatalogModel[]
}): LlmResolvedModelInfo {
  const entry = catalogEntry(input.catalog, input.model)
  const reasoning = reasoningInfoFor(entry)
  if (entry === undefined) return { provider: input.provider, id: input.model, name: input.model }
  return {
    provider: input.provider,
    id: input.model,
    name: entry.name,
    ...entry.description !== undefined ? { description: entry.description } : {},
    inputModalities: entry.input,
    context: { contextWindow: entry.contextWindow },
    defaultMaxTokens: entry.maxTokens,
    ...reasoning !== undefined ? { reasoning } : {},
  }
}

/**
 * List the entries a model picker offers, fast aliases included.
 * @param provider - the provider route that owns these models.
 * @param catalog - the served catalog.
 * @returns one entry per selectable picker row, in catalog order.
 */
export function listSelectableModels(
  provider: string,
  catalog: readonly NowCodingCatalogModel[],
): readonly LlmModelInfo[] {
  return selectorEntries(catalog).map((entry): LlmModelInfo => ({
    provider,
    id: entry.id,
    name: entry.name,
    ...entry.description !== undefined ? { description: entry.description } : {},
    inputModalities: entry.input,
  }))
}
