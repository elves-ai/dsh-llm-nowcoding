/**
 * DRAFT (not installed): the on-disk `src/client/index.tsx` plus the
 * `settings.section` registration the brief asks for. Adopt both together — the
 * page needs the settings helpers this draft's `api.ts` adds.
 *
 * @module @elves-ai/dsh-llm-nowcoding/client
 */

import type { ReactElement } from 'react'
import { NowCodingQuotaCard } from './NowCodingQuotaCard.tsx'
import { NowCodingSettingsSection } from './NowCodingSettingsSection.tsx'

/**
 * The slots operations this plugin calls, declared structurally: importing the
 * shell's `SlotMap` would pin a third-party bundle to one client build.
 */
interface SlotsSeat {
  inject(name: 'sidebar.footer.action' | 'settings.section', contribute: () => void | (() => void)): void
  register(
    options: { name: 'sidebar.footer.action' | 'settings.section'; id: string; order?: number; label?: string },
    component: () => ReactElement | null,
  ): () => void
}

/** The browser plugin context share this half reads. */
interface ClientContext {
  slots: SlotsSeat
}

/** Required services before mounting. */
export const inject = ['slots']

/**
 * Register the sidebar balance card and the NowCoding settings page.
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
  ctx.slots.inject('settings.section', () => {
    ctx.slots.register({
      name: 'settings.section',
      id: 'nowcoding',
      order: 78,
      label: 'NowCoding',
    }, NowCodingSettingsSection)
  })
}
