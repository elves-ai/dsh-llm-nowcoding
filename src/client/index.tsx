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

import type { ReactElement } from 'react'
import { NowCodingQuotaCard } from './NowCodingQuotaCard.tsx'
import { NowCodingDetailPage } from './NowCodingDetailPage.tsx'
import { NOWCODING_PACKAGE_NAME } from './package.ts'

/**
 * The slots operations this plugin calls, declared structurally: importing the
 * shell's `SlotMap` would pin a third-party bundle to one client build.
 */
interface SlotsSeat {
  inject(name: 'sidebar.footer.action' | 'plugins.bundle.config', contribute: () => void | (() => void)): void
  register(
    options:
      | { name: 'sidebar.footer.action'; id: string; order?: number; label?: string }
      | { name: 'plugins.bundle.config'; key: string },
    component: (owner?: { view?: string }) => ReactElement | null,
  ): () => void
}

/** The browser plugin context share this half reads. */
interface ClientContext {
  slots: SlotsSeat
}

/** Required services before mounting. */
export const inject = ['slots']

/**
 * Register the sidebar balance card and the NowCoding detail page.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  ctx.slots.inject('sidebar.footer.action', () => {
    ctx.slots.register({
      name: 'sidebar.footer.action',
      id: 'nowcoding-quota',
      order: 50,
    }, NowCodingQuotaCard)
  })
  ctx.slots.inject('plugins.bundle.config', () => {
    ctx.slots.register({
      name: 'plugins.bundle.config',
      key: NOWCODING_PACKAGE_NAME,
    }, (owner) => {
      // The host's contract renders a bundle's configuration with
      // `view: 'page'` only; `summary` is other seats' one-liner view. An
      // absent view is treated as the page — the guard exists so a host that
      // starts summarizing this seat collapses it, not embeds the whole form.
      if (owner?.view === 'summary') return null
      return NowCodingDetailPage()
    })
  })
}
