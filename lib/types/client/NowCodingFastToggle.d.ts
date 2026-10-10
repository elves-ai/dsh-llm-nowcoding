/** Session-local fast switch, immediately before the composer model seat. */
import { type ReactElement } from 'react';
import { type ModelDirectory } from './fast-control.ts';
export interface NowCodingFastToggleProps {
    directory: ModelDirectory;
    available: boolean;
    input: {
        phase: string;
    };
    session: {
        running: boolean;
        removed?: boolean;
    };
}
export declare function NowCodingFastToggle({ directory, available, input, session }: NowCodingFastToggleProps): ReactElement | null;
