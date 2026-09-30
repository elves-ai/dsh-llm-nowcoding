/**
 * The NowCoding detail page — the body of the page a click into this plugin on
 * the sidebar's Plugins page opens (`plugins.bundle.config`). The same content
 * used to be a DSH Settings section; the host moved a bundle's configuration
 * onto its own detail page, and the plugin followed.
 *
 * The page holds every control the plugin configures: API key (write-only,
 * blank keeps the current one, explicit clear), Base URL, the GPT fast switch
 * with its `allow_service_tier` caveat, the wire spelling, the sidebar-card
 * switch, the model allowlist (a picker over the key-scoped listing the Host
 * fetches), the console sign-in, and a quota block with an explicit refresh.
 * The console credential is the sign-in's alone — the page carries no manual
 * token fields — and it carries no update feature either: updating is the
 * app's Plugins page's or `dsh plugin update`'s job.
 *
 * No shell import: the component takes no props (the seat passes `view` only)
 * and every control is plain HTML styled by the CSS module, so the bundle pins
 * no client-build types. The wire face is `./api.ts`.
 *
 * @module @elves-ai/dsh-llm-nowcoding/client/NowCodingDetailPage
 */
import { type ReactElement } from 'react';
/**
 * Render the NowCoding detail page.
 * @returns the page element tree.
 */
export declare function NowCodingDetailPage(): ReactElement | null;
