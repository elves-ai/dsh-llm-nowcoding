/**
 * The browser half: registers the composer lightning switch, sidebar balance
 * card, and NowCoding detail page on the sidebar's Plugins page.
 *
 * The configuration UI lives on that detail page, not in DSH Settings. The
 * 0.1.7 host moved a bundle's own configuration onto its page in the Plugins
 * section and names `plugins.bundle.config` as where a third-party bundle's
 * configuration belongs, keyed by the bundle's package name; the page exists
 * while this plugin's Loader row is on, because `dsh-client-modules` attaches
 * this half to that row.
 *
 * All contributions are effect-based: `slots.inject` waits for the slot to
 * exist, so a host that never declares one simply never runs its
 * registration.
 *
 * @module @elves-ai/dsh-llm-nowcoding/client
 */
import type { ReactElement } from 'react';
import { type NowCodingFastToggleProps } from './NowCodingFastToggle.tsx';
import type { ModelDirectory } from './fast-control.ts';
/**
 * The slots operations this plugin calls, declared structurally: importing the
 * shell's `SlotMap` would pin a third-party bundle to one client build.
 */
interface SlotsSeat {
    inject(name: 'sidebar.footer.action' | 'plugins.bundle.config', contribute: () => void | (() => void)): void;
    register(options: {
        name: 'conversation.input.right';
        id: string;
        order: number;
        inject(sessionId: string): Pick<NowCodingFastToggleProps, 'directory' | 'available' | 'sessionId'>;
    }, component: (props: NowCodingFastToggleProps) => ReactElement | null): () => void;
    inject(name: 'conversation.input.right', contribute: () => void | (() => void)): void;
    register(options: {
        name: 'sidebar.footer.action';
        id: string;
        order?: number;
        label?: string;
    } | {
        name: 'plugins.bundle.config';
        key: string;
    }, component: (owner?: {
        view?: string;
    }) => ReactElement | null): () => void;
}
/** The browser plugin context share this half reads. */
export interface ClientContext {
    slots: SlotsSeat;
    get(name: 'modelDirectories'): {
        directoryFor(sessionId: string): ModelDirectory;
    };
    get(name: 'sessions'): {
        subagentAddress(sessionId: string): unknown;
    };
    inject(services: string[], callback: (scope: ClientContext) => void): void;
}
/** Required services before mounting. */
export declare const inject: string[];
/**
 * Register the composer fast switch, balance card, and NowCoding detail page.
 * @param ctx - the browser plugin context.
 */
export declare function apply(ctx: ClientContext): void;
export {};
