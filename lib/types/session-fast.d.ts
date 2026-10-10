/** Plugin-instance session state: never provider settings or a model selector alias. */
export interface SessionFastStore {
    get(sessionId: string, model: string): boolean;
    set(sessionId: string, model: string, enabled: boolean): void;
}
/** Mode is scoped to an exact session/model pair; a host restart resets it. */
export declare function createSessionFastStore(): SessionFastStore;
