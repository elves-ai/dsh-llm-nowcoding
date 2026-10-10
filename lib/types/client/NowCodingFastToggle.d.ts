/** Session-local fast switch, immediately before the composer model seat. */
import { type ReactElement } from 'react';
import { type ModelDirectory } from './fast-control.ts';
interface InputSnapshot {
    phase: string;
}
interface SessionSnapshot {
    running: boolean;
    removed?: boolean;
}
type SnapshotHook<T> = <R>(selector: (snapshot: T) => R) => R | undefined;
export interface NowCodingFastToggleProps {
    directory: ModelDirectory;
    sessionId: string;
    available: boolean;
    input?: InputSnapshot;
    session?: SessionSnapshot;
    useInput?: SnapshotHook<InputSnapshot>;
    useSession?: SnapshotHook<SessionSnapshot>;
}
export declare function NowCodingFastToggle({ directory, sessionId, available, input, session, useInput, useSession }: NowCodingFastToggleProps): ReactElement | null;
export {};
