/**
 * Remaining-balance card for the sidebar foot.
 *
 * Registers into `sidebar.footer.action`, directly beside the Settings row.
 * The Host owns every decision the card renders — whether it is enabled, the
 * amounts, and the refresh interval — so the card holds no configuration of its
 * own and needs no props; it reads the fenced `/nowcoding/api` route instead.
 *
 * @module @elves-ai/dsh-llm-nowcoding/client/NowCodingQuotaCard
 */
import { type ReactElement } from 'react';
/**
 * The sidebar balance card.
 * @returns the card, or null while the user has it switched off.
 */
export declare function NowCodingQuotaCard(): ReactElement | null;
