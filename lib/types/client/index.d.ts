/**
 * The browser half: registers the sidebar balance card and the NowCoding
 * detail page — the page a click into this plugin on the sidebar's Plugins
 * page opens.
 *
 * The configuration UI lives on that detail page, not in DSH Settings. The
 * 0.1.7 host moved a bundle's own configuration onto its page in the Plugins
 * section and names `plugins.bundle.config` as where a third-party bundle's
 * configuration belongs, keyed by the bundle's package name; the page exists
 * while this plugin's Loader row is on, because `dsh-client-modules` attaches
 * this half to that row.
 *
 * Both contributions are effect-based: `slots.inject` waits for the slot to
 * exist, so a host that never declares one simply never runs its
 * registration.
 *
 * @module @elves-ai/dsh-llm-nowcoding/client
 */
import type { ReactElement } from 'react';
/**
 * The slots operations this plugin calls, declared structurally: importing the
 * shell's `SlotMap` would pin a third-party bundle to one client build.
 */
interface SlotsSeat {
    inject(name: 'sidebar.footer.action' | 'plugins.bundle.config', contribute: () => void | (() => void)): void;
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
interface ClientContext {
    slots: SlotsSeat;
}
/** Required services before mounting. */
export declare const inject: string[];
/**
 * Register the sidebar balance card and the NowCoding detail page.
 * @param ctx - the browser plugin context.
 */
export declare function apply(ctx: ClientContext): void;
export {};
