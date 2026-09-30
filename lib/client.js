window.__ModuleLoader__.load({
	id: "@elves-ai/dsh-llm-nowcoding",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/api.ts
		/** Wire error carrying the route's stable machine code. */
		var NowCodingApiError = class extends Error {
			code;
			constructor(code, message) {
				super(message);
				this.code = code;
				this.name = "NowCodingApiError";
			}
		};
		/** POST one method to `/nowcoding/api` and unwrap the success envelope. */
		async function post(method, payload, signal) {
			let response;
			try {
				response = await fetch("/nowcoding/api", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						method,
						payload: payload ?? {}
					}),
					...signal === void 0 ? {} : { signal }
				});
			} catch (error) {
				throw new NowCodingApiError("unreachable", `无法连接 NowCoding 接口：${error instanceof Error ? error.message : String(error)}`);
			}
			let body;
			try {
				body = await response.json();
			} catch {
				throw new NowCodingApiError("unreachable", `NowCoding 接口返回了无法解析的响应（HTTP ${response.status}）`);
			}
			if (!response.ok || !body.ok) {
				const failure = body;
				throw new NowCodingApiError(failure.error?.code ?? "unreachable", failure.error?.message ?? `HTTP ${response.status}`);
			}
			return body.value;
		}
		/**
		* Read the configured key's remaining balance.
		* @param signal - cancellation for this read, honoured by the browser fetch.
		* @returns the balance view; `snapshot` is null until a key is configured.
		*/
		function getQuota(signal) {
			return post("quota.get", {}, signal);
		}
		/** Read the redacted NowCoding settings document. */
		function getNowCodingSettings() {
			return post("settings.get");
		}
		/**
		* Apply path ops and return the fresh redacted document.
		* @param ops - path-addressed edits applied in one commit.
		* @param expectedRevision - revision this caller read; the Host rejects a stale one.
		* @returns the committed document.
		*/
		async function mutateNowCodingSettings(ops, expectedRevision) {
			const next = await post("settings.mutate", {
				ops,
				...expectedRevision === void 0 ? {} : { expectedRevision }
			});
			for (const listener of committedListeners) listener();
			return next;
		}
		/** Listeners re-reading the document after another surface committed an edit. */
		const committedListeners = /* @__PURE__ */ new Set();
		/**
		* Narrow an envelope's `value` into the fields this client renders.
		* @param envelope - the route's answer.
		* @returns the known fields; unknown or mistyped fields stay absent.
		*/
		function settingsViewOf(envelope) {
			const value = envelope.value !== null && typeof envelope.value === "object" ? envelope.value : {};
			const tier = value.fastServiceTier;
			return {
				...typeof value.baseURL === "string" ? { baseURL: value.baseURL } : {},
				...typeof value.fast === "boolean" ? { fast: value.fast } : {},
				...tier === "priority" || tier === "fast" ? { fastServiceTier: tier } : {},
				...typeof value.quotaCard === "boolean" ? { quotaCard: value.quotaCard } : {}
			};
		}
		/** True when the write-only `apiKey` slot currently holds a value. */
		function isNowCodingApiKeyConfigured(envelope) {
			return envelope.secrets.some((secret) => secret.path.length === 1 && secret.path[0] === "apiKey" && secret.set);
		}
		//#endregion
		//#region \0dsh-css:/Users/lingyun/mywork/dsh-llm-nowcoding/src/client/NowCodingQuotaCard.module.css.mjs
		const css$1 = ".nowcoding_G1rn4q_card{width:100%;color:var(--dsw-color-text-secondary,#6b7280);background:var(--dsw-color-surface-subtle,#7f7f7f14);border-radius:6px;flex-direction:column;gap:4px;padding:6px 8px;font-size:12px;line-height:1.4;display:flex}.nowcoding_G1rn4q_card[data-state=failed]{flex-direction:row;justify-content:space-between;align-items:center}.nowcoding_G1rn4q_row{justify-content:space-between;align-items:baseline;gap:6px;display:flex}.nowcoding_G1rn4q_summary{color:var(--dsw-color-text-primary,#111827);font-weight:600}.nowcoding_G1rn4q_card[data-state=low] .nowcoding_G1rn4q_summary{color:var(--dsw-color-warning,#b45309)}.nowcoding_G1rn4q_total{color:var(--dsw-color-text-tertiary,#9ca3af)}.nowcoding_G1rn4q_track{background:var(--dsw-color-border-subtle,#7f7f7f33);border-radius:2px;height:4px;overflow:hidden}.nowcoding_G1rn4q_fill{background:var(--dsw-color-accent,#4d6bfe);border-radius:2px;height:100%}.nowcoding_G1rn4q_card[data-state=low] .nowcoding_G1rn4q_fill{background:var(--dsw-color-warning,#b45309)}.nowcoding_G1rn4q_retry{border:1px solid var(--dsw-color-border-subtle,#7f7f7f4d);color:inherit;font:inherit;cursor:pointer;background:0 0;border-radius:4px;padding:0 6px}";
		const tagId$1 = "@elves-ai/dsh-llm-nowcoding/NowCodingQuotaCard.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@elves-ai/dsh-llm-nowcoding";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var NowCodingQuotaCard_module_css_default = {
			"total": "nowcoding_G1rn4q_total",
			"fill": "nowcoding_G1rn4q_fill",
			"row": "nowcoding_G1rn4q_row",
			"retry": "nowcoding_G1rn4q_retry",
			"summary": "nowcoding_G1rn4q_summary",
			"card": "nowcoding_G1rn4q_card",
			"track": "nowcoding_G1rn4q_track"
		};
		//#endregion
		//#region src/client/NowCodingQuotaCard.tsx
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
		/** Refresh interval assumed until the Host reports its own. */
		const DEFAULT_REFRESH_SECONDS = 300;
		/** Share of the grant below which the card warns. */
		const LOW_REMAINING_RATIO = .2;
		/** One amount in the gateway's display currency. */
		function formatAmount(value, currency) {
			return currency + (Math.round(value * 100) / 100).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
		}
		/** Whether the remaining balance is low enough to warn about. */
		function isLow(snapshot) {
			if (snapshot.unlimited || snapshot.total <= 0) return false;
			return snapshot.remaining / snapshot.total < LOW_REMAINING_RATIO;
		}
		/** The one-line summary the card renders for a loaded balance. */
		function summaryOf(snapshot, currency) {
			if (snapshot.unlimited) return "不限额度";
			return `剩余 ${formatAmount(snapshot.remaining, currency)}`;
		}
		/** Fill share of the grant, clamped to a renderable range. */
		function fillPercent(snapshot) {
			if (snapshot.unlimited || snapshot.total <= 0) return 100;
			const ratio = snapshot.remaining / snapshot.total;
			return Math.max(0, Math.min(1, ratio)) * 100;
		}
		/**
		* The sidebar balance card.
		* @returns the card, or null while the user has it switched off.
		*/
		function NowCodingQuotaCard() {
			const [state, setState] = (0, react.useState)({ kind: "loading" });
			const [refreshSeconds, setRefreshSeconds] = (0, react.useState)(DEFAULT_REFRESH_SECONDS);
			const load = (0, react.useCallback)(async (signal) => {
				try {
					const view = await getQuota(signal);
					if (signal?.aborted === true) return;
					setRefreshSeconds(view.refreshSeconds > 0 ? view.refreshSeconds : DEFAULT_REFRESH_SECONDS);
					setState({
						kind: "ready",
						view
					});
				} catch (error) {
					if (signal?.aborted === true) return;
					setState({
						kind: "failed",
						message: error instanceof NowCodingApiError ? error.message : String(error)
					});
				}
			}, []);
			(0, react.useEffect)(() => {
				const controller = new AbortController();
				load(controller.signal);
				return () => {
					controller.abort();
				};
			}, [load]);
			(0, react.useEffect)(() => {
				const timer = setInterval(() => {
					load();
				}, refreshSeconds * 1e3);
				return () => {
					clearInterval(timer);
				};
			}, [load, refreshSeconds]);
			const retry = (0, react.useCallback)(() => {
				setState({ kind: "loading" });
				load();
			}, [load]);
			if (state.kind === "ready" && !state.view.enabled) return null;
			if (state.kind === "loading") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: NowCodingQuotaCard_module_css_default.card,
				"data-state": "loading",
				children: "余量读取中…"
			});
			if (state.kind === "failed") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: NowCodingQuotaCard_module_css_default.card,
				"data-state": "failed",
				title: state.message,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: NowCodingQuotaCard_module_css_default.summary,
					children: "余量读取失败"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: NowCodingQuotaCard_module_css_default.retry,
					onClick: retry,
					children: "重试"
				})]
			});
			const { snapshot, currency } = state.view;
			if (snapshot === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: NowCodingQuotaCard_module_css_default.card,
				"data-state": "unconfigured",
				children: "未配置 API Key"
			});
			const low = isLow(snapshot);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: NowCodingQuotaCard_module_css_default.card,
				"data-state": low ? "low" : "ready",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: NowCodingQuotaCard_module_css_default.row,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: NowCodingQuotaCard_module_css_default.summary,
						children: summaryOf(snapshot, currency)
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: NowCodingQuotaCard_module_css_default.total,
						children: snapshot.unlimited ? "" : `/ ${formatAmount(snapshot.total, currency)}`
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: NowCodingQuotaCard_module_css_default.track,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: NowCodingQuotaCard_module_css_default.fill,
						style: { width: `${fillPercent(snapshot)}%` }
					})
				})]
			});
		}
		//#endregion
		//#region src/settings-shared.ts
		/**
		* Endpoint base every NowCoding model request is sent to.
		*
		* The gateway publishes two front ends over one host: `https://nowcoding.ai/v1`
		* for the OpenAI-compatible routes and `https://nowcoding.ai` for the
		* Anthropic-compatible `/v1/messages` route. This plugin speaks the
		* OpenAI-compatible route, so its base carries the `/v1` segment.
		*/
		const NOWCODING_DEFAULT_BASE_URL = "https://nowcoding.ai/v1";
		/** Schema-default fallbacks used by the client while the settings route is unavailable. */
		const NOWCODING_SETTINGS_DEFAULTS = {
			apiKey: "",
			baseURL: NOWCODING_DEFAULT_BASE_URL,
			fast: false,
			fastServiceTier: "priority",
			quotaCard: true
		};
		//#endregion
		//#region \0dsh-css:/Users/lingyun/mywork/dsh-llm-nowcoding/src/client/NowCodingSettingsSection.module.css.mjs
		const css = ".nowcoding_H-GdMq_section{flex-direction:column;gap:14px;display:flex}.nowcoding_H-GdMq_intro{color:var(--dsw-text-secondary,#9a9aa8);margin:0;font-size:13px;line-height:1.55}.nowcoding_H-GdMq_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:16px;flex-direction:column;display:flex;overflow:hidden}.nowcoding_H-GdMq_row{justify-content:space-between;align-items:center;gap:20px;padding:14px 16px;display:flex}.nowcoding_H-GdMq_row+.nowcoding_H-GdMq_row{border-top:1px solid var(--dsw-line-secondary,#2a2a35)}.nowcoding_H-GdMq_rowText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.nowcoding_H-GdMq_title{color:var(--dsw-text-primary,#f2f2f5);font-size:14px;font-weight:600}.nowcoding_H-GdMq_desc{color:var(--dsw-text-secondary,#9a9aa8);font-size:12px;line-height:1.5}.nowcoding_H-GdMq_control{justify-content:flex-end;align-items:center;gap:8px;min-width:260px;display:flex}.nowcoding_H-GdMq_input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2,#0000002e);min-width:0;height:28px;color:var(--dsw-text-primary,#f2f2f5);border-radius:8px;flex:1;padding:0 10px;font-size:13px}.nowcoding_H-GdMq_input:disabled{opacity:.6}.nowcoding_H-GdMq_button,.nowcoding_H-GdMq_buttonPrimary,.nowcoding_H-GdMq_iconButton{border:1px solid var(--dsw-alias-border-l2);height:28px;color:var(--dsw-text-primary,#f2f2f5);cursor:pointer;background:0 0;border-radius:999px;flex:none;padding:0 12px;font-size:12px}.nowcoding_H-GdMq_buttonPrimary{background:var(--dsw-brand,#4f7cff);color:#fff;border-color:#0000}.nowcoding_H-GdMq_button:disabled,.nowcoding_H-GdMq_buttonPrimary:disabled,.nowcoding_H-GdMq_iconButton:disabled{opacity:.5;cursor:default}.nowcoding_H-GdMq_checkbox{width:16px;height:16px;accent-color:var(--dsw-brand,#4f7cff)}.nowcoding_H-GdMq_segmented{align-items:center;gap:6px;display:inline-flex}.nowcoding_H-GdMq_segment{border:1px solid var(--dsw-alias-border-l2);height:28px;color:var(--dsw-text-secondary,#9a9aa8);font-variant-numeric:tabular-nums;cursor:pointer;background:0 0;border-radius:999px;padding:0 12px;font-size:12px}.nowcoding_H-GdMq_segmentActive{background:var(--dsw-brand,#4f7cff);color:#fff;border-color:#0000}.nowcoding_H-GdMq_badgeOn,.nowcoding_H-GdMq_badgeOff{border-radius:999px;flex:none;padding:5px 8px;font-size:11px;line-height:1}.nowcoding_H-GdMq_badgeOn{color:#6fe3b2;background:#6fe3b21f}.nowcoding_H-GdMq_badgeOff{color:#9a9aa8;background:#9a9aa81f}.nowcoding_H-GdMq_quotaBody{flex-direction:column;flex:1;gap:8px;min-width:0;display:flex}.nowcoding_H-GdMq_quotaGrid{grid-template-columns:auto 1fr;align-items:baseline;gap:6px 16px;display:grid}.nowcoding_H-GdMq_quotaLabel{color:var(--dsw-text-secondary,#9a9aa8);font-size:12px}.nowcoding_H-GdMq_quotaValue{color:var(--dsw-text-primary,#f2f2f5);font-variant-numeric:tabular-nums;font-size:13px}.nowcoding_H-GdMq_error{color:#f2a1a1;margin:0;font-size:12px;line-height:1.5}.nowcoding_H-GdMq_notice{color:#6fe3b2;margin:0;font-size:12px;line-height:1.5}.nowcoding_H-GdMq_hint{color:var(--dsw-text-secondary,#9a9aa8);margin:0;font-size:12px;line-height:1.5}.nowcoding_H-GdMq_actions{justify-content:flex-end;gap:8px;display:flex}";
		const tagId = "@elves-ai/dsh-llm-nowcoding/NowCodingSettingsSection.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@elves-ai/dsh-llm-nowcoding";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var NowCodingSettingsSection_module_css_default = {
			"section": "nowcoding_H-GdMq_section",
			"button": "nowcoding_H-GdMq_button",
			"desc": "nowcoding_H-GdMq_desc",
			"control": "nowcoding_H-GdMq_control",
			"row": "nowcoding_H-GdMq_row",
			"input": "nowcoding_H-GdMq_input",
			"segmented": "nowcoding_H-GdMq_segmented",
			"rowText": "nowcoding_H-GdMq_rowText",
			"segment": "nowcoding_H-GdMq_segment",
			"error": "nowcoding_H-GdMq_error",
			"actions": "nowcoding_H-GdMq_actions",
			"buttonPrimary": "nowcoding_H-GdMq_buttonPrimary",
			"quotaBody": "nowcoding_H-GdMq_quotaBody",
			"checkbox": "nowcoding_H-GdMq_checkbox",
			"intro": "nowcoding_H-GdMq_intro",
			"iconButton": "nowcoding_H-GdMq_iconButton",
			"segmentActive": "nowcoding_H-GdMq_segmentActive",
			"badgeOn": "nowcoding_H-GdMq_badgeOn",
			"quotaValue": "nowcoding_H-GdMq_quotaValue",
			"hint": "nowcoding_H-GdMq_hint",
			"title": "nowcoding_H-GdMq_title",
			"card": "nowcoding_H-GdMq_card",
			"quotaGrid": "nowcoding_H-GdMq_quotaGrid",
			"badgeOff": "nowcoding_H-GdMq_badgeOff",
			"quotaLabel": "nowcoding_H-GdMq_quotaLabel",
			"notice": "nowcoding_H-GdMq_notice"
		};
		//#endregion
		//#region src/client/NowCodingSettingsSection.tsx
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
		const INITIAL_DRAFTS = {
			apiKey: "",
			baseURL: NOWCODING_DEFAULT_BASE_URL,
			fast: NOWCODING_SETTINGS_DEFAULTS.fast,
			fastServiceTier: NOWCODING_SETTINGS_DEFAULTS.fastServiceTier,
			quotaCard: NOWCODING_SETTINGS_DEFAULTS.quotaCard
		};
		/** The two wire spellings of the fast tier, in presentation order. */
		const FAST_SERVICE_TIERS = [{
			value: "priority",
			label: "priority",
			hint: "较早的写法，对未跟进改名的网关兼容性最好"
		}, {
			value: "fast",
			label: "fast",
			hint: "当前写法，用于站方已支持 service_tier: fast 的渠道"
		}];
		/** Read the redacted document into editable drafts; the key draft stays blank. */
		function draftsOf(envelope) {
			const view = settingsViewOf(envelope);
			return {
				apiKey: "",
				baseURL: typeof view.baseURL === "string" && view.baseURL.length > 0 ? view.baseURL : NOWCODING_DEFAULT_BASE_URL,
				fast: typeof view.fast === "boolean" ? view.fast : NOWCODING_SETTINGS_DEFAULTS.fast,
				fastServiceTier: view.fastServiceTier ?? NOWCODING_SETTINGS_DEFAULTS.fastServiceTier,
				quotaCard: typeof view.quotaCard === "boolean" ? view.quotaCard : NOWCODING_SETTINGS_DEFAULTS.quotaCard
			};
		}
		/** Format an amount in the site's display currency. */
		function formatMoney(amount, currency) {
			if (!Number.isFinite(amount)) return "—";
			return `${currency === "" ? "¥" : currency}${amount.toFixed(2)}`;
		}
		/** Format an epoch-ms instant as local `YYYY-MM-DD HH:mm:ss`. */
		function formatTimestamp(at) {
			if (!Number.isFinite(at) || at <= 0) return "—";
			const moment = new Date(at);
			const pad = (part) => String(part).padStart(2, "0");
			return `${moment.getFullYear()}-${pad(moment.getMonth() + 1)}-${pad(moment.getDate())} ${pad(moment.getHours())}:${pad(moment.getMinutes())}:${pad(moment.getSeconds())}`;
		}
		/** Human-readable error copy for one route failure. */
		function messageOf(error) {
			if (error instanceof NowCodingApiError && error.code === "settings-conflict") return "设置已在其他窗口被修改，已重新载入；请再次保存。";
			return error instanceof Error ? error.message : String(error);
		}
		/**
		* Render the NowCoding settings page.
		* @returns the section element tree.
		*/
		function NowCodingSettingsSection() {
			const [envelope, setEnvelope] = (0, react.useState)(null);
			const [drafts, setDrafts] = (0, react.useState)(INITIAL_DRAFTS);
			const [loading, setLoading] = (0, react.useState)(true);
			const [saving, setSaving] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const [notice, setNotice] = (0, react.useState)(null);
			const [showApiKey, setShowApiKey] = (0, react.useState)(false);
			const [quota, setQuota] = (0, react.useState)(null);
			const [quotaLoading, setQuotaLoading] = (0, react.useState)(false);
			const [quotaError, setQuotaError] = (0, react.useState)(null);
			const refreshQuota = (0, react.useCallback)(async () => {
				setQuotaLoading(true);
				try {
					setQuota(await getQuota());
					setQuotaError(null);
				} catch (caught) {
					setQuotaError(messageOf(caught));
				} finally {
					setQuotaLoading(false);
				}
			}, []);
			(0, react.useEffect)(() => {
				let cancelled = false;
				getNowCodingSettings().then((next) => {
					if (cancelled) return;
					setEnvelope(next);
					setDrafts(draftsOf(next));
					setLoading(false);
					refreshQuota();
				}).catch((caught) => {
					if (cancelled) return;
					setError(messageOf(caught));
					setLoading(false);
				});
				return () => {
					cancelled = true;
				};
			}, [refreshQuota]);
			const applyOps = async (ops) => {
				if (envelope === null || envelope.writable === false) return;
				setSaving(true);
				setError(null);
				setNotice(null);
				try {
					const next = await mutateNowCodingSettings(ops, envelope.revision);
					setEnvelope(next);
					setDrafts(draftsOf(next));
					setNotice("已保存，新配置立即用于下一次请求。");
					refreshQuota();
				} catch (caught) {
					setError(messageOf(caught));
					if (caught instanceof NowCodingApiError && caught.code === "settings-conflict") getNowCodingSettings().then((next) => {
						setEnvelope(next);
						setDrafts(draftsOf(next));
					}).catch(() => void 0);
				} finally {
					setSaving(false);
				}
			};
			/** Commit every draft in one revision-checked edit. */
			const save = () => {
				const baseURL = drafts.baseURL.trim();
				const apiKey = drafts.apiKey.trim();
				const ops = [];
				if (apiKey !== "") ops.push({
					op: "set",
					path: ["apiKey"],
					value: apiKey
				});
				if (baseURL === "") ops.push({
					op: "unset",
					path: ["baseURL"]
				});
				else ops.push({
					op: "set",
					path: ["baseURL"],
					value: baseURL
				});
				ops.push({
					op: "set",
					path: ["fast"],
					value: drafts.fast
				});
				ops.push({
					op: "set",
					path: ["fastServiceTier"],
					value: drafts.fastServiceTier
				});
				ops.push({
					op: "set",
					path: ["quotaCard"],
					value: drafts.quotaCard
				});
				applyOps(ops);
			};
			if (loading) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: NowCodingSettingsSection_module_css_default.section,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: NowCodingSettingsSection_module_css_default.hint,
					children: "正在加载 NowCoding 配置…"
				})
			});
			if (envelope === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: NowCodingSettingsSection_module_css_default.section,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: NowCodingSettingsSection_module_css_default.intro,
					children: "NowCoding 提供方的 API Key、端点与快速模式设置。"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: NowCodingSettingsSection_module_css_default.error,
					role: "alert",
					children: error ?? "无法读取 NowCoding 配置。"
				})]
			});
			const configured = isNowCodingApiKeyConfigured(envelope);
			const disabled = envelope.writable === false || saving;
			const snapshot = quota === null ? null : quota.snapshot;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: NowCodingSettingsSection_module_css_default.section,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: NowCodingSettingsSection_module_css_default.intro,
						children: "NowCoding 提供方的 API Key、端点，以及 GPT 快速模式与侧栏余量卡片的开关。保存后立即生效。"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: NowCodingSettingsSection_module_css_default.card,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: NowCodingSettingsSection_module_css_default.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: NowCodingSettingsSection_module_css_default.rowText,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
										className: NowCodingSettingsSection_module_css_default.title,
										htmlFor: "nowcoding-api-key",
										children: "API Key"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: NowCodingSettingsSection_module_css_default.desc,
										children: "密钥不会回显；留空保存表示保持当前值，未配置时回退 Host 的 apiKeyEnv 环境变量。"
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: NowCodingSettingsSection_module_css_default.control,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											id: "nowcoding-api-key",
											className: NowCodingSettingsSection_module_css_default.input,
											type: showApiKey ? "text" : "password",
											autoComplete: "off",
											value: drafts.apiKey,
											placeholder: configured ? "已配置（留空保持不变）" : "sk-...",
											disabled,
											onChange: (event) => {
												setDrafts({
													...drafts,
													apiKey: event.currentTarget.value
												});
											}
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: NowCodingSettingsSection_module_css_default.iconButton,
											"aria-label": showApiKey ? "隐藏 API Key" : "显示 API Key",
											title: showApiKey ? "隐藏 API Key" : "显示 API Key",
											disabled,
											onClick: () => {
												setShowApiKey((previous) => !previous);
											},
											children: showApiKey ? "隐藏" : "显示"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: configured ? NowCodingSettingsSection_module_css_default.badgeOn : NowCodingSettingsSection_module_css_default.badgeOff,
											children: configured ? "已配置" : "未配置"
										}),
										configured && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: NowCodingSettingsSection_module_css_default.button,
											disabled,
											onClick: () => {
												applyOps([{
													op: "unset",
													path: ["apiKey"]
												}]);
											},
											children: "清除"
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: NowCodingSettingsSection_module_css_default.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: NowCodingSettingsSection_module_css_default.rowText,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
										className: NowCodingSettingsSection_module_css_default.title,
										htmlFor: "nowcoding-base-url",
										children: "Base URL"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: NowCodingSettingsSection_module_css_default.desc,
										children: [
											"端点基址，默认 ",
											NOWCODING_DEFAULT_BASE_URL,
											"；模型、余量与价格请求都基于它拼接。"
										]
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: NowCodingSettingsSection_module_css_default.control,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										id: "nowcoding-base-url",
										className: NowCodingSettingsSection_module_css_default.input,
										type: "text",
										value: drafts.baseURL,
										placeholder: NOWCODING_DEFAULT_BASE_URL,
										disabled,
										onChange: (event) => {
											setDrafts({
												...drafts,
												baseURL: event.currentTarget.value
											});
										}
									})
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: NowCodingSettingsSection_module_css_default.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: NowCodingSettingsSection_module_css_default.rowText,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: NowCodingSettingsSection_module_css_default.title,
										children: "启用 GPT 快速模式（fast）"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: NowCodingSettingsSection_module_css_default.desc,
										children: "开启后，具备快速档的模型会在请求里带上 service_tier。需要站方渠道开启 allow_service_tier 透传，否则该参数会被静默剥离；快速档计费高于标准档。"
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: NowCodingSettingsSection_module_css_default.control,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										className: NowCodingSettingsSection_module_css_default.checkbox,
										checked: drafts.fast,
										disabled,
										"aria-label": "启用 GPT 快速模式（fast）",
										onChange: (event) => {
											setDrafts({
												...drafts,
												fast: event.currentTarget.checked
											});
										}
									})
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: NowCodingSettingsSection_module_css_default.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: NowCodingSettingsSection_module_css_default.rowText,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: NowCodingSettingsSection_module_css_default.title,
										children: "fast 的 wire 取值"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: NowCodingSettingsSection_module_css_default.desc,
										children: "请求里 service_tier 的实际写法，只在快速模式开启时发送。"
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: NowCodingSettingsSection_module_css_default.control,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: NowCodingSettingsSection_module_css_default.segmented,
										role: "group",
										"aria-label": "fast 的 wire 取值",
										children: FAST_SERVICE_TIERS.map((tier) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: drafts.fastServiceTier === tier.value ? `${NowCodingSettingsSection_module_css_default.segment} ${NowCodingSettingsSection_module_css_default.segmentActive}` : NowCodingSettingsSection_module_css_default.segment,
											"aria-pressed": drafts.fastServiceTier === tier.value,
											title: tier.hint,
											disabled,
											onClick: () => {
												setDrafts({
													...drafts,
													fastServiceTier: tier.value
												});
											},
											children: tier.label
										}, tier.value))
									})
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: NowCodingSettingsSection_module_css_default.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: NowCodingSettingsSection_module_css_default.rowText,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: NowCodingSettingsSection_module_css_default.title,
										children: "在左侧栏显示余量卡片"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: NowCodingSettingsSection_module_css_default.desc,
										children: "卡片位于左侧栏底部、设置入口上方，按固定间隔读取余量。"
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: NowCodingSettingsSection_module_css_default.control,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										className: NowCodingSettingsSection_module_css_default.checkbox,
										checked: drafts.quotaCard,
										disabled,
										"aria-label": "在左侧栏显示余量卡片",
										onChange: (event) => {
											setDrafts({
												...drafts,
												quotaCard: event.currentTarget.checked
											});
										}
									})
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: NowCodingSettingsSection_module_css_default.card,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: NowCodingSettingsSection_module_css_default.row,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: NowCodingSettingsSection_module_css_default.rowText,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: NowCodingSettingsSection_module_css_default.title,
									children: "余量"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: NowCodingSettingsSection_module_css_default.desc,
									children: "当前 API Key 的额度余额，读取自站方的计费接口。"
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: NowCodingSettingsSection_module_css_default.control,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: NowCodingSettingsSection_module_css_default.button,
									disabled: quotaLoading,
									onClick: () => {
										refreshQuota();
									},
									children: quotaLoading ? "刷新中…" : "刷新"
								})
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: NowCodingSettingsSection_module_css_default.row,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: NowCodingSettingsSection_module_css_default.quotaBody,
								children: [
									snapshot !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: NowCodingSettingsSection_module_css_default.quotaGrid,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: NowCodingSettingsSection_module_css_default.quotaLabel,
												children: "剩余"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: NowCodingSettingsSection_module_css_default.quotaValue,
												children: snapshot.unlimited ? "不限额度" : formatMoney(snapshot.remaining, quota?.currency ?? "")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: NowCodingSettingsSection_module_css_default.quotaLabel,
												children: "总额度"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: NowCodingSettingsSection_module_css_default.quotaValue,
												children: snapshot.unlimited ? "不限额度" : formatMoney(snapshot.total, quota?.currency ?? "")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: NowCodingSettingsSection_module_css_default.quotaLabel,
												children: "已用"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: NowCodingSettingsSection_module_css_default.quotaValue,
												children: snapshot.unlimited ? "—" : formatMoney(snapshot.used, quota?.currency ?? "")
											}),
											snapshot.accessUntil > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: NowCodingSettingsSection_module_css_default.quotaLabel,
												children: "额度到期"
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: NowCodingSettingsSection_module_css_default.quotaValue,
												children: formatTimestamp(snapshot.accessUntil)
											})] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: NowCodingSettingsSection_module_css_default.quotaLabel,
												children: "抓取时间"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: NowCodingSettingsSection_module_css_default.quotaValue,
												children: formatTimestamp(snapshot.fetchedAt)
											})
										]
									}),
									quotaError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: NowCodingSettingsSection_module_css_default.error,
										role: "alert",
										children: quotaError
									}),
									quotaError === null && snapshot === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: NowCodingSettingsSection_module_css_default.hint,
										children: quotaLoading ? "正在读取余量…" : "尚未配置 API Key：先在上方保存一个密钥，或让 Host 的 apiKeyEnv 指向一个环境变量。"
									})
								]
							})
						})]
					}),
					error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: NowCodingSettingsSection_module_css_default.error,
						role: "alert",
						children: error
					}),
					notice !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: NowCodingSettingsSection_module_css_default.notice,
						role: "status",
						children: notice
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: NowCodingSettingsSection_module_css_default.actions,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: NowCodingSettingsSection_module_css_default.button,
							disabled,
							onClick: () => {
								getNowCodingSettings().then((next) => {
									setEnvelope(next);
									setDrafts(draftsOf(next));
									setNotice("已重置为当前保存的配置。");
								}).catch((caught) => {
									setError(messageOf(caught));
								});
							},
							children: "重置"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: NowCodingSettingsSection_module_css_default.buttonPrimary,
							disabled,
							onClick: save,
							children: saving ? "保存中…" : "保存"
						})]
					})
				]
			});
		}
		//#endregion
		//#region src/client/index.tsx
		/** Required services before mounting. */
		const inject = ["slots"];
		/**
		* Register the sidebar balance card and the NowCoding settings page.
		* @param ctx - the browser plugin context.
		*/
		function apply(ctx) {
			ctx.slots.inject("sidebar.footer.action", () => {
				ctx.slots.register({
					name: "sidebar.footer.action",
					id: "nowcoding-quota",
					order: 50
				}, NowCodingQuotaCard);
			});
			ctx.slots.inject("settings.section", () => {
				ctx.slots.register({
					name: "settings.section",
					id: "nowcoding",
					order: 78,
					label: "NowCoding"
				}, NowCodingSettingsSection);
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map