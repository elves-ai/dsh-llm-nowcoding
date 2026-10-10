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
  select(selection: ModelSelection): Promise<void | { ok: true; value?: unknown } | { ok: false; error: { code: string; message: string } }>
}

/** Judge the selected model using Host capability, independently of picker rows. */
export function fastControlOf(state: ModelDirectoryState, fastModels: readonly string[]): {
  active: boolean
  selection: ModelSelection
} | undefined {
  const current = state.current
  if (current?.provider !== 'nowcoding') return undefined
  const active = isFastAlias(current.model)
  const model = active ? wireModelId(current.model) : fastModelId(current.model)
  // A previously selected alias can always return to standard, even after
  // capability/visibility changes. No duplicate fast row is required.
  if (!active && !fastModels.includes(current.model)) return undefined
  return { active, selection: { ...current, model } }
}
