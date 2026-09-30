import { EMPTY_RESPONSE_CODE, LlmAdapter, LlmError, ProviderRequestId, ToolCallId, attributionHeaders } from "@deepseek-ai/dsh-llm";
import { ReasoningEffortId } from "@deepseek-ai/dsh-llm/brand";
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment";
import z from "@deepseek-ai/schemastery";
import { SettingsConflictError } from "@deepseek-ai/dsh-settings";
//#region src/catalog.ts
/** Reasoning levels the OpenAI GPT line accepts, in escalating order. */
const GPT_REASONING = {
	minimal: "minimal",
	low: "low",
	medium: "medium",
	high: "high"
};
/** Suffix marking the fast-mode alias of a fast-capable model id. */
const FAST_MODEL_SUFFIX = "-fast";
/**
* The shipped catalog, snapshotted from the gateway's published pricing on
* 2026-09-30. Keep ids version-exact and lowercase: a near miss surfaces as a
* provider error on the first request rather than as a corrected model.
*/
const NOWCODING_BUILTIN_CATALOG = [
	{
		id: "gpt-6-astra",
		name: "GPT-6 Astra",
		description: "OpenAI flagship; fast mode available",
		contextWindow: 4e5,
		maxTokens: 128e3,
		input: ["text", "image"],
		reasoningEfforts: GPT_REASONING,
		defaultReasoningEffort: "medium",
		fast: true
	},
	{
		id: "gpt-6-sol",
		name: "GPT-6 Sol",
		description: "OpenAI mainline; fast mode available",
		contextWindow: 4e5,
		maxTokens: 128e3,
		input: ["text", "image"],
		reasoningEfforts: GPT_REASONING,
		defaultReasoningEffort: "medium",
		fast: true
	},
	{
		id: "gpt-6.1-sol",
		name: "GPT-6.1 Sol",
		description: "OpenAI mainline; fast mode available",
		contextWindow: 4e5,
		maxTokens: 128e3,
		input: ["text", "image"],
		reasoningEfforts: GPT_REASONING,
		defaultReasoningEffort: "medium",
		fast: true
	},
	{
		id: "gpt-5.6-sol",
		name: "GPT-5.6 Sol",
		description: "OpenAI mainline; fast mode available",
		contextWindow: 4e5,
		maxTokens: 128e3,
		input: ["text", "image"],
		reasoningEfforts: GPT_REASONING,
		defaultReasoningEffort: "medium",
		fast: true
	},
	{
		id: "gpt-5.6-terra",
		name: "GPT-5.6 Terra",
		description: "OpenAI budget tier; fast mode available",
		contextWindow: 4e5,
		maxTokens: 128e3,
		input: ["text", "image"],
		reasoningEfforts: GPT_REASONING,
		defaultReasoningEffort: "medium",
		fast: true
	},
	{
		id: "gpt-5.6-luna",
		name: "GPT-5.6 Luna",
		description: "Gateway redirects requests to gpt-5.6-terra and bills at the terra rate",
		contextWindow: 4e5,
		maxTokens: 128e3,
		input: ["text", "image"],
		reasoningEfforts: GPT_REASONING,
		defaultReasoningEffort: "medium",
		fast: true
	},
	{
		id: "gpt-5.5",
		name: "GPT-5.5",
		description: "Previous flagship; fast mode available",
		contextWindow: 4e5,
		maxTokens: 128e3,
		input: ["text", "image"],
		reasoningEfforts: GPT_REASONING,
		defaultReasoningEffort: "medium",
		fast: true
	},
	{
		id: "gpt-5.4",
		name: "GPT-5.4",
		description: "Previous mainline; fast mode available",
		contextWindow: 4e5,
		maxTokens: 128e3,
		input: ["text", "image"],
		reasoningEfforts: GPT_REASONING,
		defaultReasoningEffort: "medium",
		fast: true
	},
	{
		id: "gpt-5.4-mini",
		name: "GPT-5.4 mini",
		description: "Low-cost OpenAI tier",
		contextWindow: 4e5,
		maxTokens: 64e3,
		input: ["text", "image"],
		reasoningEfforts: GPT_REASONING,
		defaultReasoningEffort: "low",
		fast: true
	},
	{
		id: "gpt-5.4-openai-compact",
		name: "GPT-5.4 Compact",
		description: "Compact-context variant used by the Codex endpoint",
		contextWindow: 128e3,
		maxTokens: 64e3,
		input: ["text"],
		reasoningEfforts: GPT_REASONING,
		defaultReasoningEffort: "medium"
	},
	{
		id: "gpt-5.3-codex",
		name: "GPT-5.3 Codex",
		description: "Agentic coding model",
		contextWindow: 4e5,
		maxTokens: 128e3,
		input: ["text", "image"],
		reasoningEfforts: GPT_REASONING,
		defaultReasoningEffort: "medium"
	},
	{
		id: "gpt-5.3-codex-spark",
		name: "GPT-5.3 Codex Spark",
		description: "Low-latency agentic coding model",
		contextWindow: 4e5,
		maxTokens: 128e3,
		input: ["text", "image"],
		reasoningEfforts: GPT_REASONING,
		defaultReasoningEffort: "medium"
	},
	{
		id: "codex-auto-review",
		name: "Codex Auto Review",
		description: "Gateway-hosted automated review model",
		contextWindow: 4e5,
		maxTokens: 64e3,
		input: ["text"],
		reasoningEfforts: GPT_REASONING,
		defaultReasoningEffort: "medium"
	},
	{
		id: "claude-opus-5",
		name: "Claude Opus 5",
		description: "Anthropic deep-reasoning model",
		contextWindow: 2e5,
		maxTokens: 64e3,
		input: ["text", "image"],
		reasoningEfforts: {
			low: "low",
			medium: "medium",
			high: "high"
		},
		defaultReasoningEffort: "medium"
	},
	{
		id: "claude-sonnet-5",
		name: "Claude Sonnet 5",
		description: "Anthropic coding default",
		contextWindow: 2e5,
		maxTokens: 64e3,
		input: ["text", "image"],
		reasoningEfforts: {
			low: "low",
			medium: "medium",
			high: "high"
		},
		defaultReasoningEffort: "medium"
	},
	{
		id: "claude-sonnet-4-6",
		name: "Claude Sonnet 4.6",
		description: "Previous Anthropic coding default",
		contextWindow: 2e5,
		maxTokens: 64e3,
		input: ["text", "image"],
		reasoningEfforts: {
			low: "low",
			medium: "medium",
			high: "high"
		},
		defaultReasoningEffort: "medium"
	},
	{
		id: "claude-haiku-4-5-20251001",
		name: "Claude Haiku 4.5",
		description: "Anthropic fast tier",
		contextWindow: 2e5,
		maxTokens: 32e3,
		input: ["text", "image"],
		reasoningEfforts: false
	},
	{
		id: "grok-4.6",
		name: "Grok 4.6",
		description: "xAI flagship",
		contextWindow: 256e3,
		maxTokens: 64e3,
		input: ["text", "image"],
		reasoningEfforts: false
	},
	{
		id: "grok-4.5",
		name: "Grok 4.5",
		description: "xAI mainline",
		contextWindow: 256e3,
		maxTokens: 64e3,
		input: ["text", "image"],
		reasoningEfforts: false
	},
	{
		id: "grok-4.3",
		name: "Grok 4.3",
		description: "xAI low-cost tier",
		contextWindow: 256e3,
		maxTokens: 64e3,
		input: ["text", "image"],
		reasoningEfforts: false
	}
];
/**
* Whether an id is a fast-mode alias rather than a wire model id.
* @param id - a catalog or requested model id.
* @returns whether the id ends with {@link FAST_MODEL_SUFFIX}.
*/
function isFastAlias(id) {
	return id.endsWith(FAST_MODEL_SUFFIX);
}
/**
* The fast-mode alias id for a fast-capable model.
* @param id - the wire model id.
* @returns the alias the model picker offers beside the plain entry.
*/
function fastModelId(id) {
	return isFastAlias(id) ? id : id + FAST_MODEL_SUFFIX;
}
/**
* The wire model id a requested id resolves to.
* @param id - a requested id, with or without the fast alias.
* @returns the id to send to the gateway.
*/
function wireModelId(id) {
	return isFastAlias(id) ? id.slice(0, -5) : id;
}
/**
* Look one model up in a catalog, resolving a fast alias to its base entry.
* @param catalog - the effective catalog, built-in or configuration-supplied.
* @param id - the requested model id.
* @returns the entry, or undefined when the catalog does not describe the id.
*/
function catalogEntry(catalog, id) {
	const wire = wireModelId(id);
	return catalog.find((model) => model.id === wire);
}
/**
* Whether the gateway accepts a fast request for this model.
* @param entry - the catalog entry the request resolved to.
* @returns whether a fast `service_tier` may be sent.
*/
function isFastCapable(entry) {
	return entry?.fast === true;
}
/**
* Expand a catalog into the entries a model picker offers: every fast-capable
* model contributes its plain entry plus its fast alias.
* @param catalog - the effective catalog.
* @returns selector entries in catalog order, each fast alias after its base.
*/
function selectorEntries(catalog) {
	const entries = [];
	for (const model of catalog) {
		entries.push(model);
		if (model.fast !== true) continue;
		entries.push({
			...model,
			id: fastModelId(model.id),
			name: model.name + " (fast)",
			description: "Fast mode: same model, up to 2.5x faster, billed at the higher fast rate"
		});
	}
	return entries;
}
//#endregion
//#region src/models.ts
/**
* Project one catalog entry's reasoning levels into the seam's selectable shape.
* @param entry - the resolved catalog entry.
* @returns the selectable efforts in catalog order, or undefined for a model that declares none.
*/
function reasoningInfoFor(entry) {
	const efforts = entry?.reasoningEfforts;
	if (efforts === void 0 || efforts === false) return void 0;
	const ids = Object.keys(efforts);
	if (ids.length === 0) return void 0;
	const list = ids.map((id) => ({
		id: ReasoningEffortId(id),
		name: id
	}));
	const fallback = entry?.defaultReasoningEffort;
	return {
		efforts: list,
		...fallback !== void 0 && ids.includes(fallback) ? { defaultEffort: ReasoningEffortId(fallback) } : {}
	};
}
/**
* Resolve every attribute known about one exact model.
*
* A model the catalog does not describe still answers: the route serves any id
* the gateway accepts, so an unknown one reports its identity and the route's
* fallback capacity instead of being refused.
*
* @param input - the provider route, the requested model id, and the served catalog.
* @returns the resolved metadata; `context` is present only when a window is known.
*/
function resolveModelInfo(input) {
	const entry = catalogEntry(input.catalog, input.model);
	const reasoning = reasoningInfoFor(entry);
	if (entry === void 0) return {
		provider: input.provider,
		id: input.model,
		name: input.model
	};
	return {
		provider: input.provider,
		id: input.model,
		name: entry.name,
		...entry.description !== void 0 ? { description: entry.description } : {},
		inputModalities: entry.input,
		context: { contextWindow: entry.contextWindow },
		defaultMaxTokens: entry.maxTokens,
		...reasoning !== void 0 ? { reasoning } : {}
	};
}
/**
* List the entries a model picker offers, fast aliases included.
*
* `visibleModels` narrows the listing without touching the catalog: an empty
* or absent list shows everything, a non-empty one keeps the entries whose id
* — or whose base model's id, so a fast alias survives its base — the list
* names. {@link resolveModelInfo} is deliberately not narrowed: the route
* serves any id the gateway accepts, and hiding one from the picker must not
* strip the metadata a direct request for it still deserves.
*
* @param provider - the provider route that owns these models.
* @param catalog - the served catalog.
* @param visibleModels - the configured allowlist; order follows the catalog, not the list.
* @returns one entry per selectable picker row, in catalog order.
*/
function listSelectableModels(provider, catalog, visibleModels) {
	const entries = selectorEntries(catalog);
	if (visibleModels === void 0 || visibleModels.length === 0) return project(provider, entries);
	const allow = new Set(visibleModels);
	return project(provider, entries.filter((entry) => allow.has(entry.id) || allow.has(wireModelId(entry.id))));
}
/** Project selector entries into the seam's picker shape. */
function project(provider, entries) {
	return entries.map((entry) => ({
		provider,
		id: entry.id,
		name: entry.name,
		...entry.description !== void 0 ? { description: entry.description } : {},
		inputModalities: entry.input
	}));
}
//#endregion
//#region src/fast.ts
/**
* GPT fast-tier policy.
*
* OpenAI's fast mode is requested with a request-body `service_tier`; the
* gateway forwards it only for channels that enable its own
* `allow_service_tier` passthrough, and silently strips it otherwise. This
* module owns the one decision an adapter request needs — whether to put the
* field on the body — so the adapter never re-derives it.
*
* @module @elves-ai/dsh-llm-nowcoding/fast
*/
/**
* Decide the fast tier for one request.
* @param input - the requested model id, the route's fast default, the resolved catalog entry, and the configured wire spelling.
* @returns the decision; `serviceTier` appears only when the field should be sent.
*/
function decideFastTier(input) {
	if (!(isFastAlias(input.modelId) || input.routeDefault)) return { requested: false };
	if (!isFastCapable(input.entry)) return {
		requested: true,
		droppedForModel: true
	};
	return {
		requested: true,
		serviceTier: input.wireValue
	};
}
/**
* Whether the gateway can serve this model at the fast tier at all.
* @param entry - the resolved catalog entry.
* @returns whether a fast request is meaningful for the model.
*/
function modelSupportsFast(entry) {
	return isFastCapable(entry);
}
//#endregion
//#region src/serialize.ts
/**
* Serialize one harness request into the gateway's Chat Completions body.
*
* The projection is deliberately lossless in the two places the adapter
* contract names: tool `arguments` ride as the raw JSON string the model
* produced, and tool results keep their `tool_call_id` correlation.
*
* Image occurrences are refused rather than approximated. The adapter receives
* no attachment resolver, so it cannot read request-version bytes for
* `image_url`; substituting placeholder text would silently drop content the
* user attached, so a vision-capable request fails with `UNSUPPORTED_CONTENT`
* and the route's catalog `input` declaration is what keeps image models out of
* that state.
*
* Reasoning is dropped from assistant history: no signature or response id
* accompanies it on this route, so there is nothing to replay and no wire field
* to carry it.
*
* @module @elves-ai/dsh-llm-nowcoding/serialize
*/
/** Largest number of stop sequences the OpenAI body accepts. */
const MAX_STOP_SEQUENCES = 4;
/** Refuse a request field or content block the wire cannot carry; never drop it silently. */
function unsupported(detail) {
	throw new LlmError(`NowCoding chat completions cannot represent ${detail}`, "UNSUPPORTED_CONTENT");
}
/** Render accumulated text parts, or the part list when an image survived this far. */
function bodyOf(parts) {
	return parts.every((part) => part.type === "text") ? parts.map((part) => part.type === "text" ? part.text : "").join("") : [...parts];
}
/**
* Project one message's content into a wire body.
* @param content - durable or request-only content blocks.
* @param role - the wire role the body belongs to, which decides what may appear.
* @returns the joined text, or an ordered part list when an image is present.
* @throws {LlmError} code `UNSUPPORTED_CONTENT` for an image or an unknown block.
*/
function contentOf(content, role) {
	const parts = [];
	for (const block of content) switch (block.type) {
		case "text":
			if (block.text.length > 0) parts.push({
				type: "text",
				text: block.text
			});
			break;
		case "reasoning": break;
		case "image":
			unsupported(`an image occurrence in a ${role} message; this route sends text only`);
			break;
		case "file":
			unsupported("a file block that request assembly did not project");
			break;
		default: unsupported(`${role} content block "${block.type}"`);
	}
	return bodyOf(parts);
}
/** Project one assistant turn into text plus raw-string tool calls. */
function assistantMessage(content) {
	const parts = [];
	const toolCalls = [];
	for (const block of content) switch (block.type) {
		case "text":
			if (block.text.length > 0) parts.push({
				type: "text",
				text: block.text
			});
			break;
		case "reasoning": break;
		case "tool-call":
			toolCalls.push({
				id: block.id,
				type: "function",
				function: {
					name: block.name,
					arguments: block.arguments
				}
			});
			break;
		default: unsupported(`assistant content block "${block.type}"`);
	}
	return {
		role: "assistant",
		content: bodyOf(parts),
		...toolCalls.length === 0 ? {} : { tool_calls: toolCalls }
	};
}
/** Project one tool result into the `role: 'tool'` message that answers its call. */
function toolMessage(message) {
	const body = contentOf(message.content, "tool");
	if (typeof body !== "string") unsupported("a tool result containing an image");
	return {
		role: "tool",
		tool_call_id: message.toolCallId,
		content: message.isError === true ? `[tool error] ${body}` : body
	};
}
/** Project one non-assistant conversation turn. */
function requestMessage(message) {
	switch (message.role) {
		case "system":
		case "developer": {
			const body = contentOf(message.content, "system");
			if (typeof body !== "string") unsupported("a system message containing an image");
			return {
				role: "system",
				content: body
			};
		}
		case "user": return {
			role: "user",
			content: contentOf(message.content, "user")
		};
		case "tool": return toolMessage(message);
		case "assistant": return assistantMessage(message.content);
		default: unsupported(`message role "${String(message.role)}"`);
	}
}
/** Project the conversation, with the one-shot `system` slot ahead of it. */
function messagesOf(options) {
	const messages = [];
	if (options.system !== void 0 && options.system.length > 0) messages.push({
		role: "system",
		content: options.system
	});
	for (const message of options.messages) messages.push(requestMessage(message));
	return messages;
}
/** Project tool declarations; `deferLoading` has no wire representation and is not sent. */
function toolsOf(options) {
	if (options.tools === void 0) return void 0;
	return options.tools.map((tool) => ({
		type: "function",
		function: {
			name: tool.name,
			description: tool.description,
			parameters: tool.parameters
		}
	}));
}
/**
* Map the caller's opaque effort id through the catalog entry's table.
* @param effort - the effort id selected for this request.
* @param entry - the resolved catalog entry; absent for a model the catalog does not describe.
* @returns the wire spelling, or undefined when the model declares no level table at all.
* @throws {LlmError} code `UNSUPPORTED_REASONING_EFFORT` when the model declares reasoning
*   unsupported, or declares levels that do not contain this one.
*/
function reasoningEffort(effort, entry) {
	const table = entry?.reasoningEfforts;
	if (table === false) throw new LlmError(`NowCoding model "${entry?.id ?? ""}" does not support a reasoning effort`, "UNSUPPORTED_REASONING_EFFORT");
	if (table === void 0) return void 0;
	const wire = table[effort];
	if (wire === void 0) throw new LlmError(`NowCoding model "${entry?.id ?? ""}" does not offer the reasoning effort "${effort}"`, "UNSUPPORTED_REASONING_EFFORT");
	return wire;
}
/**
* Build one Chat Completions request body.
* @param options - the fully assembled harness request.
* @param context - the route's catalog and fast-tier configuration.
* @returns the wire body, ready to send as JSON.
* @throws {LlmError} `UNSUPPORTED_CONTENT` for a block or role this route cannot carry,
*   `UNSUPPORTED_REASONING_EFFORT` for an effort the exact model does not offer, and
*   `UNSUPPORTED_OPTION` for a stop list longer than the wire accepts.
*/
function serialize(options, context) {
	if (options.stop !== void 0 && options.stop.length > MAX_STOP_SEQUENCES) throw new LlmError(`NowCoding chat completions accepts at most ${MAX_STOP_SEQUENCES} stop sequences`, "UNSUPPORTED_OPTION");
	const entry = catalogEntry(context.catalog, options.model);
	const tier = decideFastTier({
		modelId: options.model,
		routeDefault: context.fast,
		entry,
		wireValue: context.fastServiceTier
	});
	const effort = options.reasoningEffort === void 0 ? void 0 : reasoningEffort(options.reasoningEffort, entry);
	const tools = toolsOf(options);
	return {
		model: wireModelId(options.model),
		messages: messagesOf(options),
		stream: true,
		stream_options: { include_usage: true },
		...tier.serviceTier === void 0 ? {} : { service_tier: tier.serviceTier },
		...effort === void 0 ? {} : { reasoning_effort: effort },
		...options.temperature === void 0 ? {} : { temperature: options.temperature },
		...options.maxTokens === void 0 ? {} : { max_tokens: options.maxTokens },
		...options.stop === void 0 ? {} : { stop: [...options.stop] },
		...tools === void 0 ? {} : { tools }
	};
}
//#endregion
//#region src/sse.ts
/**
* Server-sent-event framing for the gateway's `text/event-stream` response.
*
* Hand-written because the framing this route needs is small and fixed: read
* `data:` lines, stop at `[DONE]`, ignore comments and other fields, and keep
* an unterminated tail buffered across chunk boundaries. Payload decoding is
* deliberately not done here — `translate.ts` owns what a payload means, so a
* malformed payload is reported as a provider protocol failure rather than as
* a framing failure.
*
* @module @elves-ai/dsh-llm-nowcoding/sse
*/
/** Frame text terminator, in all three spellings a gateway may emit. */
const SEPARATORS = [
	"\r\n\r\n",
	"\n\n",
	"\r\r"
];
/**
* Upper bound on one buffered frame. The bound exists because an adversarial or
* broken endpoint could otherwise close the stream only after the harness has
* buffered unbounded text; a well-formed chunk is far below it.
*/
const NOWCODING_MAX_SSE_FRAME_BYTES = 8388608;
/** Index and length of the first frame terminator, or undefined when none is buffered yet. */
function nextSeparator(buffer) {
	let found;
	for (const separator of SEPARATORS) {
		const index = buffer.indexOf(separator);
		if (index === -1) continue;
		if (found === void 0 || index < found.index) found = {
			index,
			length: separator.length
		};
	}
	return found;
}
/** Join one frame's `data:` field values as the SSE specification requires. */
function dataOf(frame) {
	const values = [];
	for (const line of frame.split(/\r\n|\n|\r/u)) {
		if (!line.startsWith("data:")) continue;
		const value = line.slice(5);
		values.push(value.startsWith(" ") ? value.slice(1) : value);
	}
	return values.length === 0 ? void 0 : values.join("\n");
}
/**
* Frame one response body into SSE data payloads.
*
* The generator ends at `[DONE]` or at end of body, whichever comes first; a
* tail without a terminator is discarded, so a connection cut mid-frame cannot
* be mistaken for a complete event. Frames carrying no `data:` field (comments,
* heartbeats, bare field lines) are skipped rather than surfaced.
*
* @param body - the response body, read as UTF-8.
* @returns each frame's payload text, in arrival order.
* @throws {LlmError} code `MALFORMED_RESPONSE` when one frame exceeds {@link NOWCODING_MAX_SSE_FRAME_BYTES}.
*/
async function* parseSse(body) {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			while (true) {
				const separator = nextSeparator(buffer);
				if (separator === void 0) break;
				const frame = buffer.slice(0, separator.index);
				buffer = buffer.slice(separator.index + separator.length);
				const data = dataOf(frame);
				if (data === void 0) continue;
				if (data.trim() === "[DONE]") return;
				yield data;
			}
			if (buffer.length > 8388608) throw new LlmError(`NowCoding SSE frame exceeds ${NOWCODING_MAX_SSE_FRAME_BYTES} bytes`, "MALFORMED_RESPONSE");
		}
	} finally {
		await reader.cancel().catch(() => void 0);
	}
}
//#endregion
//#region src/settings-shared.ts
/**
* Shared "NowCoding configuration" vocabulary (types + constants), consumed by
* BOTH halves: the Host registers a settings namespace with a schemastery
* schema over these values, and the settings page plus the sidebar quota card
* in the browser read them through the plugin's own fenced `/nowcoding/api`
* route. Kept free of schemastery and `@deepseek-ai/dsh-settings` so the
* browser bundle never pulls the Host-only settings runtime in.
* @module @elves-ai/dsh-llm-nowcoding/settings-shared
*/
/** User-settings namespace carrying the NowCoding provider configuration. */
const NOWCODING_SETTINGS_NAMESPACE = "llm-nowcoding";
/** Settings fields editable from the NowCoding settings page. */
const NOWCODING_SETTINGS_FIELDS = [
	"apiKey",
	"baseURL",
	"fast",
	"fastServiceTier",
	"quotaCard",
	"panelToken",
	"panelUserId",
	"panelSession",
	"visibleModels"
];
/** Default environment variable the plugin resolves the API key from. */
const NOWCODING_DEFAULT_API_KEY_ENV = "NOWCODING_API_KEY";
/**
* Endpoint base every NowCoding model request is sent to.
*
* The gateway publishes two front ends over one host: `https://nowcoding.ai/v1`
* for the OpenAI-compatible routes and `https://nowcoding.ai` for the
* Anthropic-compatible `/v1/messages` route. This plugin speaks the
* OpenAI-compatible route, so its base carries the `/v1` segment.
*/
const NOWCODING_DEFAULT_BASE_URL = "https://nowcoding.ai/v1";
/** The gateway's OpenAI-compatible chat route, appended to the base. */
const NOWCODING_CHAT_PATH = "/chat/completions";
/** The gateway's model listing, appended to the base; reflects the key's groups. */
const NOWCODING_MODELS_PATH = "/models";
/**
* Public gateway status document, appended to the gateway origin.
*
* It carries `quota_per_unit`, the divisor every displayed amount uses, which
* is why reading a subscription balance takes two requests: the subscription
* document reports raw units and the status document says how many make one
* displayed unit.
*/
const NOWCODING_STATUS_PATH = "/api/status";
/**
* Subscription document, appended to the gateway **origin** rather than to the
* endpoint base.
*
* This is the console API, not the relay API: it reports the monthly plan's
* allowance and its consumption against it, which is the figure the gateway's
* own console shows. It authenticates with a dashboard access token, or with
* the sign-in session cookie, plus the `New-Api-User` header either way — the
* `sk-` model key is rejected on this chain, and so is either credential
* without the header.
*/
const NOWCODING_SUBSCRIPTION_PATH = "/api/subscription/self";
/**
* Console sign-in, appended to the gateway origin.
*
* The console answers with the session cookie that becomes the persisted
* console credential. The password is a parameter of this one request; nothing
* persists it.
*/
const NOWCODING_LOGIN_PATH = "/api/user/login";
/** Second sign-in step, taken only when the account has 2FA enabled. */
const NOWCODING_TWO_FACTOR_LOGIN_PATH = "/api/user/login/2fa";
/**
* Site agreement confirmation, appended to the gateway origin.
*
* The console's own web app sends this right after a successful login, so
* sign-in mirrors it once per sign-in. It is best-effort: a refusal here is
* ignored and never fails the sign-in.
*/
const NOWCODING_AGREEMENT_ACCEPT_PATH = "/api/agreement/accept?lang=zh-CN";
/** Console account document; its `access_token` member is a token fallback. */
const NOWCODING_SELF_PATH = "/api/user/self";
/** Reads the account's dashboard token without rotating it. */
const NOWCODING_SELF_ACCESS_TOKEN_PATH = "/api/user/self/access-token";
/**
* Divisor assumed when the status document cannot be read.
*
* This deployment reports `quota_per_unit: 500000`. The fallback keeps a
* balance readable while the status probe is unreachable; the snapshot records
* how many units it divided by so a wrong divisor is visible rather than silent.
*/
const NOWCODING_FALLBACK_QUOTA_PER_UNIT = 5e5;
/**
* Remaining-quota path appended to the endpoint base.
*
* The gateway is a new-api deployment, so it answers the OpenAI-compatible
* billing pair. Both spellings resolve because the base already carries
* `/v1`: `/v1/dashboard/billing/subscription` and the origin-level spelling
* reach the same handler behind the same API-key authentication as `/v1/models`.
*/
const NOWCODING_QUOTA_SUBSCRIPTION_PATH = "/dashboard/billing/subscription";
/** Companion usage path; its `total_usage` is in hundredths of the display currency. */
const NOWCODING_QUOTA_USAGE_PATH = "/dashboard/billing/usage";
/**
* `soft_limit_usd` value a gateway reports for a key with no quota limit.
*
* The field is populated from the license total, so an unmetered key reports
* this sentinel instead of a real grant. The card shows "unlimited" rather
* than a remaining balance computed against it.
*/
const NOWCODING_UNLIMITED_QUOTA_SENTINEL = 1e8;
/**
* Symbol the gateway's quota figures are displayed in.
*
* The billing document's fields are named `*_usd`, but this deployment sets
* `quota_display_type` to CNY, so the numbers it carries are yuan. Labelling
* them as dollars would overstate a balance by the exchange rate.
*/
const NOWCODING_DISPLAY_CURRENCY_SYMBOL = "¥";
/** How often the sidebar quota card re-reads the balance while it is mounted. */
const NOWCODING_DEFAULT_QUOTA_REFRESH_SECONDS = 300;
//#endregion
//#region src/wire.ts
/**
* Wire types for the NowCoding gateway's OpenAI-compatible Chat Completions
* route, plus the narrowing needed to read untrusted response JSON.
*
* Only fields this adapter sends or consumes are declared: the gateway is a
* new-api deployment that passes the OpenAI body through to whichever vendor
* channel serves the model, so any field declared here must mean the same
* thing on every channel. Narrowing guards live beside the types because the
* SSE payload is a wire boundary — nothing upstream validates it.
*
* @module @elves-ai/dsh-llm-nowcoding/wire
*/
/** True for a JSON object (never an array, never null). */
function isRecord$3(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** True for a JSON array. */
function isArray(value) {
	return Array.isArray(value);
}
/** Read a finite, non-negative integer from an untrusted usage field. */
function usageCount(value) {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : void 0;
}
/** Read a string from an untrusted delta field. */
function deltaText(value) {
	return typeof value === "string" && value.length > 0 ? value : void 0;
}
//#endregion
//#region src/transport.ts
/**
* HTTP transport for the NowCoding Chat Completions route: one request, one
* timeout, one cancellation, and one classification of every way it can fail.
*
* Failures are mapped to stable codes the harness routes on:
*
* | condition | code |
* | --- | --- |
* | HTTP 401 or 403 | `UNAUTHORIZED` |
* | HTTP 402, or an error payload naming an exhausted balance | `QUOTA` |
* | HTTP 429 | `RATE_LIMIT` |
* | any other non-success status | `PROVIDER_ERROR` |
* | success without a readable body | `EMPTY_RESPONSE` |
* | the request never completed (DNS, TLS, reset) | `TRANSPORT` |
* | the request or stream exceeded `timeoutMs` | `TIMEOUT` |
* | the caller aborted | `ABORTED` |
*
* @module @elves-ai/dsh-llm-nowcoding/transport
*/
/** Join an endpoint base and a gateway path without doubling or dropping the separator. */
function joinPath$2(baseURL, path) {
	return baseURL.replace(/\/+$/u, "") + path;
}
/** The `error` object of a gateway failure body, at either nesting level. */
function errorFields(raw) {
	const envelope = isRecord$3(raw) ? raw : {};
	const error = isRecord$3(envelope.error) ? envelope.error : envelope;
	const message = typeof error.message === "string" ? error.message : void 0;
	const type = typeof error.type === "string" ? error.type : void 0;
	const code = typeof error.code === "string" || typeof error.code === "number" ? String(error.code) : void 0;
	return {
		...message === void 0 ? {} : { message },
		...type === void 0 ? {} : { type },
		...code === void 0 ? {} : { code },
		text: [
			type,
			code,
			message
		].filter((value) => value !== void 0).join(" ")
	};
}
/** Provider-requested retry delay, when the gateway states a valid one. */
function retryAfterMs(headers) {
	const value = headers.get("retry-after");
	if (value === null) return void 0;
	if (/^\d+(?:\.\d+)?$/u.test(value)) {
		const delay = Number(value) * 1e3;
		return delay > 0 ? delay : void 0;
	}
	const at = Date.parse(value);
	if (Number.isNaN(at)) return void 0;
	return at - Date.now() > 0 ? at - Date.now() : void 0;
}
/** Provider-issued request id, from whichever header this gateway populates. */
function requestId(headers) {
	const value = headers.get("request-id") ?? headers.get("x-request-id") ?? headers.get("x-oneapi-request-id");
	return value === null || value.length === 0 ? void 0 : ProviderRequestId(value);
}
/**
* Classify one non-success response.
* @param raw - the decoded response body, or undefined when it was not JSON.
* @param status - the HTTP status.
* @param headers - the response headers.
* @returns the failure to throw, carrying status, retry delay, and request id when known.
*/
function providerError(raw, status, headers) {
	const fields = errorFields(raw);
	const detail = `${fields.text} ${fields.message ?? ""}`;
	const message = fields.message ?? `NowCoding request failed (HTTP ${status})`;
	let code;
	if (status === 401 || status === 403) code = "UNAUTHORIZED";
	else if (status === 402 || /insufficient/iu.test(detail)) code = "QUOTA";
	else if (status === 429) code = "RATE_LIMIT";
	else code = "PROVIDER_ERROR";
	const delay = retryAfterMs(headers);
	const id = requestId(headers);
	return new LlmError(message, code, {
		status,
		...delay === void 0 ? {} : { providerRetryAfterMs: delay },
		...id === void 0 ? {} : { requestId: id }
	});
}
/** Classify one transport-level failure that never produced a response. */
function transportError(error, outer, timer) {
	if (timer.aborted) return new LlmError("NowCoding request exceeded its timeout", "TIMEOUT", { cause: error });
	if (outer.aborted) return new LlmError("NowCoding request aborted", "ABORTED", { cause: error });
	return new LlmError("NowCoding transport failed", "TRANSPORT", { cause: error });
}
/**
* Send one authenticated chat request and classify every failure it can produce.
* @param input - endpoint, credential, body, cancellation, timeout, and transport override.
* @returns the response body plus the signal and disposer that own its lifetime.
* @throws {LlmError} `UNAUTHORIZED`, `QUOTA`, `RATE_LIMIT`, or `PROVIDER_ERROR` for a
*   non-success response; `EMPTY_RESPONSE` for a success without a body; `TRANSPORT`,
*   `TIMEOUT`, or `ABORTED` when the request never produced one.
*/
async function postChatCompletion(input) {
	const timer = new AbortController();
	const handle = setTimeout(() => {
		timer.abort(/* @__PURE__ */ new Error("NowCoding request timed out"));
	}, input.timeoutMs);
	const signal = input.signal === void 0 ? timer.signal : AbortSignal.any([timer.signal, input.signal]);
	signal.throwIfAborted();
	const fetchImpl = input.fetchImpl ?? globalThis.fetch;
	let response;
	try {
		response = await fetchImpl(joinPath$2(input.baseURL, NOWCODING_CHAT_PATH), {
			method: "POST",
			signal,
			redirect: "error",
			headers: {
				...attributionHeaders(),
				"content-type": "application/json",
				accept: "text/event-stream",
				authorization: `Bearer ${input.apiKey}`
			},
			body: JSON.stringify(input.body)
		});
	} catch (error) {
		clearTimeout(handle);
		throw transportError(error, signal, timer.signal);
	}
	if (!response.ok) {
		clearTimeout(handle);
		const text = await response.text().catch(() => "");
		let raw;
		try {
			raw = JSON.parse(text);
		} catch (_nonJsonGatewayError) {
			raw = { error: { message: text.length > 0 ? text : `HTTP ${response.status}` } };
		}
		throw providerError(raw, response.status, response.headers);
	}
	if (response.body === null) {
		clearTimeout(handle);
		throw new LlmError("NowCoding returned no response body", EMPTY_RESPONSE_CODE);
	}
	return {
		body: response.body,
		signal,
		dispose: () => {
			clearTimeout(handle);
			timer.abort();
		}
	};
}
//#endregion
//#region src/translate.ts
/**
* Translate the NowCoding gateway's Chat Completions chunk stream into the
* harness stream protocol.
*
* Everything here is a protocol obligation, not a preference:
*
* - Every block opens with `block-start` at the index it is first seen under,
*   and every later delta of that block reuses the index, so interleaved text
*   and tool calls stay aligned.
* - Tool `arguments` are the raw JSON fragments the channel produced; they are
*   concatenated and closed verbatim, never parsed and re-stringified.
* - `usage` is emitted before the terminal `finish`, and nothing follows the
*   finish. The gateway appends a usage-only entry after the one carrying
*   `finish_reason`, so the finish reason is held until the events end and both
*   are flushed after every open block has been closed.
*
* @module @elves-ai/dsh-llm-nowcoding/translate
*/
/** Map one wire `finish_reason` onto a harness finish kind. */
function finishOf(raw) {
	switch (raw) {
		case "stop":
		case "end_turn": return { kind: "stop" };
		case "tool_calls":
		case "function_call": return { kind: "tool-calls" };
		case "length":
		case "max_tokens": return { kind: "max-tokens" };
		default: return { kind: "stop" };
	}
}
/**
* Structural guard for one choice of a decoded payload.
* @param value - an element of a chunk's `choices` array.
* @returns true when the element is a JSON object carrying the fields read below.
*/
function isWireChoice(value) {
	return isRecord$3(value) && ("delta" in value || "finish_reason" in value);
}
/**
* Convert one wire usage object into harness token accounting.
*
* Harness counts are disjoint, so the gateway's aggregate prompt count is
* reduced by whatever it folded in as cached input; the aggregate total is
* preserved as sent.
*
* @param usage - one chunk's decoded `usage` value.
* @returns the token accounting, or undefined when the field is not an object.
*/
function usageOf(usage) {
	if (!isRecord$3(usage)) return void 0;
	const outputTokens = usageCount(usage["completion_tokens"]) ?? 0;
	const cachedTokens = isRecord$3(usage.prompt_tokens_details) ? usageCount(usage.prompt_tokens_details.cached_tokens) : void 0;
	const promptTokens = usageCount(usage.prompt_tokens);
	const inputTokens = promptTokens === void 0 ? 0 : Math.max(0, promptTokens - (cachedTokens ?? 0));
	const reasoningTokens = isRecord$3(usage.completion_tokens_details) ? usageCount(usage.completion_tokens_details.reasoning_tokens) : void 0;
	const total = usageCount(usage.total_tokens) ?? (promptTokens === void 0 ? void 0 : promptTokens + outputTokens);
	return {
		inputTokens,
		outputTokens,
		...total === void 0 ? {} : { totalTokens: total },
		...cachedTokens === void 0 ? {} : { cacheReadTokens: cachedTokens },
		...reasoningTokens === void 0 ? {} : { reasoningTokens }
	};
}
/** Whether one wire delta carries any content this route understands. */
function isEmptyDelta(delta) {
	return (delta.content ?? "") === "" && (delta.reasoning_content ?? "") === "" && (delta.reasoning ?? "") === "" && (delta.tool_calls === void 0 || delta.tool_calls.length === 0);
}
/** Validate one `tool_calls` fragment entry from an untrusted delta. */
function toolCallDelta(value) {
	if (!isRecord$3(value) || !Number.isSafeInteger(value["index"]) || value["index"] < 0) throw new LlmError("NowCoding stream carried an invalid tool call fragment", "MALFORMED_RESPONSE");
	const fn = isRecord$3(value["function"]) ? value["function"] : void 0;
	const id = value["id"];
	const name = fn?.["name"];
	const args = fn?.["arguments"];
	return {
		index: value["index"],
		...typeof id === "string" ? { id } : {},
		...fn === void 0 ? {} : { function: {
			...typeof name === "string" ? { name } : {},
			...typeof args === "string" ? { arguments: args } : {}
		} }
	};
}
/**
* Incremental translator for one Chat Completions response.
*
* One instance owns one response: it holds the block index allocation, the
* finish/usage buffer, and the terminal outcome. A caller that stops early
* calls {@link return}, which abandons the response without closing blocks —
* `block-end` exists to hand the assembler a complete block, and an
* interrupted stream is assembled from its deltas instead.
*/
var ChatStreamTranslator = class {
	blocks = [];
	toolBlocks = /* @__PURE__ */ new Map();
	/**
	* Chunks produced by the event being applied but not yet handed to the
	* consumer. One event yields two chunks when it opens a block (`block-start`
	* plus that block's first delta), so the queue drains before the next event
	* is read.
	*/
	queue = [];
	source;
	usage;
	wireFinish;
	/** Buffered terminal chunks, drained one per call once the events end. */
	terminal = [];
	finished = false;
	/**
	* @param events - SSE payload texts in arrival order, as framed by `parseSse`.
	*/
	constructor(events) {
		this.source = events[Symbol.asyncIterator]();
	}
	/**
	* Pull the next protocol chunk.
	* @returns the next chunk, or `done` once usage and finish have been flushed.
	* @throws {LlmError} code `MALFORMED_RESPONSE` for an undecodable payload, `EMPTY_RESPONSE`
	*   when the channel stopped without producing content or a tool invocation, and
	*   `STREAM_CLOSED` when the response body ended before the channel finished.
	*/
	async next() {
		while (true) {
			const produced = this.queue.shift();
			if (produced !== void 0) return {
				done: false,
				value: produced
			};
			if (this.finished) return {
				done: true,
				value: void 0
			};
			const terminal = this.terminal.shift();
			if (terminal !== void 0) {
				if (this.terminal.length === 0) this.finished = true;
				return {
					done: false,
					value: terminal
				};
			}
			const event = await this.source.next();
			if (event.done) {
				this.terminal = this.prepareTerminal();
				continue;
			}
			this.consume(event.value);
		}
	}
	/**
	* Abandon the response.
	* @returns an already-completed iterator result.
	*/
	async return() {
		this.finished = true;
		this.terminal = [];
		this.queue.length = 0;
		return {
			done: true,
			value: void 0
		};
	}
	/**
	* The outcome of one fully iterated stream.
	* @returns the reported usage (when the channel sent any) and the finish reason.
	*/
	get translation() {
		return {
			...this.usage === void 0 ? {} : { usage: this.usage },
			reason: this.reason()
		};
	}
	/** The terminal finish reason; a stream that named none is reported from its content. */
	reason() {
		if (this.wireFinish !== void 0) return finishOf(this.wireFinish);
		return this.toolBlocks.size > 0 ? { kind: "tool-calls" } : { kind: "stop" };
	}
	/** Decode one payload and apply it, queueing every chunk it produces. */
	consume(data) {
		let decoded;
		try {
			decoded = JSON.parse(data);
		} catch (error) {
			throw new LlmError("NowCoding stream carried an undecodable event", "MALFORMED_RESPONSE", { cause: error });
		}
		if (!isRecord$3(decoded)) throw new LlmError("NowCoding stream carried a non-object event", "MALFORMED_RESPONSE");
		this.accept(decoded);
	}
	/** Record what one well-formed payload reports, then apply its delta. */
	accept(payload) {
		this.usage = usageOf(payload["usage"]) ?? this.usage;
		const choices = payload["choices"];
		const first = isArray(choices) ? choices[0] : void 0;
		if (!isWireChoice(first)) return;
		const finish = first.finish_reason;
		if (typeof finish === "string" && finish.length > 0) this.wireFinish = finish;
		if (this.wireFinish !== void 0) return;
		const delta = first.delta;
		if (isRecord$3(delta) && !isEmptyDelta(delta)) this.applyDelta(delta);
	}
	/** Apply one delta, queueing `block-start` ahead of the block's first delta. */
	applyDelta(delta) {
		const content = deltaText(delta.content);
		if (content !== void 0) {
			const block = this.ensure("text");
			block.text += content;
			this.queue.push({
				type: "text-delta",
				index: block.index,
				text: content
			});
			return;
		}
		const reasoning = deltaText(delta.reasoning_content) ?? deltaText(delta.reasoning);
		if (reasoning !== void 0) {
			const block = this.ensure("reasoning");
			block.text += reasoning;
			this.queue.push({
				type: "reasoning-delta",
				index: block.index,
				text: reasoning
			});
			return;
		}
		for (const raw of delta.tool_calls ?? []) {
			const fragment = toolCallDelta(raw);
			const block = this.toolBlock(fragment);
			const id = fragment.id;
			if (id !== void 0 && id.length > 0) block.toolCallId = id;
			const name = fragment.function?.name;
			if (name !== void 0 && name.length > 0) block.toolCallName = name;
			const argumentsDelta = fragment.function?.arguments ?? "";
			if (!block.announced && (block.toolCallId === "" || block.toolCallName === "")) continue;
			block.arguments += argumentsDelta;
			this.announce(block);
			this.queue.push({
				type: "tool-call-delta",
				index: block.index,
				id: ToolCallId(block.toolCallId),
				name: block.toolCallName,
				argumentsDelta
			});
		}
	}
	/** Queue the opening `block-start` exactly once, ahead of the block's first delta. */
	announce(block) {
		if (block.announced) return;
		block.announced = true;
		this.queue.push({
			type: "block-start",
			index: block.index,
			blockType: block.type
		});
	}
	/** The single text or reasoning block this route streams, allocated on first use. */
	ensure(type) {
		const existing = this.blocks.find((block) => block.type === type);
		if (existing !== void 0) return existing;
		const block = this.allocate(type);
		this.blocks.push(block);
		this.announce(block);
		return block;
	}
	/** The block for one tool invocation position, allocated on first sight. */
	toolBlock(fragment) {
		const existing = this.toolBlocks.get(fragment.index);
		if (existing !== void 0) return existing;
		const block = this.allocate("tool-call");
		block.toolCallId = fragment.id ?? "";
		block.toolCallName = fragment.function?.name ?? "";
		this.toolBlocks.set(fragment.index, block);
		return block;
	}
	/** Allocate one open block at the next index in first-seen order. */
	allocate(type) {
		return {
			index: this.seen.length,
			type,
			text: "",
			toolCallId: "",
			toolCallName: "",
			arguments: "",
			announced: false,
			closed: false
		};
	}
	/** Every allocated block, in the order its index was assigned. */
	get seen() {
		return [...this.blocks, ...this.toolBlocks.values()].sort((left, right) => left.index - right.index);
	}
	/** Close every open block, in first-seen order. */
	closeBlocks() {
		return this.seen.filter((block) => !block.closed).map((block) => {
			block.closed = true;
			return {
				type: "block-end",
				index: block.index,
				block: this.assembled(block)
			};
		});
	}
	/** The complete block one accumulation produced. */
	assembled(block) {
		switch (block.type) {
			case "text": return {
				type: "text",
				text: block.text
			};
			case "reasoning": return {
				type: "reasoning",
				text: block.text
			};
			case "tool-call": return {
				type: "tool-call",
				id: ToolCallId(block.toolCallId),
				name: block.toolCallName,
				arguments: block.arguments
			};
		}
	}
	/** Build the terminal chunk sequence: block ends, then usage, then finish. */
	prepareTerminal() {
		if (this.seen.length === 0 && this.reason().kind === "stop") throw new LlmError("NowCoding returned no content", EMPTY_RESPONSE_CODE);
		if (this.wireFinish === void 0) throw new LlmError("NowCoding stream ended before the channel finished", "STREAM_CLOSED");
		return [
			...this.closeBlocks(),
			...this.usage === void 0 ? [] : [{
				type: "usage",
				usage: this.usage
			}],
			{
				type: "finish",
				reason: this.reason()
			}
		];
	}
};
//#endregion
//#region src/adapter.ts
/**
* The NowCoding provider route: one OpenAI-compatible Chat Completions stream
* per model call.
*
* Failure paths, decided per class:
*
* - Transport and protocol failures are THROWN from {@link NowCodingAdapter.stream}
*   as `LlmError` with the stable codes documented on `transport.ts` and
*   `translate.ts`. `LlmRuntime` normalizes a throw into a terminal
*   `finish { kind: 'error' | 'aborted' }`, so consumers see one protocol.
* - The gateway reports no failure in band: every error it can express is an
*   HTTP status or a non-JSON body, both of which precede the event stream. This
*   adapter therefore never ends a stream with `finish { kind: 'error' }`
*   itself; a consumer that sees one received it from `LlmRuntime`.
*
* Responses carry no `replayState`. The OpenAI wire format has no
* provider-issued signature or response id that a follow-up request must echo —
* tool calls replay from their id, name, and raw argument string, which are
* already durable message content — so an envelope would add bytes the next
* request never reads. `wireModelId` therefore also serves as the model
* identity in every rebuilt request.
*
* @module @elves-ai/dsh-llm-nowcoding/adapter
*/
/** NowCoding gateway adapter, speaking OpenAI Chat Completions over SSE. */
var NowCodingAdapter = class extends LlmAdapter {
	settings;
	fetchImpl;
	constructor(input) {
		super();
		if (typeof input === "function") {
			this.settings = input;
			this.fetchImpl = void 0;
		} else {
			this.settings = input.options;
			this.fetchImpl = input.fetchImpl;
		}
	}
	/**
	* Describe this route.
	* @param provider - the registered provider route.
	* @returns the route key with the configured display name.
	*/
	providerInfo(provider) {
		return {
			id: provider,
			name: this.settings().displayName
		};
	}
	/**
	* List the model picker's entries, fast aliases included, narrowed to the
	* configured `visibleModels` allowlist when one is set.
	* @param provider - one provider route owned by this adapter.
	* @returns one entry per selectable row, in catalog order.
	*/
	listModels(provider) {
		const settings = this.settings();
		return Promise.resolve(listSelectableModels(provider, settings.catalog, settings.visibleModels));
	}
	/**
	* Resolve every attribute known about one exact model.
	* @param provider - one provider route owned by this adapter.
	* @param model - the exact model id requested.
	* @returns the catalog metadata, or bare identity for a model the catalog does not describe.
	*/
	resolveModel(provider, model) {
		return Promise.resolve(resolveModelInfo({
			provider,
			model,
			catalog: this.settings().catalog
		}));
	}
	/**
	* Stream one model call.
	* @param options - the fully assembled request; `options.signal` cancels both the
	*   request and the response stream, and the timeout covers the whole response.
	* @returns the translated chunk stream, obeying the protocol obligations documented
	*   on `translate.ts`.
	* @throws {LlmError} with a stable code when the request, the transport, or the
	*   provider protocol fails; see the module JSDoc for why nothing is reported in band.
	*/
	stream(options) {
		return this.generate(options);
	}
	async *generate(options) {
		const settings = this.settings();
		const consumer = new AbortController();
		const signal = options.signal === void 0 ? consumer.signal : AbortSignal.any([consumer.signal, options.signal]);
		let translator;
		let dispose;
		try {
			signal.throwIfAborted();
			const body = serialize(options, {
				catalog: settings.catalog,
				fast: settings.fast,
				fastServiceTier: settings.fastServiceTier
			});
			const response = await postChatCompletion({
				baseURL: settings.baseURL,
				apiKey: settings.apiKey,
				body,
				signal,
				timeoutMs: settings.requestTimeoutMs,
				...this.fetchImpl === void 0 ? {} : { fetchImpl: this.fetchImpl }
			});
			dispose = response.dispose;
			translator = new ChatStreamTranslator(parseSse(response.body));
			while (true) {
				const next = await translator.next();
				if (next.done) return;
				yield next.value;
			}
		} catch (error) {
			if (error instanceof LlmError) throw error;
			if (options.signal?.aborted === true) throw new LlmError("NowCoding request aborted", "ABORTED", { cause: error });
			throw new LlmError("NowCoding transport failed", "TRANSPORT", { cause: error });
		} finally {
			await translator?.return().catch(() => void 0);
			try {
				dispose?.();
			} catch (_responseAlreadyClosed) {}
			consumer.abort();
		}
	}
};
//#endregion
//#region src/config.ts
/** Provider route this plugin registers on `ctx.llm`. */
const NOWCODING_PROVIDER_ROUTE = "nowcoding";
/** Name shown by selectors when configuration names none. */
const NOWCODING_DEFAULT_DISPLAY_NAME = "NowCoding";
/** Context capacity assumed for a model neither configuration nor the catalog sizes. */
const DEFAULT_CONTEXT_WINDOW = 262144;
/** Output capability assumed for a model neither configuration nor the catalog sizes. */
const DEFAULT_MAX_TOKENS = 32768;
/** Per-request timeout; a coding turn on a reasoning model can legitimately run long. */
const NOWCODING_DEFAULT_REQUEST_TIMEOUT_MS = 3e5;
/** Input types assumed for a model that declares none. */
const DEFAULT_INPUT = ["text"];
/** Input types the schema accepts. */
const MODALITIES = ["text", "image"];
/** Reasoning levels: a mapping of offered level to wire spelling, or `false`. */
const reasoningEfforts = z.union([z.const(false), z.dict(z.string())]);
/** Fields shared by a `models` entry and a `modelOverrides` entry. */
const overrideFields = {
	name: z.string(),
	contextWindow: z.number().step(1).min(1),
	maxTokens: z.number().step(1).min(1),
	input: z.array(z.union(MODALITIES)),
	reasoningEfforts,
	defaultReasoningEffort: z.string(),
	fast: z.boolean(),
	description: z.string()
};
const modelOverride = z.object(overrideFields);
const modelSpec = z.object({
	id: z.string().required(),
	...overrideFields
});
/**
* Composition and settings schema for the NowCoding provider route.
*
* Every field carries its default so a configuration surface renders the value
* the route actually serves, rather than an empty control that reads as "unset".
*/
const Config = z.object({
	apiKey: z.string().role("secret").volatile(),
	apiKeyEnv: z.string().role("credential-ref").default(NOWCODING_DEFAULT_API_KEY_ENV).volatile(),
	baseURL: z.string().default(NOWCODING_DEFAULT_BASE_URL).volatile(),
	displayName: z.string().default(NOWCODING_DEFAULT_DISPLAY_NAME).volatile(),
	fast: z.boolean().default(false).volatile(),
	fastServiceTier: z.union(["priority", "fast"]).default("priority").volatile(),
	quotaCard: z.boolean().default(true).volatile(),
	panelToken: z.string().role("secret").volatile(),
	panelUserId: z.string().volatile(),
	panelSession: z.string().role("secret").volatile(),
	quotaRefreshSeconds: z.number().step(1).min(30).default(300).volatile(),
	settingsNs: z.string().default(NOWCODING_SETTINGS_NAMESPACE).volatile(),
	models: z.array(modelSpec).volatile(),
	modelOverrides: z.dict(modelOverride).volatile(),
	hiddenModels: z.array(z.string()).volatile(),
	visibleModels: z.array(z.string()).volatile(),
	defaultContextWindow: z.number().step(1).min(1).default(DEFAULT_CONTEXT_WINDOW).volatile(),
	defaultMaxTokens: z.number().step(1).min(1).default(DEFAULT_MAX_TOKENS).volatile(),
	requestTimeoutMs: z.number().step(1).min(1).default(NOWCODING_DEFAULT_REQUEST_TIMEOUT_MS).volatile()
});
/**
* Build the route catalog from configuration.
*
* A `models` list replaces the shipped catalog; each entry defaults its unset
* fields from the shipped model of the same id, so narrowing the route to two
* models or correcting one capacity stays a one-line edit. An override naming
* an id the catalog does not carry is added rather than refused: a gateway
* serves models newer than any snapshot, and the entry carries what the adapter
* needs. `hiddenModels` removes ids from the result without deleting their
* catalog entry.
*
* @param config - the catalog-shaping configuration.
* @returns the served catalog in configuration order.
*/
function effectiveCatalog(config) {
	const base = config.models ?? NOWCODING_BUILTIN_CATALOG;
	const overrides = config.models === void 0 ? config.modelOverrides ?? {} : {};
	const defaultContextWindow = config.defaultContextWindow ?? 262144;
	const defaultMaxTokens = config.defaultMaxTokens ?? 32768;
	const hidden = new Set(config.hiddenModels ?? []);
	const entries = base.map((entry) => {
		const override = overrides[entry.id] ?? {};
		const shipped = NOWCODING_BUILTIN_CATALOG.find((candidate) => candidate.id === entry.id);
		return {
			id: entry.id,
			name: override.name ?? entry.name ?? shipped?.name ?? entry.id,
			contextWindow: override.contextWindow ?? entry.contextWindow ?? shipped?.contextWindow ?? defaultContextWindow,
			maxTokens: override.maxTokens ?? entry.maxTokens ?? shipped?.maxTokens ?? defaultMaxTokens,
			input: override.input ?? entry.input ?? shipped?.input ?? DEFAULT_INPUT,
			reasoningEfforts: override.reasoningEfforts ?? entry.reasoningEfforts ?? shipped?.reasoningEfforts,
			defaultReasoningEffort: override.defaultReasoningEffort ?? entry.defaultReasoningEffort ?? shipped?.defaultReasoningEffort,
			fast: override.fast ?? entry.fast ?? shipped?.fast,
			description: override.description ?? entry.description ?? shipped?.description
		};
	});
	for (const [id, override] of Object.entries(overrides)) {
		if (entries.some((entry) => entry.id === id)) continue;
		entries.push({
			id,
			name: override.name ?? id,
			contextWindow: override.contextWindow ?? defaultContextWindow,
			maxTokens: override.maxTokens ?? defaultMaxTokens,
			input: override.input ?? DEFAULT_INPUT,
			reasoningEfforts: override.reasoningEfforts,
			defaultReasoningEffort: override.defaultReasoningEffort,
			fast: override.fast,
			description: override.description
		});
	}
	return entries.filter((entry) => !hidden.has(entry.id));
}
/**
* Resolve the configuration a single operation serves from.
*
* A settings literal wins over the environment fallback; an empty one leaves
* the route configured but keyless, which fails at the first request with a
* named credential error rather than at load.
*
* @param ctx - plugin context, used to read the launch environment.
* @param config - the live configuration references.
* @returns the snapshot this operation serves from.
*/
function resolveNowCodingOptions(ctx, config) {
	const literal = config.apiKey.get();
	const apiKey = typeof literal === "string" && literal.trim().length > 0 ? literal.trim() : "";
	const envName = config.apiKeyEnv.get();
	const envValue = apiKey.length > 0 ? "" : launchEnvironmentOf(ctx).get(envName)?.value ?? "";
	const baseURL = config.baseURL.get();
	const rawVisible = config.visibleModels.get();
	const visibleModels = Array.isArray(rawVisible) ? [...new Set(rawVisible.map((id) => typeof id === "string" ? id.trim() : "").filter((id) => id.length > 0))] : [];
	return {
		apiKey: apiKey.length > 0 ? apiKey : envValue,
		baseURL: typeof baseURL === "string" && baseURL.trim().length > 0 ? baseURL.trim() : NOWCODING_DEFAULT_BASE_URL,
		displayName: config.displayName.get(),
		fast: config.fast.get(),
		fastServiceTier: config.fastServiceTier.get(),
		catalog: effectiveCatalog({
			models: config.models.get(),
			modelOverrides: config.modelOverrides.get(),
			hiddenModels: config.hiddenModels.get(),
			defaultContextWindow: config.defaultContextWindow.get(),
			defaultMaxTokens: config.defaultMaxTokens.get()
		}),
		visibleModels,
		quotaCard: config.quotaCard.get(),
		panelToken: config.panelToken.get()?.trim() ?? "",
		panelUserId: config.panelUserId.get()?.trim() ?? "",
		panelSession: config.panelSession.get()?.trim() ?? "",
		quotaRefreshSeconds: config.quotaRefreshSeconds.get(),
		requestTimeoutMs: config.requestTimeoutMs.get(),
		settingsNs: config.settingsNs.get()
	};
}
//#endregion
//#region src/live-models.ts
/**
* Live model-list reader for the NowCoding gateway.
*
* `GET {base}/v1/models` is key-scoped: it answers with exactly the models the
* configured key's groups may call, which makes it the truthful source for the
* detail page's model allowlist — every id it returns is one the key can
* actually serve. The gateway is a modified new-api deployment answering the
* OpenAI list shape, and its catalog moves under it, so the normalization
* below reads the body defensively rather than trusting it.
*
* This is a provider request: it carries `attributionHeaders()` like the chat
* path, and it classifies failures with the same vocabulary the quota reader
* uses so the fenced route maps both identically.
*
* @module @elves-ai/dsh-llm-nowcoding/live-models
*/
/** One failed model-list read, carrying the classification callers branch on. */
var NowCodingModelsError = class extends Error {
	code;
	constructor(code, message) {
		super(message);
		this.code = code;
		this.name = "NowCodingModelsError";
	}
};
/** True for a JSON object. */
function isRecord$2(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}
/** A non-empty string member, or undefined. */
function stringMember$1(source, key) {
	const value = source[key];
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : void 0;
}
/** Join an endpoint base and a gateway path without doubling or dropping the separator. */
function joinPath$1(baseURL, path) {
	return baseURL.replace(/\/+$/, "") + path;
}
/**
* Project the listing body into model entries.
*
* Exported for tests and for callers that already hold the document: the
* normalization carries the wire semantics, the request does not. The OpenAI
* shape is `{ data: [...] }`; a bare array is tolerated because the gateway is
* locally modified. Malformed entries are dropped, not fatal, and ids are
* deduplicated in first-seen order.
*
* @param payload - the `/v1/models` body.
* @returns one entry per distinct usable id.
*/
function normalizeModelList(payload) {
	const data = isRecord$2(payload) && Array.isArray(payload["data"]) ? payload["data"] : Array.isArray(payload) ? payload : [];
	const seen = /* @__PURE__ */ new Set();
	const models = [];
	for (const entry of data) {
		if (!isRecord$2(entry)) continue;
		const id = stringMember$1(entry, "id");
		if (id === void 0 || seen.has(id)) continue;
		seen.add(id);
		const ownedBy = stringMember$1(entry, "owned_by");
		models.push({
			id,
			...ownedBy === void 0 ? {} : { ownedBy }
		});
	}
	return models;
}
/**
* Build a live model-list reader for one credential.
* @param options - endpoint, credential, and optional transport seam.
* @returns a reader that performs the one listing request.
*/
function createLiveModelLister(options) {
	const timeoutMs = options.timeoutMs ?? 15e3;
	const url = joinPath$1(options.baseURL, NOWCODING_MODELS_PATH);
	return { async list(signal) {
		const fetchImpl = options.fetchImpl ?? globalThis.fetch;
		const timer = new AbortController();
		const onAbort = () => timer.abort(signal?.reason);
		if (signal !== void 0) {
			if (signal.aborted) onAbort();
			else signal.addEventListener("abort", onAbort, { once: true });
		}
		const timeout = setTimeout(() => timer.abort(/* @__PURE__ */ new Error("model list read timed out")), timeoutMs);
		let response;
		try {
			response = await fetchImpl(url, {
				method: "GET",
				headers: {
					accept: "application/json",
					authorization: `Bearer ${options.apiKey}`,
					...attributionHeaders()
				},
				signal: timer.signal
			});
		} catch (error) {
			if (signal?.aborted === true) throw error;
			if (timer.signal.aborted) throw new NowCodingModelsError("timeout", `model list read from ${url} exceeded ${timeoutMs}ms`);
			throw new NowCodingModelsError("unreachable", `model list read from ${url} failed: ${error instanceof Error ? error.message : String(error)}`);
		} finally {
			clearTimeout(timeout);
			signal?.removeEventListener("abort", onAbort);
		}
		if (response.status === 401 || response.status === 403) throw new NowCodingModelsError("unauthorized", `the gateway rejected the API key (HTTP ${response.status})`);
		if (!response.ok) throw new NowCodingModelsError("gateway-error", `model list read from ${url} returned HTTP ${response.status}`);
		let payload;
		try {
			payload = await response.json();
		} catch (error) {
			throw new NowCodingModelsError("unprocessable", `model list read from ${url} returned a body that is not JSON: ${error instanceof Error ? error.message : String(error)}`);
		}
		return normalizeModelList(payload);
	} };
}
//#endregion
//#region src/panel-login.ts
/**
* Console sign-in for the NowCoding dashboard.
*
* The console chain that reports a monthly plan authenticates with a dashboard
* credential plus the numeric user id, and the console issues both only after
* a username/password login. This module performs that login and returns the
* pair: the session cookie the login answer carries is the credential, and the
* dashboard access token is read back beside it when the account holds one.
* The password is an argument of one request: it is never stored, logged, or
* echoed back, and the cookie leaves only as a settings write the caller makes.
*
* Three gateway behaviours decide the flow:
*
* - The session cookie is the credential the console's own browser uses — the
*   console routes accept `Cookie: session=…` beside `New-Api-User` — so a
*   sign-in succeeds once the cookie is in hand, whether or not the account
*   carries an access token.
* - The token is read back over the session cookie rather than taken from the
*   login answer, because the answer's own document does not reliably carry
*   it. Only routes that report a token are called: the one route that issues
*   a token also rotates an existing one, which would silently break every
*   other tool configured with the account's token, so it is never reached.
* - A deployment can switch Turnstile on, which a non-browser client cannot
*   solve. That state is reported as its own failure code rather than as a
*   wrong password, because the user's fix is different.
*
* @module @elves-ai/dsh-llm-nowcoding/panel-login
*/
/** A sign-in failure carrying the code its caller branches on. */
var NowCodingLoginError = class extends Error {
	code;
	constructor(code, message) {
		super(message);
		this.code = code;
		this.name = "NowCodingLoginError";
	}
};
/** True for a JSON object. */
function isRecord$1(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}
/** A non-empty string member, or undefined. */
function textOf(value) {
	return typeof value === "string" && value.length > 0 ? value : void 0;
}
/** An object member, or undefined. */
function recordMember(source, key) {
	const value = source[key];
	return isRecord$1(value) ? value : void 0;
}
/** A message member, or undefined. */
function messageOf(source) {
	return textOf(source["message"]);
}
/** The account id as a string, for the header the console chain requires. */
function identifierOf(value) {
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	return textOf(value);
}
/** The `Cookie` header carrying the session a response set, or an empty string. */
function cookieHeader(response) {
	const headers = response.headers;
	const many = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
	const single = response.headers.get("set-cookie");
	return (many.length > 0 ? many : single === null ? [] : [single]).map((entry) => entry.split(";")[0]?.trim() ?? "").filter((pair) => pair.length > 0).join("; ");
}
/**
* Build the console sign-in client.
*
* @param options - endpoint, transport, clock, and challenge-lifetime seams.
* @returns a sign-in client that keeps at most one open challenge.
*/
function createPanelLogin(options) {
	const timeoutMs = options.timeoutMs ?? 15e3;
	const now = options.now ?? (() => Date.now());
	const ttl = options.twoFactorTtlMs ?? 3e5;
	let pending;
	/**
	* Send one console request.
	*
	* @param method - HTTP method the route expects.
	* @param path - origin-relative console path.
	* @param payload - JSON body, or undefined for a GET.
	* @param cookie - session cookie to present, when the route needs one.
	* @param unauthorized - code to report when the console refuses the session.
	* @returns the answered body and the session cookie it set.
	*/
	async function send(method, path, payload, cookie, unauthorized) {
		const fetchImpl = options.fetchImpl ?? globalThis.fetch;
		const url = new URL(options.baseURL()).origin + path;
		const timer = new AbortController();
		const timeout = setTimeout(() => {
			timer.abort(/* @__PURE__ */ new Error(`${url} timed out`));
		}, timeoutMs);
		let response;
		try {
			response = await fetchImpl(url, {
				method,
				headers: {
					accept: "application/json",
					...attributionHeaders(),
					...cookie === void 0 || cookie.length === 0 ? {} : { cookie },
					...payload === void 0 ? {} : { "content-type": "application/json" }
				},
				...payload === void 0 ? {} : { body: JSON.stringify(payload) },
				signal: timer.signal
			});
		} catch (error) {
			if (timer.signal.aborted) throw new NowCodingLoginError("timeout", `the console request to ${url} exceeded ${timeoutMs}ms`);
			throw new NowCodingLoginError("unreachable", `the console request to ${url} failed: ${error instanceof Error ? error.message : String(error)}`);
		} finally {
			clearTimeout(timeout);
		}
		if (response.status === 401 || response.status === 403) throw new NowCodingLoginError(unauthorized, `the console refused the session (HTTP ${response.status})`);
		if (!response.ok) throw new NowCodingLoginError("gateway-error", `the console request to ${url} answered HTTP ${response.status}`);
		let body;
		try {
			body = await response.json();
		} catch (error) {
			throw new NowCodingLoginError("unprocessable", `the console request to ${url} did not answer JSON: ${error instanceof Error ? error.message : String(error)}`);
		}
		if (!isRecord$1(body)) throw new NowCodingLoginError("unprocessable", `the console request to ${url} answered a body that is not a JSON object`);
		return {
			body,
			cookie: cookieHeader(response)
		};
	}
	/**
	* Read the account's token with the session the login just issued.
	*
	* Both routes here only report a token. The one route that issues one also
	* rotates an existing value and is never called: the session cookie already
	* carries the console chain, so a missing token costs nothing.
	*
	* @param cookie - session cookie from the login answer.
	* @returns the token, or undefined when no route reported one.
	*/
	async function readAccessToken(cookie) {
		const attempts = [{
			path: NOWCODING_SELF_ACCESS_TOKEN_PATH,
			token: (answer) => textOf(answer.body["data"])
		}, {
			path: NOWCODING_SELF_PATH,
			token: (answer) => textOf(recordMember(answer.body, "data")?.["access_token"])
		}];
		for (const attempt of attempts) try {
			const answer = await send("GET", attempt.path, void 0, cookie, "token-unavailable");
			if (answer.body["success"] !== true) continue;
			const token = attempt.token(answer);
			if (token !== void 0) return token;
		} catch {}
	}
	/**
	* Confirm the site agreement the way the console's own web app does, right
	* after a successful login. Best-effort: this client cannot display the
	* agreement, and a refusal here never fails a sign-in that holds the cookie.
	*
	* @param cookie - session cookie from the login answer.
	*/
	async function acceptAgreement(cookie) {
		try {
			await send("POST", NOWCODING_AGREEMENT_ACCEPT_PATH, void 0, cookie, "bad-credentials");
		} catch {}
	}
	/**
	* Turn a signed-in account document into the console credential pair.
	*
	* @param data - the console's `data` document for the account.
	* @param cookie - session cookie from the same answer.
	* @param username - account name to report alongside the credential.
	* @returns the session cookie, the account id, and the token when one was readable.
	*/
	async function credentialOf(data, cookie, username) {
		const userId = identifierOf(data["id"]);
		if (userId === void 0) throw new NowCodingLoginError("unprocessable", "the sign-in answer carries no account id, which the console chain needs as New-Api-User");
		const inline = textOf(data["access_token"]);
		if (inline !== void 0) return {
			sessionCookie: cookie,
			accessToken: inline,
			userId,
			username,
			tokenSource: "login"
		};
		const token = cookie.length > 0 ? await readAccessToken(cookie) : void 0;
		if (token !== void 0) return {
			sessionCookie: cookie,
			accessToken: token,
			userId,
			username,
			tokenSource: "read"
		};
		if (cookie.length === 0) throw new NowCodingLoginError("token-unavailable", `signed in as ${username}, but the console answered neither a session cookie nor an access token`);
		return {
			sessionCookie: cookie,
			userId,
			username
		};
	}
	return {
		async login(username, password) {
			const name = username.trim();
			const answer = await send("POST", NOWCODING_LOGIN_PATH, {
				username: name,
				password
			}, void 0, "bad-credentials");
			const data = recordMember(answer.body, "data");
			if (answer.body["success"] !== true) {
				const message = messageOf(answer.body) ?? "the console refused the sign-in";
				if (/turnstile/i.test(message)) throw new NowCodingLoginError("turnstile-required", message);
				throw new NowCodingLoginError("bad-credentials", message);
			}
			if (data === void 0) throw new NowCodingLoginError("unprocessable", "the sign-in answer carries no account document");
			if (data["require_2fa"] === true) {
				pending = {
					cookie: answer.cookie,
					username: name,
					expiresAt: now() + ttl
				};
				return { status: "two-factor-required" };
			}
			await acceptAgreement(answer.cookie);
			return {
				status: "ok",
				credential: await credentialOf(data, answer.cookie, name)
			};
		},
		async verifyTwoFactor(code) {
			const state = pending;
			if (state === void 0 || state.expiresAt <= now()) {
				pending = void 0;
				throw new NowCodingLoginError("two-factor-unavailable", "no sign-in is waiting for a verification code; sign in again");
			}
			const answer = await send("POST", NOWCODING_TWO_FACTOR_LOGIN_PATH, { code: code.trim() }, state.cookie, "two-factor-unavailable");
			const data = recordMember(answer.body, "data");
			if (answer.body["success"] !== true) throw new NowCodingLoginError("two-factor-invalid", messageOf(answer.body) ?? "the console refused the verification code");
			if (data === void 0) throw new NowCodingLoginError("unprocessable", "the verification answer carries no account document");
			const cookie = answer.cookie.length > 0 ? answer.cookie : state.cookie;
			await acceptAgreement(cookie);
			const credential = await credentialOf(data, cookie, state.username);
			pending = void 0;
			return {
				status: "ok",
				credential
			};
		}
	};
}
//#endregion
//#region src/quota.ts
/**
* Remaining-quota reader for the NowCoding gateway.
*
* The gateway exposes two different balances on two different authentication
* chains, and which one a user cares about depends on how they pay:
*
* - **Subscription** (a monthly plan) — `GET {origin}/api/subscription/self`.
*   This is the console API and matches what the gateway's own console shows:
*   the plan's allowance and its consumption against it. It authenticates with
*   a dashboard access token, or with the session cookie an account sign-in
*   answered, plus the `New-Api-User` header either way; the `sk-` model key
*   is rejected on this chain, which is why the plugin asks for a console
*   credential before it can report this balance. When both credentials are
*   configured the token is tried first and the session cookie takes over
*   when the token is refused, so a sign-in alone is enough.
* - **Pay-as-you-go wallet** — `GET {base}/dashboard/billing/{subscription,usage}`.
*   This is the relay API and authenticates with the same `sk-` key chat uses.
*
* Three properties of the documents are easy to get wrong and are handled here
* rather than at each caller:
*
* - Amounts are **raw quota units**, not currency. A displayed amount is
*   `raw / quota_per_unit`, and `quota_per_unit` comes from the public status
*   document. Dividing by a guessed constant silently misreports every figure.
* - `soft_limit_usd` (relay chain) is the **granted total**, not the remaining
*   balance: remaining is `soft_limit_usd - total_usage / 100`.
* - The `*_usd` names carry the gateway's **display currency**, which this
*   deployment sets to CNY. The names are a compatibility leftover.
*
* @module @elves-ai/dsh-llm-nowcoding/quota
*/
/** One failed quota read, carrying the classification callers branch on. */
var NowCodingQuotaError = class extends Error {
	code;
	constructor(code, message) {
		super(message);
		this.code = code;
		this.name = "NowCodingQuotaError";
	}
};
/** Default per-attempt timeout for one quota read. */
const NOWCODING_DEFAULT_QUOTA_TIMEOUT_MS = 15e3;
/** True for a JSON object. */
function isRecord(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}
/** First finite number among the candidates, or undefined. */
function firstNumber(source, keys) {
	for (const key of keys) {
		const value = source[key];
		if (typeof value === "number" && Number.isFinite(value)) return value;
	}
}
/** A non-empty string member, or undefined. */
function stringMember(source, key) {
	const value = source[key];
	return typeof value === "string" && value.length > 0 ? value : void 0;
}
/**
* Read the divisor every displayed amount uses.
*
* @param status - the `/api/status` body.
* @returns the gateway's `quota_per_unit`, or the documented fallback.
*/
function quotaUnitOf(status) {
	const data = isRecord(status) && isRecord(status["data"]) ? status["data"] : void 0;
	const unit = data === void 0 ? void 0 : firstNumber(data, ["quota_per_unit"]);
	return unit !== void 0 && unit > 0 ? unit : NOWCODING_FALLBACK_QUOTA_PER_UNIT;
}
/** Every candidate subscription in a console document, active ones first. */
function subscriptionCandidates(payload) {
	if (!isRecord(payload)) return [];
	const data = isRecord(payload["data"]) ? payload["data"] : void 0;
	if (data === void 0) return [];
	const active = Array.isArray(data["subscriptions"]) ? data["subscriptions"] : [];
	const all = Array.isArray(data["all_subscriptions"]) ? data["all_subscriptions"] : [];
	return (active.length > 0 ? active : all).filter((entry) => isRecord(entry));
}
/**
* Project the console subscription document into one balance.
*
* Exported for tests and for callers that already hold the document: the
* normalization carries the field semantics, the request does not.
*
* @param payload - the `/api/subscription/self` body.
* @param quotaPerUnit - raw units per displayed unit, from {@link quotaUnitOf}.
* @param fetchedAt - epoch milliseconds to stamp on the snapshot.
* @returns the balance, or undefined when no active subscription is present.
*/
function normalizeSubscription(payload, quotaPerUnit, fetchedAt) {
	const entry = subscriptionCandidates(payload).find((candidate) => candidate["status"] === "active") ?? subscriptionCandidates(payload)[0];
	if (entry === void 0) return void 0;
	const subscription = isRecord(entry["subscription"]) ? entry["subscription"] : void 0;
	if (subscription === void 0) return void 0;
	const totalUnits = firstNumber(subscription, ["amount_total"]);
	if (totalUnits === void 0) return void 0;
	const usedUnits = firstNumber(subscription, ["amount_used"]) ?? 0;
	const unit = quotaPerUnit > 0 ? quotaPerUnit : NOWCODING_FALLBACK_QUOTA_PER_UNIT;
	const total = totalUnits / unit;
	const used = usedUnits / unit;
	const endSeconds = firstNumber(subscription, ["end_time"]) ?? 0;
	const resetSeconds = firstNumber(subscription, ["next_reset_time"]) ?? 0;
	return {
		source: "subscription",
		total,
		used,
		remaining: Math.max(0, total - used),
		unlimited: false,
		accessUntil: endSeconds > 0 ? endSeconds * 1e3 : 0,
		resetAt: resetSeconds > 0 ? resetSeconds * 1e3 : 0,
		fetchedAt,
		...stringMember(entry, "plan_title") === void 0 ? {} : { planTitle: stringMember(entry, "plan_title") },
		...stringMember(entry, "plan_quota_reset_period") === void 0 ? {} : { resetPeriod: stringMember(entry, "plan_quota_reset_period") },
		quotaPerUnit: unit
	};
}
/**
* Project the relay billing documents into one balance.
*
* @param subscription - the `/dashboard/billing/subscription` body.
* @param usage - the `/dashboard/billing/usage` body.
* @param fetchedAt - epoch milliseconds to stamp on the snapshot.
* @returns the balance, or undefined when the documents carry no total.
*/
function normalizeQuota(subscription, usage, fetchedAt) {
	if (!isRecord(subscription)) return void 0;
	const total = firstNumber(subscription, [
		"soft_limit_usd",
		"hard_limit_usd",
		"system_hard_limit_usd"
	]);
	if (total === void 0) return void 0;
	const used = (isRecord(usage) ? firstNumber(usage, ["total_usage"]) ?? 0 : 0) / 100;
	const accessUntilSeconds = firstNumber(subscription, ["access_until"]) ?? 0;
	return {
		source: "billing",
		total,
		used,
		remaining: Math.max(0, total - used),
		unlimited: total >= NOWCODING_UNLIMITED_QUOTA_SENTINEL,
		accessUntil: accessUntilSeconds > 0 ? accessUntilSeconds * 1e3 : 0,
		resetAt: 0,
		fetchedAt,
		quotaPerUnit: 1
	};
}
/** Join an endpoint base and a gateway path without doubling or dropping the separator. */
function joinPath(baseURL, path) {
	return baseURL.replace(/\/+$/, "") + path;
}
/**
* Build a quota reader for one set of credentials.
* @param options - endpoint, credentials, and optional transport/clock seams.
* @returns a reader that performs the requests its credentials allow.
*/
function createQuotaReader(options) {
	const timeoutMs = options.timeoutMs ?? 15e3;
	const now = options.now ?? (() => Date.now());
	async function get(url, headers, signal) {
		const fetchImpl = options.fetchImpl ?? globalThis.fetch;
		const timer = new AbortController();
		const onAbort = () => timer.abort(signal?.reason);
		if (signal !== void 0) {
			if (signal.aborted) onAbort();
			else signal.addEventListener("abort", onAbort, { once: true });
		}
		const timeout = setTimeout(() => timer.abort(/* @__PURE__ */ new Error("quota read timed out")), timeoutMs);
		let response;
		try {
			response = await fetchImpl(url, {
				method: "GET",
				headers: {
					accept: "application/json",
					...attributionHeaders(),
					...headers
				},
				signal: timer.signal
			});
		} catch (error) {
			if (signal?.aborted === true) throw error;
			if (timer.signal.aborted) throw new NowCodingQuotaError("timeout", `quota read from ${url} exceeded ${timeoutMs}ms`);
			throw new NowCodingQuotaError("unreachable", `quota read from ${url} failed: ${error instanceof Error ? error.message : String(error)}`);
		} finally {
			clearTimeout(timeout);
			signal?.removeEventListener("abort", onAbort);
		}
		if (response.status === 401 || response.status === 403) throw new NowCodingQuotaError("unauthorized", `the gateway rejected the credential (HTTP ${response.status})`);
		if (!response.ok) throw new NowCodingQuotaError("gateway-error", `quota read from ${url} returned HTTP ${response.status}`);
		try {
			return await response.json();
		} catch (error) {
			throw new NowCodingQuotaError("unprocessable", `quota read from ${url} returned a body that is not JSON: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	/** The console chain's token headers; the id header is omitted rather than empty when no id is configured. */
	function tokenHeaders() {
		const userId = (options.panelUserId ?? "").trim();
		return {
			authorization: `Bearer ${options.panelToken ?? ""}`,
			...userId.length === 0 ? {} : { "new-api-user": userId }
		};
	}
	/** The console chain's session-cookie headers: the credential the console's own browser holds. */
	function cookieHeaders() {
		const userId = (options.panelUserId ?? "").trim();
		return {
			cookie: options.panelSession ?? "",
			...userId.length === 0 ? {} : { "new-api-user": userId }
		};
	}
	/** Read the monthly plan's allowance, or undefined when none is active. */
	async function readSubscription(origin, headers, signal) {
		const [payload, status] = await Promise.all([get(origin + NOWCODING_SUBSCRIPTION_PATH, headers, signal), get(origin + NOWCODING_STATUS_PATH, {}, signal)]);
		if (isRecord(payload) && payload["success"] === false) throw new NowCodingQuotaError("unauthorized", `the gateway rejected the dashboard credential: ${stringMember(payload, "message") ?? "no reason given"}`);
		return normalizeSubscription(payload, quotaUnitOf(status), now());
	}
	/** Read the pay-as-you-go wallet through the relay chain. */
	async function readBilling(signal) {
		const headers = { authorization: `Bearer ${options.apiKey}` };
		const [subscription, usage] = await Promise.all([get(joinPath(options.baseURL, NOWCODING_QUOTA_SUBSCRIPTION_PATH), headers, signal), get(joinPath(options.baseURL, NOWCODING_QUOTA_USAGE_PATH), headers, signal)]);
		const snapshot = normalizeQuota(subscription, usage, now());
		if (snapshot === void 0) throw new NowCodingQuotaError("unprocessable", "the gateway billing document carries no quota total");
		return snapshot;
	}
	return { async read(signal) {
		const token = (options.panelToken ?? "").trim();
		const cookie = (options.panelSession ?? "").trim();
		const origin = new URL(options.baseURL).origin;
		let authenticated = false;
		let refused;
		let subscription;
		/** One console attempt; a refused credential is remembered, not raised. */
		const attempt = async (headers) => {
			try {
				const snapshot = await readSubscription(origin, headers, signal);
				if (snapshot !== void 0) return snapshot;
				authenticated = true;
				return;
			} catch (error) {
				if (error instanceof NowCodingQuotaError && error.code === "unauthorized") {
					refused = error;
					return;
				}
				throw error;
			}
		};
		if (token.length > 0) subscription = await attempt(tokenHeaders());
		if (subscription === void 0 && cookie.length > 0) subscription = await attempt(cookieHeaders());
		if (subscription !== void 0) return subscription;
		if (refused !== void 0 && !authenticated) throw refused;
		if (options.apiKey.length === 0) throw new NowCodingQuotaError("unprocessable", "this account has no active subscription plan, and no model API key is configured to read the wallet balance instead");
		return readBilling(signal);
	} };
}
//#endregion
//#region src/settings-routes.ts
/** Route-level error with an HTTP status and a stable machine code. */
var NowCodingRouteError = class extends Error {
	code;
	status;
	constructor(code, message, status = 400) {
		super(message);
		this.code = code;
		this.status = status;
		this.name = "NowCodingRouteError";
	}
};
const ALLOWED_FIELDS = new Set(NOWCODING_SETTINGS_FIELDS);
const FAST_TIERS = ["priority", "fast"];
const MAX_BODY_BYTES = 1 << 20;
const ROUTE_PATH = "/nowcoding/api";
/** Read and parse a bounded JSON request body. */
async function readJsonBody(req) {
	const chunks = [];
	let total = 0;
	for await (const chunk of req) {
		const buffer = Buffer.from(chunk);
		total += buffer.length;
		if (total > MAX_BODY_BYTES) throw new NowCodingRouteError("bad-request", "request body too large");
		chunks.push(buffer);
	}
	const text = Buffer.concat(chunks).toString("utf8");
	if (text.trim() === "") return {};
	try {
		return JSON.parse(text);
	} catch {
		throw new NowCodingRouteError("bad-request", "request body is not valid JSON");
	}
}
/** Write one JSON response. */
function writeJson(res, status, body) {
	res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	res.end(JSON.stringify(body));
}
/** Write the success envelope. */
function writeOk(res, value) {
	writeJson(res, 200, {
		ok: true,
		value
	});
}
/** Write a failure envelope for any thrown value. */
function writeError(res, error) {
	if (error instanceof NowCodingRouteError) {
		writeJson(res, error.status, {
			ok: false,
			error: {
				code: error.code,
				message: error.message
			}
		});
		return;
	}
	if (error instanceof NowCodingQuotaError) {
		writeJson(res, error.code === "unauthorized" ? 401 : 502, {
			ok: false,
			error: {
				code: error.code,
				message: error.message
			}
		});
		return;
	}
	if (error instanceof NowCodingModelsError) {
		writeJson(res, error.code === "unauthorized" ? 401 : 502, {
			ok: false,
			error: {
				code: error.code,
				message: error.message
			}
		});
		return;
	}
	if (error instanceof NowCodingLoginError) {
		writeJson(res, loginStatus(error.code), {
			ok: false,
			error: {
				code: error.code,
				message: error.message
			}
		});
		return;
	}
	writeJson(res, 500, {
		ok: false,
		error: {
			code: "internal",
			message: error instanceof Error ? error.message : String(error)
		}
	});
}
/** HTTP status for one sign-in failure: a refused credential is the caller's, the rest are ours. */
function loginStatus(code) {
	switch (code) {
		case "bad-credentials":
		case "two-factor-invalid": return 401;
		case "two-factor-unavailable": return 409;
		default: return 502;
	}
}
/** True for a plain object patch/payload. */
function isPlainObject(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}
/** Require a plain-object payload. */
function requireObject(payload, what) {
	if (!isPlainObject(payload)) throw new NowCodingRouteError("bad-request", `${what} payload must be an object`);
	return payload;
}
/** Require one non-empty string field of a payload. */
function requireStringField(source, key) {
	const value = source[key];
	if (typeof value !== "string" || value.length === 0) throw new NowCodingRouteError("bad-request", `"${key}" must be a non-empty string`);
	return value;
}
/** Validate one top-level settings path op against the NowCoding schema. */
function validateOp(op) {
	if (!isPlainObject(op) || op.op !== "set" && op.op !== "unset") throw new NowCodingRouteError("bad-request", "each op must be { op: \"set\" | \"unset\", path: [field] }");
	const path = op.path;
	if (!Array.isArray(path) || path.length !== 1 || typeof path[0] !== "string" || !ALLOWED_FIELDS.has(path[0])) throw new NowCodingRouteError("bad-request", `settings field must be one of: ${NOWCODING_SETTINGS_FIELDS.join(", ")}`);
	if (op.op !== "set") return;
	const field = path[0];
	const value = op.value;
	switch (field) {
		case "apiKey":
		case "baseURL":
		case "panelToken":
		case "panelUserId":
		case "panelSession":
			if (typeof value !== "string") throw new NowCodingRouteError("bad-request", `"${field}" must be a string`);
			return;
		case "fast":
		case "quotaCard":
			if (typeof value !== "boolean") throw new NowCodingRouteError("bad-request", `"${field}" must be a boolean`);
			return;
		case "fastServiceTier":
			if (typeof value !== "string" || !FAST_TIERS.includes(value)) throw new NowCodingRouteError("bad-request", `"fastServiceTier" must be one of: ${FAST_TIERS.join(", ")}`);
			return;
		case "visibleModels":
			if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) throw new NowCodingRouteError("bad-request", "\"visibleModels\" must be an array of model ids");
			return;
		default: throw new NowCodingRouteError("bad-request", `settings field must be one of: ${NOWCODING_SETTINGS_FIELDS.join(", ")}`);
	}
}
/** The current redacted view of the NowCoding settings namespace. */
function viewOf(settings, ns) {
	const descriptor = settings.describe({ redactSecrets: true }).find((candidate) => candidate.ns === ns);
	if (descriptor === void 0) return void 0;
	return {
		value: descriptor.value,
		revision: descriptor.revision,
		...descriptor.base === void 0 ? {} : { base: descriptor.base },
		...descriptor.user === void 0 ? {} : { user: descriptor.user },
		applies: descriptor.applies,
		secrets: descriptor.secrets ?? [],
		writable: settings.writable
	};
}
/** Require this instance's section, then return its redacted view. */
function requireView(deps) {
	const view = viewOf(settingsOf(deps.settings), deps.options.settingsNs);
	if (view === void 0) throw new NowCodingRouteError("settings-rejected", `this deployment has no configuration section named "${deps.options.settingsNs}"`, 503);
	return view;
}
/** The settings seam, or a route error naming its absence. */
function settingsOf(settings) {
	if (settings === void 0) throw new NowCodingRouteError("settings-rejected", "the settings service is not mounted in this deployment", 503);
	return settings;
}
/** True for the settings seam's stale-revision refusal. */
function isSettingsConflict(error) {
	return error instanceof SettingsConflictError || error !== null && typeof error === "object" && error.code === "SETTINGS_CONFLICT";
}
/** Read the balance for the route's current credential. */
async function readQuota(options) {
	const shared = {
		enabled: options.quotaCard,
		currency: "¥",
		refreshSeconds: options.quotaRefreshSeconds
	};
	if (options.apiKey.length === 0 && options.panelToken.length === 0 && options.panelSession.length === 0) return {
		...shared,
		snapshot: null
	};
	const reader = createQuotaReader({
		baseURL: options.baseURL,
		apiKey: options.apiKey,
		panelToken: options.panelToken,
		panelUserId: options.panelUserId,
		panelSession: options.panelSession
	});
	return {
		...shared,
		snapshot: await reader.read()
	};
}
/**
* Read the key-scoped model listing for the picker's allowlist.
*
* The answer annotates every id with whether the served catalog describes it:
* a checked id the catalog does not know is stored faithfully, but the picker
* cannot offer it until the catalog learns it, and the page says so instead of
* letting the id disappear silently.
*/
async function readModelCatalog(options, fetchImpl) {
	if (options.apiKey.length === 0) throw new NowCodingRouteError("unauthorized", "no API key is configured; save one before fetching the model list", 401);
	const models = await createLiveModelLister({
		baseURL: options.baseURL,
		apiKey: options.apiKey,
		...fetchImpl === void 0 ? {} : { fetchImpl }
	}).list();
	const known = new Set(options.catalog.map((entry) => entry.id));
	return { models: models.map((model) => ({
		id: model.id,
		known: known.has(model.id),
		...model.ownedBy === void 0 ? {} : { ownedBy: model.ownedBy }
	})) };
}
/**
* Project what the conversation model picker serves right now.
*
* The adapter computes its picker listing from exactly these inputs, so this
* is the ground truth the detail page can hold the selector against: if the
* page names a model the app's menu does not show, the gap is in the app
* layer, not in the configuration.
*/
function readServedModels(options) {
	return { models: listSelectableModels(NOWCODING_PROVIDER_ROUTE, options.catalog, options.visibleModels).map((entry) => ({
		id: entry.id,
		name: entry.name
	})) };
}
/** Apply path ops through the settings seam and return the fresh redacted document. */
async function mutateSettings(deps, ops, expectedRevision) {
	const settings = settingsOf(deps.settings);
	const ns = deps.options.settingsNs;
	try {
		await settings.mutate(ns, ops, expectedRevision);
	} catch (error) {
		if (isSettingsConflict(error)) throw new NowCodingRouteError("settings-conflict", error instanceof Error ? error.message : String(error), 409);
		throw new NowCodingRouteError("settings-rejected", error instanceof Error ? error.message : String(error));
	}
	const view = viewOf(settings, ns);
	if (view === void 0) throw new NowCodingRouteError("settings-rejected", `the configuration section "${ns}" disappeared after the write`, 503);
	return view;
}
/**
* Store a finished sign-in's credential.
*
* The token and the session cookie are written from the Host and never ride
* the answer, so the page learns which account signed in and nothing an XSS
* could replay.
*
* @param deps - settings seam and resolved options.
* @param result - the sign-in step's answer.
* @returns what the page may show about the sign-in.
*/
async function storeCredential(deps, result) {
	if (result.status === "two-factor-required") return { status: "two-factor-required" };
	const credential = result.credential;
	await mutateSettings(deps, [
		{
			op: "set",
			path: ["panelUserId"],
			value: credential.userId
		},
		...credential.accessToken === void 0 ? [] : [{
			op: "set",
			path: ["panelToken"],
			value: credential.accessToken
		}],
		...credential.sessionCookie.length === 0 ? [] : [{
			op: "set",
			path: ["panelSession"],
			value: credential.sessionCookie
		}]
	]);
	return {
		status: "ok",
		userId: credential.userId,
		username: credential.username,
		...credential.tokenSource === void 0 ? {} : { tokenSource: credential.tokenSource }
	};
}
/**
* Dispatch one API method against the seams this route uses.
*
* Exported so the browser-facing contract is exercised without a cordis
* context; `registerNowCodingSettingsRoutes` is the only production caller.
*
* @param deps - settings seam, resolved options, and the console sign-in client.
* @param method - the method name the request body carried.
* @param payload - the payload the request body carried.
* @returns the method's value.
*/
async function dispatchNowCodingMethod(deps, method, payload) {
	switch (method) {
		case "settings.get": return requireView(deps);
		case "quota.get": return readQuota(deps.options);
		case "models.list": return readModelCatalog(deps.options, deps.fetchImpl);
		case "models.served": return readServedModels(deps.options);
		case "settings.mutate": {
			const body = requireObject(payload, "settings.mutate");
			const ops = body.ops;
			if (!Array.isArray(ops) || ops.length === 0) throw new NowCodingRouteError("bad-request", "ops must be a non-empty array");
			for (const op of ops) validateOp(op);
			return mutateSettings(deps, ops, typeof body.expectedRevision === "number" ? body.expectedRevision : void 0);
		}
		case "panel.login": {
			const body = requireObject(payload, "panel.login");
			const username = requireStringField(body, "username");
			const password = requireStringField(body, "password");
			return storeCredential(deps, await deps.login.login(username, password));
		}
		case "panel.two-factor": {
			const body = requireObject(payload, "panel.two-factor");
			return storeCredential(deps, await deps.login.verifyTwoFactor(requireStringField(body, "code")));
		}
		default: throw new NowCodingRouteError("not-found", `unknown NowCoding method "${String(method)}"`, 404);
	}
}
/**
* Register `/nowcoding/api` while `webServer` and `webRuntime` are mounted.
*
* The optional-inject shape keeps the provider usable in deployments without a
* web server; the settings page and the quota card simply have no route to call.
*
* @param ctx - plugin context.
* @param options - thunk returning the route's current resolved options.
*/
function registerNowCodingSettingsRoutes(ctx, options) {
	const login = createPanelLogin({ baseURL: () => options().baseURL });
	ctx.inject(["webServer", "webRuntime"], (routeCtx) => {
		const webServer = routeCtx.get("webServer");
		const webRuntime = routeCtx.get("webRuntime");
		routeCtx.effect(() => webServer.register({
			kind: "exact",
			path: ROUTE_PATH,
			handler: async (req, res) => {
				if (!isTrustedApiRequest(req.headers, webRuntime.trustedHosts)) {
					writeJson(res, 403, {
						ok: false,
						error: {
							code: "forbidden",
							message: "forbidden"
						}
					});
					return;
				}
				if (req.method !== "POST") {
					writeJson(res, 405, {
						ok: false,
						error: {
							code: "method-error",
							message: "method not allowed"
						}
					});
					return;
				}
				try {
					const payload = await readJsonBody(req);
					const record = isPlainObject(payload) ? payload : {};
					writeOk(res, await dispatchNowCodingMethod({
						settings: ctx.get("settings"),
						options: options(),
						login
					}, record.method, record.payload));
				} catch (error) {
					writeError(res, error);
				}
			}
		}), "llm-nowcoding: /nowcoding/api settings and quota route");
	});
}
/** One request header value. */
function header(headers, name) {
	const value = headers[name];
	return typeof value === "string" ? value : void 0;
}
/** Normalized URL of a Host-header authority, or undefined when unparsable. */
function parseAuthority(authority) {
	try {
		return new URL(`http://${authority}`);
	} catch {
		return;
	}
}
/**
* Whether a hostname names the local loopback authority.
* @param hostname - a URL hostname.
* @returns whether the host is loopback.
*/
function isLoopbackHostname(hostname) {
	if (hostname === "localhost" || hostname === "[::1]") return true;
	const parts = hostname.split(".");
	return parts.length === 4 && parts[0] === "127" && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
/** Canonical authority form: hostname, or hostname:port when a port was written. */
function canonicalAuthority(entry, entryUrl) {
	const port = entryUrl.port !== "" ? entryUrl.port : new URL(`https://${entry}`).port;
	return port === "" ? entryUrl.hostname : `${entryUrl.hostname}:${port}`;
}
/** Whether the request authority matches a trustedHosts entry (exact or port-less). */
function isTrustedAuthority(hostUrl, trustedHosts) {
	return trustedHosts.some((entry) => {
		const entryUrl = parseAuthority(entry);
		if (entryUrl === void 0) return false;
		return canonicalAuthority(entry, entryUrl) === entryUrl.hostname ? entryUrl.hostname === hostUrl.hostname : entryUrl.host === hostUrl.host;
	});
}
/**
* Whether the browser request comes from the DSH host itself.
* @param headers - the incoming request headers.
* @param trustedHosts - the runtime's bind-derived trusted host list.
* @returns whether the request may reach the plugin's route.
*/
function isTrustedApiRequest(headers, trustedHosts) {
	const host = header(headers, "host");
	if (host === void 0) return false;
	const hostUrl = parseAuthority(host);
	if (hostUrl === void 0) return false;
	if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts)) return false;
	if (header(headers, "sec-fetch-site") === "cross-site") return false;
	const origin = header(headers, "origin");
	if (origin === void 0) return true;
	try {
		return new URL(origin).host === hostUrl.host;
	} catch {
		return false;
	}
}
//#endregion
//#region src/index.ts
/** Cordis plugin name used by loader diagnostics. */
const name = "llm-nowcoding";
/** The LLM seam this adapter registers into. */
const inject = ["llm"];
/**
* Register the NowCoding provider route and its balance route.
*
* The adapter and the settings route share one resolved-options thunk that
* reads the live config references, so a settings commit reaches the next
* request and the next balance read without re-registering the route.
*
* @param ctx - plugin context.
* @param config - live configuration references; see {@link NowCodingConfig}.
*/
function apply(ctx, config) {
	const options = () => resolveNowCodingOptions(ctx, config);
	ctx.llm.registerAdapter([NOWCODING_PROVIDER_ROUTE], new NowCodingAdapter({ options }));
	ctx.llm.registerConfigurableProviders([{
		provider: NOWCODING_PROVIDER_ROUTE,
		displayName: config.displayName.get(),
		settingsNs: config.settingsNs.get(),
		settingsPath: []
	}]);
	const settings = ctx.get("settings");
	if (settings !== void 0) ctx.effect(() => settings.configure({ auto: false }), "llm-nowcoding: the plugin ships its own configuration page");
	registerNowCodingSettingsRoutes(ctx, options);
}
//#endregion
export { Config, DEFAULT_CONTEXT_WINDOW, DEFAULT_MAX_TOKENS, FAST_MODEL_SUFFIX, NOWCODING_BUILTIN_CATALOG, NOWCODING_DEFAULT_API_KEY_ENV, NOWCODING_DEFAULT_BASE_URL, NOWCODING_DEFAULT_DISPLAY_NAME, NOWCODING_DEFAULT_QUOTA_REFRESH_SECONDS, NOWCODING_DEFAULT_QUOTA_TIMEOUT_MS, NOWCODING_DEFAULT_REQUEST_TIMEOUT_MS, NOWCODING_DISPLAY_CURRENCY_SYMBOL, NOWCODING_PROVIDER_ROUTE, NOWCODING_SETTINGS_FIELDS, NOWCODING_SETTINGS_NAMESPACE, NowCodingAdapter, NowCodingQuotaError, apply, catalogEntry, createQuotaReader, decideFastTier, effectiveCatalog, fastModelId, inject, isFastAlias, isFastCapable, listSelectableModels, modelSupportsFast, name, normalizeQuota, reasoningInfoFor, registerNowCodingSettingsRoutes, resolveModelInfo, resolveNowCodingOptions, selectorEntries, wireModelId };

//# sourceMappingURL=index.js.map