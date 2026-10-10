export interface ModelSelection {
    provider: string;
    model: string;
    reasoningEffort?: string;
}
export interface ModelDirectoryState {
    current: ModelSelection | null;
    groups: readonly {
        id: string;
        models: readonly {
            id: string;
        }[];
    }[];
    status: 'idle' | 'loading' | 'ready' | 'selecting' | 'error';
}
export interface ModelDirectory {
    store: {
        subscribe(listener: () => void): () => void;
        getSnapshot(): ModelDirectoryState;
    };
    load(): Promise<unknown>;
    select(selection: ModelSelection): Promise<void>;
}
/** Use the host's advertised alias pair, so overrides/allowlists stay authoritative. */
export declare function fastControlOf(state: ModelDirectoryState): {
    active: boolean;
    selection: ModelSelection;
} | undefined;
