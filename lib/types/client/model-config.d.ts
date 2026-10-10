/** Browser-only per-model drafts; persist capability leaves without replacing other metadata. */
import type { NowCodingRemoteModelView, NowCodingSettingsEnvelope, NowCodingSettingsOp } from './api.ts';
export interface ModelConfigDraft {
    contextWindow: string;
    maxTokens: string;
    fast: boolean;
}
export declare function modelConfigDraftOf(model: NowCodingRemoteModelView): ModelConfigDraft;
/** An explicit models list owns its entries; otherwise edit modelOverrides. */
export declare function modelConfigOps(drafts: Readonly<Record<string, ModelConfigDraft>>, models: readonly NowCodingRemoteModelView[], envelope: NowCodingSettingsEnvelope): NowCodingSettingsOp[];
