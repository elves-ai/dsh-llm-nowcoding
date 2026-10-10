/** Plugin-instance session state: never provider settings or a model selector alias. */
export interface SessionFastStore {
  get(sessionId: string, model: string): boolean
  set(sessionId: string, model: string, enabled: boolean): void
}

/** Mode is scoped to an exact session/model pair; a host restart resets it. */
export function createSessionFastStore(): SessionFastStore {
  const enabledModels = new Map<string, Set<string>>()
  return {
    get: (sessionId, model) => enabledModels.get(sessionId)?.has(model) === true,
    set: (sessionId, model, enabled) => {
      const models = enabledModels.get(sessionId) ?? new Set<string>()
      if (enabled) models.add(model)
      else models.delete(model)
      if (models.size > 0) enabledModels.set(sessionId, models)
      else enabledModels.delete(sessionId)
    },
  }
}
