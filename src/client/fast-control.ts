/** Structural faces of the host-owned per-session model directory. No runtime imports. */


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
export function fastControlOf(state: ModelDirectoryState, fastModels: readonly string[]): ModelSelection | undefined {
  const current = state.current
  if (current?.provider !== 'nowcoding' || !fastModels.includes(current.model)) return undefined
  return current
}
