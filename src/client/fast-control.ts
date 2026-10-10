/** Structural faces of the host-owned per-session model directory. No runtime imports. */
import { fastModelId, isFastAlias, wireModelId } from '../catalog.ts'

export interface ModelSelection {
  provider: string
  model: string
  reasoningEffort?: string
}

export interface ModelDirectoryState {
  current: ModelSelection | null
  groups: readonly { id: string; models: readonly { id: string }[] }[]
  status: 'idle' | 'loading' | 'ready' | 'selecting' | 'error'
}

export interface ModelDirectory {
  store: {
    subscribe(listener: () => void): () => void
    getSnapshot(): ModelDirectoryState
  }
  load(): Promise<unknown>
  select(selection: ModelSelection): Promise<void>
}

/** Use the host's advertised alias pair, so overrides/allowlists stay authoritative. */
export function fastControlOf(state: ModelDirectoryState): {
  active: boolean
  selection: ModelSelection
} | undefined {
  const current = state.current
  if (current?.provider !== 'nowcoding') return undefined
  const active = isFastAlias(current.model)
  const model = active ? wireModelId(current.model) : fastModelId(current.model)
  const group = state.groups.find(group => group.id === current.provider)
  // A previously selected alias must always be able to return to standard,
  // even if a settings edit has removed that pair from the advisory listing.
  if (!active && !group?.models.some(entry => entry.id === model)) return undefined
  return { active, selection: { ...current, model } }
}
