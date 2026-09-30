/**
 * DRAFT (not installed): the on-disk `src/client/index.tsx` plus the
 * `settings.section` registration the brief asks for. Adopt both together — the
 * page needs the settings helpers this draft's `api.ts` adds.
 *
 * @module @elves-ai/dsh-llm-nowcoding/client
 */
import type { ReactElement } from 'react';
/**
 * The slots operations this plugin calls, declared structurally: importing the
 * shell's `SlotMap` would pin a third-party bundle to one client build.
 */
interface SlotsSeat {
    inject(name: 'sidebar.footer.action' | 'settings.section', contribute: () => void | (() => void)): void;
    register(options: {
        name: 'sidebar.footer.action' | 'settings.section';
        id: string;
        order?: number;
        label?: string;
    }, component: () => ReactElement | null): () => void;
}
/** The browser plugin context share this half reads. */
interface ClientContext {
    slots: SlotsSeat;
}
/** Required services before mounting. */
export declare const inject: string[];
/**
 * Register the sidebar balance card and the NowCoding settings page.
 * @param ctx - the browser plugin context.
 */
export declare function apply(ctx: ClientContext): void;
export {};
