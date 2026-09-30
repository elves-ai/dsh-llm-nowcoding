/**
 * DRAFT (not installed): the "NowCoding" page for `settings.section`.
 *
 * The on-disk client half has no settings page — it relies on the Models page's
 * generated provider editor. Drop this file in only if the product wants the
 * dedicated page the brief describes: API key (write-only, blank keeps the
 * current one, explicit clear), Base URL, the GPT fast switch with its
 * `allow_service_tier` caveat, the wire spelling, the sidebar-card switch, and
 * a quota block with an explicit refresh.
 *
 * No shell import: the component takes no props (the shell's `close` is
 * unused) and every control is plain HTML styled by the CSS module, so the
 * bundle pins no client-build types. The wire face is `./api.ts`.
 *
 * @module @elves-ai/dsh-llm-nowcoding/client/NowCodingSettingsSection
 */
import { type ReactElement } from 'react';
/**
 * Render the NowCoding settings page.
 * @returns the section element tree.
 */
export declare function NowCodingSettingsSection(): ReactElement | null;
