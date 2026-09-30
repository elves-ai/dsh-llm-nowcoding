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
		/**
		* Read the key-scoped model listing the picker's allowlist is chosen from.
		*
		* Every id the answer carries is one the configured key can serve; `known`
		* adds whether the plugin's served catalog can also describe it.
		* @returns the listing.
		*/
		function getModelList() {
			return post("models.list");
		}
		/** Read the redacted NowCoding settings document. */
		function getNowCodingSettings() {
			return post("settings.get");
		}
		/**
		* Sign in with the account's NowCoding console credentials.
		*
		* The password rides this one request and is stored by neither half: the Host
		* exchanges it for the console credential — the sign-in session, plus the
		* access token when one is readable — and writes that into the settings slots
		* without ever sending it back.
		* @param username - console username.
		* @param password - console password.
		* @returns the sign-in answer, or a request for the second factor.
		*/
		function panelLogin(username, password) {
			return post("panel.login", {
				username,
				password
			});
		}
		/**
		* Answer the two-factor challenge the last {@link panelLogin} opened.
		* @param code - authenticator code, or one of the account's backup codes.
		* @returns the sign-in answer.
		*/
		function panelTwoFactorLogin(code) {
			return post("panel.two-factor", { code });
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
		* Subscribe to successful settings commits from this bundle.
		*
		* The settings page and the sidebar card are independent mounts with no shared
		* store, so the commit notification lives on the one module they share: the
		* card drops out as soon as a save setting `quotaCard` false lands, instead of
		* waiting out its refresh tick.
		* @param listener - called after every successful `settings.mutate`.
		* @returns the unsubscribe function.
		*/
		function onNowCodingSettingsCommitted(listener) {
			committedListeners.add(listener);
			return () => {
				committedListeners.delete(listener);
			};
		}
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
				...typeof value.quotaCard === "boolean" ? { quotaCard: value.quotaCard } : {},
				...Array.isArray(value.visibleModels) ? { visibleModels: value.visibleModels.filter((id) => typeof id === "string" && id.trim() !== "") } : {}
			};
		}
		/** True when the write-only `apiKey` slot currently holds a value. */
		function isNowCodingApiKeyConfigured(envelope) {
			return secretSet(envelope, "apiKey");
		}
		/**
		* True when the write-only `panelSession` slot currently holds a value.
		* @param envelope - a settings envelope.
		* @returns whether a sign-in session cookie is stored.
		*/
		function isNowCodingPanelSessionConfigured(envelope) {
			return secretSet(envelope, "panelSession");
		}
		/**
		* Notify the shared listeners after a settings change that did not go through
		* {@link mutateNowCodingSettings} — a Host-side write such as a sign-in's
		* credential. The sidebar card and the detail page share this module, so the
		* card re-reads the moment a sign-in lands instead of waiting out its tick.
		*/
		function notifyNowCodingSettingsCommitted() {
			for (const listener of committedListeners) listener();
		}
		/** Whether one top-level secret slot holds a value. */
		function secretSet(envelope, field) {
			return envelope.secrets.some((secret) => secret.path.length === 1 && secret.path[0] === field && secret.set);
		}
		//#endregion
		//#region \0dsh-css:/Users/lingyun/mywork/dsh-llm-nowcoding/src/client/NowCodingQuotaCard.module.css.mjs
		const css$1 = ".nowcoding_G1rn4q_card{width:100%;color:var(--dsw-text-secondary,#9a9aa8);background:var(--dsw-alias-bg-layer-3,#7f7f7f14);border-radius:6px;flex-direction:column;gap:4px;padding:6px 8px;font-size:12px;line-height:1.4;display:flex}.nowcoding_G1rn4q_card[data-state=failed]{flex-direction:row;justify-content:space-between;align-items:center}.nowcoding_G1rn4q_row{justify-content:space-between;align-items:baseline;gap:6px;display:flex}.nowcoding_G1rn4q_summary{color:var(--dsw-text-primary,#f2f2f5);font-weight:600}.nowcoding_G1rn4q_card[data-state=low] .nowcoding_G1rn4q_summary{color:var(--dsw-alias-warning,#e0a44a)}.nowcoding_G1rn4q_total{color:var(--dsw-text-tertiary,#6f6f7e)}.nowcoding_G1rn4q_detail{color:var(--dsw-text-tertiary,#6f6f7e);font-size:11px}.nowcoding_G1rn4q_track{background:var(--dsw-line-secondary,#2a2a35);border-radius:2px;height:4px;overflow:hidden}.nowcoding_G1rn4q_fill{background:var(--dsw-alias-brand,#4d6bfe);border-radius:2px;height:100%}.nowcoding_G1rn4q_card[data-state=low] .nowcoding_G1rn4q_fill{background:var(--dsw-alias-warning,#e0a44a)}.nowcoding_G1rn4q_retry{border:1px solid var(--dsw-line-secondary,#2a2a35);color:inherit;font:inherit;cursor:pointer;background:0 0;border-radius:4px;padding:0 6px}";
		const tagId$1 = "@elves-ai/dsh-llm-nowcoding/NowCodingQuotaCard.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@elves-ai/dsh-llm-nowcoding";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var NowCodingQuotaCard_module_css_default = {
			"row": "nowcoding_G1rn4q_row",
			"track": "nowcoding_G1rn4q_track",
			"detail": "nowcoding_G1rn4q_detail",
			"retry": "nowcoding_G1rn4q_retry",
			"card": "nowcoding_G1rn4q_card",
			"summary": "nowcoding_G1rn4q_summary",
			"fill": "nowcoding_G1rn4q_fill",
			"total": "nowcoding_G1rn4q_total"
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
			return snapshot.source === "subscription" ? `订阅剩余 ${formatAmount(snapshot.remaining, currency)}` : `剩余 ${formatAmount(snapshot.remaining, currency)}`;
		}
		/** What period a subscription's figures cover, as the gateway names it. */
		function periodLabel(resetPeriod) {
			if (resetPeriod === "daily") return "每日额度";
			if (resetPeriod === "weekly") return "每周额度";
			if (resetPeriod === "monthly") return "每月额度";
			return "订阅额度";
		}
		/** A reset instant as a short local label; the weekday is enough when it is not today. */
		function formatReset(epochMs) {
			const at = new Date(epochMs);
			const now = /* @__PURE__ */ new Date();
			const sameDay = at.getFullYear() === now.getFullYear() && at.getMonth() === now.getMonth() && at.getDate() === now.getDate();
			const clock = String(at.getHours()).padStart(2, "0") + ":" + String(at.getMinutes()).padStart(2, "0");
			return sameDay ? clock : at.getMonth() + 1 + "月" + at.getDate() + "日 " + clock;
		}
		/** The second line: which period the balance covers and when it resets. */
		function detailOf(snapshot) {
			if (snapshot.source !== "subscription") return void 0;
			const period = periodLabel(snapshot.resetPeriod);
			return snapshot.resetAt > 0 ? `${period} · ${formatReset(snapshot.resetAt)} 重置` : period;
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
				return onNowCodingSettingsCommitted(() => {
					load();
				});
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
				children: "未配置 API Key 或登录账号"
			});
			const low = isLow(snapshot);
			const detail = detailOf(snapshot);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: NowCodingQuotaCard_module_css_default.card,
				"data-state": low ? "low" : "ready",
				title: snapshot.planTitle ?? void 0,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: NowCodingQuotaCard_module_css_default.row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: NowCodingQuotaCard_module_css_default.summary,
							children: summaryOf(snapshot, currency)
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: NowCodingQuotaCard_module_css_default.total,
							children: snapshot.unlimited ? "" : `/ ${formatAmount(snapshot.total, currency)}`
						})]
					}),
					detail !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: NowCodingQuotaCard_module_css_default.detail,
						children: detail
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: NowCodingQuotaCard_module_css_default.track,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: NowCodingQuotaCard_module_css_default.fill,
							style: { width: `${fillPercent(snapshot)}%` }
						})
					})
				]
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
			quotaCard: true,
			panelToken: "",
			panelUserId: "",
			panelSession: "",
			visibleModels: []
		};
		//#endregion
		//#region \0dsh-css:/Users/lingyun/mywork/dsh-llm-nowcoding/src/client/NowCodingDetailPage.module.css.mjs
		const css = ".nowcoding_cGnama_section{flex-direction:column;gap:14px;display:flex}.nowcoding_cGnama_intro{color:var(--dsw-text-secondary,#9a9aa8);margin:0;font-size:13px;line-height:1.55}.nowcoding_cGnama_cardIntro{color:var(--dsw-text-secondary,#9a9aa8);margin:0;padding:12px 16px 0;font-size:12px;line-height:1.5}.nowcoding_cGnama_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:16px;flex-direction:column;display:flex;overflow:hidden}.nowcoding_cGnama_row{justify-content:space-between;align-items:center;gap:20px;padding:14px 16px;display:flex}.nowcoding_cGnama_row+.nowcoding_cGnama_row{border-top:1px solid var(--dsw-line-secondary,#2a2a35)}.nowcoding_cGnama_rowText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.nowcoding_cGnama_title{color:var(--dsw-text-primary,#f2f2f5);font-size:14px;font-weight:600}.nowcoding_cGnama_desc{color:var(--dsw-text-secondary,#9a9aa8);font-size:12px;line-height:1.5}.nowcoding_cGnama_control{justify-content:flex-end;align-items:center;gap:8px;min-width:260px;display:flex}.nowcoding_cGnama_input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2,#0000002e);min-width:0;height:28px;color:var(--dsw-text-primary,#f2f2f5);border-radius:8px;flex:1;padding:0 10px;font-size:13px}.nowcoding_cGnama_input:disabled{opacity:.6}.nowcoding_cGnama_button,.nowcoding_cGnama_buttonPrimary,.nowcoding_cGnama_iconButton{border:1px solid var(--dsw-alias-border-l2);height:28px;color:var(--dsw-text-primary,#f2f2f5);cursor:pointer;background:0 0;border-radius:999px;flex:none;padding:0 12px;font-size:12px}.nowcoding_cGnama_buttonPrimary{background:var(--dsw-brand,#4f7cff);color:#fff;border-color:#0000}.nowcoding_cGnama_button:disabled,.nowcoding_cGnama_buttonPrimary:disabled,.nowcoding_cGnama_iconButton:disabled{opacity:.5;cursor:default}.nowcoding_cGnama_checkbox{width:16px;height:16px;accent-color:var(--dsw-brand,#4f7cff)}.nowcoding_cGnama_segmented{align-items:center;gap:6px;display:inline-flex}.nowcoding_cGnama_segment{border:1px solid var(--dsw-alias-border-l2);height:28px;color:var(--dsw-text-secondary,#9a9aa8);font-variant-numeric:tabular-nums;cursor:pointer;background:0 0;border-radius:999px;padding:0 12px;font-size:12px}.nowcoding_cGnama_segmentActive{background:var(--dsw-brand,#4f7cff);color:#fff;border-color:#0000}.nowcoding_cGnama_badgeOn,.nowcoding_cGnama_badgeOff{border-radius:999px;flex:none;padding:5px 8px;font-size:11px;line-height:1}.nowcoding_cGnama_badgeOn{color:#6fe3b2;background:#6fe3b21f}.nowcoding_cGnama_badgeOff{color:#9a9aa8;background:#9a9aa81f}.nowcoding_cGnama_quotaBody{flex-direction:column;flex:1;gap:8px;min-width:0;display:flex}.nowcoding_cGnama_quotaGrid{grid-template-columns:auto 1fr;align-items:baseline;gap:6px 16px;display:grid}.nowcoding_cGnama_quotaLabel{color:var(--dsw-text-secondary,#9a9aa8);font-size:12px}.nowcoding_cGnama_quotaValue{color:var(--dsw-text-primary,#f2f2f5);font-variant-numeric:tabular-nums;font-size:13px}.nowcoding_cGnama_error{color:#f2a1a1;margin:0;font-size:12px;line-height:1.5}.nowcoding_cGnama_notice{color:#6fe3b2;margin:0;font-size:12px;line-height:1.5}.nowcoding_cGnama_hint{color:var(--dsw-text-secondary,#9a9aa8);margin:0;font-size:12px;line-height:1.5}.nowcoding_cGnama_actions{justify-content:flex-end;gap:8px;display:flex}.nowcoding_cGnama_meter{background:var(--dsw-line-secondary,#2a2a35);border-radius:3px;height:6px;display:block;overflow:hidden}.nowcoding_cGnama_meterFill{background:var(--dsw-brand,#4f7cff);border-radius:3px;height:100%;transition:width .4s;display:block}.nowcoding_cGnama_command{background:var(--dsw-alias-bg-layer-2,#1b1b24);color:var(--dsw-text-primary,#f2f2f5);border-radius:6px;align-self:flex-start;margin:2px 0 0;padding:3px 8px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px}.nowcoding_cGnama_modelList{border:1px solid var(--dsw-line-secondary,#2a2a35);border-radius:8px;flex-direction:column;gap:2px;max-height:260px;margin-top:8px;padding:4px;display:flex;overflow-y:auto}.nowcoding_cGnama_modelRow{cursor:pointer;border-radius:6px;align-items:center;gap:8px;padding:4px 6px;display:flex}.nowcoding_cGnama_modelRow:hover{background:var(--dsw-alias-bg-layer-2,#1b1b24)}.nowcoding_cGnama_modelId{color:var(--dsw-text-primary,#f2f2f5);word-break:break-all;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px}.nowcoding_cGnama_modelOwner{color:var(--dsw-text-secondary,#9a9aa8);font-size:11px}";
		const tagId = "@elves-ai/dsh-llm-nowcoding/NowCodingDetailPage.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@elves-ai/dsh-llm-nowcoding";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var NowCodingDetailPage_module_css_default = {
			"notice": "nowcoding_cGnama_notice",
			"control": "nowcoding_cGnama_control",
			"segmented": "nowcoding_cGnama_segmented",
			"hint": "nowcoding_cGnama_hint",
			"quotaGrid": "nowcoding_cGnama_quotaGrid",
			"intro": "nowcoding_cGnama_intro",
			"section": "nowcoding_cGnama_section",
			"buttonPrimary": "nowcoding_cGnama_buttonPrimary",
			"checkbox": "nowcoding_cGnama_checkbox",
			"button": "nowcoding_cGnama_button",
			"segmentActive": "nowcoding_cGnama_segmentActive",
			"quotaBody": "nowcoding_cGnama_quotaBody",
			"meter": "nowcoding_cGnama_meter",
			"row": "nowcoding_cGnama_row",
			"segment": "nowcoding_cGnama_segment",
			"modelOwner": "nowcoding_cGnama_modelOwner",
			"modelId": "nowcoding_cGnama_modelId",
			"actions": "nowcoding_cGnama_actions",
			"card": "nowcoding_cGnama_card",
			"quotaLabel": "nowcoding_cGnama_quotaLabel",
			"title": "nowcoding_cGnama_title",
			"iconButton": "nowcoding_cGnama_iconButton",
			"quotaValue": "nowcoding_cGnama_quotaValue",
			"error": "nowcoding_cGnama_error",
			"badgeOff": "nowcoding_cGnama_badgeOff",
			"command": "nowcoding_cGnama_command",
			"cardIntro": "nowcoding_cGnama_cardIntro",
			"desc": "nowcoding_cGnama_desc",
			"modelRow": "nowcoding_cGnama_modelRow",
			"meterFill": "nowcoding_cGnama_meterFill",
			"input": "nowcoding_cGnama_input",
			"rowText": "nowcoding_cGnama_rowText",
			"modelList": "nowcoding_cGnama_modelList",
			"badgeOn": "nowcoding_cGnama_badgeOn"
		};
		//#endregion
		//#region src/client/NowCodingDetailPage.tsx
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
		const INITIAL_DRAFTS = {
			apiKey: "",
			baseURL: NOWCODING_DEFAULT_BASE_URL,
			fast: NOWCODING_SETTINGS_DEFAULTS.fast,
			fastServiceTier: NOWCODING_SETTINGS_DEFAULTS.fastServiceTier,
			quotaCard: NOWCODING_SETTINGS_DEFAULTS.quotaCard,
			visibleModels: NOWCODING_SETTINGS_DEFAULTS.visibleModels
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
				quotaCard: typeof view.quotaCard === "boolean" ? view.quotaCard : NOWCODING_SETTINGS_DEFAULTS.quotaCard,
				visibleModels: view.visibleModels ?? NOWCODING_SETTINGS_DEFAULTS.visibleModels
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
		/** Chinese copy for the sign-in failures a user can act on. */
		function loginMessageOf(error) {
			switch (error instanceof NowCodingApiError ? error.code : "") {
				case "bad-credentials": return "账号或密码不正确；站方也可能已封禁该账号。";
				case "two-factor-invalid": return "验证码不正确，请重新输入。";
				case "two-factor-unavailable": return "验证会话已过期，请重新输入账号密码登录。";
				case "turnstile-required": return "站方已开启 Turnstile 人机校验，插件无法完成这一步；请在控制台复制访问令牌后手动填入。";
				case "token-unavailable": return "登录成功，但站方没有返回登录会话或访问令牌；请在控制台的系统访问令牌页复制一个，手动填入下方。";
				case "unreachable":
				case "timeout":
				case "gateway-error": return "无法连接 NowCoding 控制台，请检查网络后重试。";
				default: return messageOf(error);
			}
		}
		/** Human-readable error copy for one route failure. */
		function messageOf(error) {
			if (error instanceof NowCodingApiError && error.code === "settings-conflict") return "设置已在其他窗口被修改，已重新载入；请再次保存。";
			return error instanceof Error ? error.message : String(error);
		}
		/** Chinese copy for the model-list failures a user can act on. */
		function modelListMessageOf(error) {
			switch (error instanceof NowCodingApiError ? error.code : "") {
				case "unauthorized": return "尚未配置 API Key：请先在上方保存一个 Key，再拉取模型列表。";
				case "unreachable":
				case "timeout":
				case "gateway-error": return "无法连接 NowCoding 网关，请检查网络后重试。";
				default: return messageOf(error);
			}
		}
		/**
		* Render the NowCoding detail page.
		* @returns the page element tree.
		*/
		function NowCodingDetailPage() {
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
			const [loginUsername, setLoginUsername] = (0, react.useState)("");
			const [loginPassword, setLoginPassword] = (0, react.useState)("");
			const [loginCode, setLoginCode] = (0, react.useState)("");
			const [loginChallenge, setLoginChallenge] = (0, react.useState)(false);
			const [loggingIn, setLoggingIn] = (0, react.useState)(false);
			const [loginError, setLoginError] = (0, react.useState)(null);
			const [loginNotice, setLoginNotice] = (0, react.useState)(null);
			const [modelList, setModelList] = (0, react.useState)(null);
			const [modelListLoading, setModelListLoading] = (0, react.useState)(false);
			const [modelListError, setModelListError] = (0, react.useState)(null);
			const [modelQuery, setModelQuery] = (0, react.useState)("");
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
			/** Adopt a finished sign-in: drop the password, re-read the document, refresh the balance. */
			const adoptSignIn = async (view) => {
				if (view.status !== "ok") return;
				setLoginPassword("");
				setLoginCode("");
				setLoginChallenge(false);
				const next = await getNowCodingSettings();
				setEnvelope(next);
				setDrafts(draftsOf(next));
				const sessionNote = view.tokenSource === void 0 ? "未读到访问令牌，订阅余量将通过登录会话读取。" : "";
				setLoginNotice(`已登录 ${view.username}（用户 ID ${view.userId}），登录会话与用户 ID 已写入配置。${sessionNote}`);
				refreshQuota();
				notifyNowCodingSettingsCommitted();
			};
			/** Exchange the account credentials for the console credential pair. */
			const signIn = async () => {
				setLoggingIn(true);
				setLoginError(null);
				setLoginNotice(null);
				try {
					const view = await panelLogin(loginUsername.trim(), loginPassword);
					if (view.status === "two-factor-required") {
						setLoginChallenge(true);
						setLoginPassword("");
						setLoginNotice("该账号开启了两步验证，请输入认证器应用中的验证码。");
						return;
					}
					await adoptSignIn(view);
				} catch (caught) {
					setLoginError(loginMessageOf(caught));
				} finally {
					setLoggingIn(false);
				}
			};
			/** Answer the challenge with the code the user typed. */
			const submitLoginCode = async () => {
				setLoggingIn(true);
				setLoginError(null);
				setLoginNotice(null);
				try {
					await adoptSignIn(await panelTwoFactorLogin(loginCode.trim()));
				} catch (caught) {
					setLoginError(loginMessageOf(caught));
				} finally {
					setLoggingIn(false);
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
				if (drafts.visibleModels.length === 0) ops.push({
					op: "unset",
					path: ["visibleModels"]
				});
				else ops.push({
					op: "set",
					path: ["visibleModels"],
					value: [...drafts.visibleModels]
				});
				applyOps(ops);
			};
			/** Read the key-scoped listing from the Host route. */
			const fetchModels = async () => {
				setModelListLoading(true);
				setModelListError(null);
				try {
					setModelList((await getModelList()).models);
				} catch (caught) {
					setModelListError(modelListMessageOf(caught));
				} finally {
					setModelListLoading(false);
				}
			};
			/** Check or uncheck one model in the allowlist draft. */
			const toggleModel = (id) => {
				const kept = drafts.visibleModels.includes(id) ? drafts.visibleModels.filter((candidate) => candidate !== id) : [...drafts.visibleModels, id];
				setDrafts({
					...drafts,
					visibleModels: kept
				});
			};
			/** Drop every drafted id the current listing no longer carries. */
			const cleanStaleModels = () => {
				if (modelList === null) return;
				const live = new Set(modelList.map((model) => model.id));
				setDrafts({
					...drafts,
					visibleModels: drafts.visibleModels.filter((id) => live.has(id))
				});
			};
			/** Clear the allowlist draft: the picker shows the whole catalog again. */
			const clearVisibleModels = () => {
				setDrafts({
					...drafts,
					visibleModels: []
				});
			};
			if (loading) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: NowCodingDetailPage_module_css_default.section,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: NowCodingDetailPage_module_css_default.hint,
					children: "正在加载 NowCoding 配置…"
				})
			});
			if (envelope === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: NowCodingDetailPage_module_css_default.section,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: NowCodingDetailPage_module_css_default.intro,
					children: "NowCoding 提供方的 API Key、端点与快速模式设置。"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: NowCodingDetailPage_module_css_default.error,
					role: "alert",
					children: error ?? "无法读取 NowCoding 配置。"
				})]
			});
			const configured = isNowCodingApiKeyConfigured(envelope);
			const panelSessionConfigured = isNowCodingPanelSessionConfigured(envelope);
			const disabled = envelope.writable === false || saving;
			const snapshot = quota === null ? null : quota.snapshot;
			const staleIds = modelList === null ? [] : drafts.visibleModels.filter((id) => !modelList.some((model) => model.id === id));
			const query = modelQuery.trim().toLowerCase();
			const filteredModels = modelList === null ? [] : modelList.filter((model) => query === "" || model.id.toLowerCase().includes(query));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: NowCodingDetailPage_module_css_default.section,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: NowCodingDetailPage_module_css_default.intro,
						children: "NowCoding 提供方的 API Key、端点，以及 GPT 快速模式与侧栏余量卡片的开关。保存后立即生效。"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: NowCodingDetailPage_module_css_default.card,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: NowCodingDetailPage_module_css_default.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: NowCodingDetailPage_module_css_default.rowText,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
										className: NowCodingDetailPage_module_css_default.title,
										htmlFor: "nowcoding-api-key",
										children: "API Key"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: NowCodingDetailPage_module_css_default.desc,
										children: "密钥不会回显；留空保存表示保持当前值，未配置时回退 Host 的 apiKeyEnv 环境变量。"
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: NowCodingDetailPage_module_css_default.control,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											id: "nowcoding-api-key",
											className: NowCodingDetailPage_module_css_default.input,
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
											className: NowCodingDetailPage_module_css_default.iconButton,
											"aria-label": showApiKey ? "隐藏 API Key" : "显示 API Key",
											title: showApiKey ? "隐藏 API Key" : "显示 API Key",
											disabled,
											onClick: () => {
												setShowApiKey((previous) => !previous);
											},
											children: showApiKey ? "隐藏" : "显示"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: configured ? NowCodingDetailPage_module_css_default.badgeOn : NowCodingDetailPage_module_css_default.badgeOff,
											children: configured ? "已配置" : "未配置"
										}),
										configured && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: NowCodingDetailPage_module_css_default.button,
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
								className: NowCodingDetailPage_module_css_default.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: NowCodingDetailPage_module_css_default.rowText,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
										className: NowCodingDetailPage_module_css_default.title,
										htmlFor: "nowcoding-base-url",
										children: "Base URL"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: NowCodingDetailPage_module_css_default.desc,
										children: [
											"端点基址，默认 ",
											NOWCODING_DEFAULT_BASE_URL,
											"；模型、余量与价格请求都基于它拼接。"
										]
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: NowCodingDetailPage_module_css_default.control,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										id: "nowcoding-base-url",
										className: NowCodingDetailPage_module_css_default.input,
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
								className: NowCodingDetailPage_module_css_default.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: NowCodingDetailPage_module_css_default.rowText,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: NowCodingDetailPage_module_css_default.title,
										children: "启用 GPT 快速模式（fast）"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: NowCodingDetailPage_module_css_default.desc,
										children: "开启后，具备快速档的模型会在请求里带上 service_tier。需要站方渠道开启 allow_service_tier 透传，否则该参数会被静默剥离；快速档计费高于标准档。"
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: NowCodingDetailPage_module_css_default.control,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										className: NowCodingDetailPage_module_css_default.checkbox,
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
								className: NowCodingDetailPage_module_css_default.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: NowCodingDetailPage_module_css_default.rowText,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: NowCodingDetailPage_module_css_default.title,
										children: "fast 的 wire 取值"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: NowCodingDetailPage_module_css_default.desc,
										children: "请求里 service_tier 的实际写法，只在快速模式开启时发送。"
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: NowCodingDetailPage_module_css_default.control,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: NowCodingDetailPage_module_css_default.segmented,
										role: "group",
										"aria-label": "fast 的 wire 取值",
										children: FAST_SERVICE_TIERS.map((tier) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: drafts.fastServiceTier === tier.value ? `${NowCodingDetailPage_module_css_default.segment} ${NowCodingDetailPage_module_css_default.segmentActive}` : NowCodingDetailPage_module_css_default.segment,
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
								className: NowCodingDetailPage_module_css_default.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: NowCodingDetailPage_module_css_default.rowText,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: NowCodingDetailPage_module_css_default.title,
										children: "在左侧栏显示余量卡片"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: NowCodingDetailPage_module_css_default.desc,
										children: "卡片位于左侧栏底部、设置入口上方，按固定间隔读取余量。"
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: NowCodingDetailPage_module_css_default.control,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										className: NowCodingDetailPage_module_css_default.checkbox,
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
						className: NowCodingDetailPage_module_css_default.card,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: NowCodingDetailPage_module_css_default.cardIntro,
								children: "模型白名单：勾选要保留的模型，模型选择器就只列出这些；一个都不勾选时显示全部目录模型。列表拉取自站方按当前 Key 返回的可用模型，保存后生效。"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: NowCodingDetailPage_module_css_default.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: NowCodingDetailPage_module_css_default.rowText,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: NowCodingDetailPage_module_css_default.title,
										children: "保留的模型"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: NowCodingDetailPage_module_css_default.desc,
										children: drafts.visibleModels.length === 0 ? "未勾选：模型选择器显示全部目录模型。" : `已保留 ${drafts.visibleModels.length} 个；保存后模型选择器只列出这些，下次打开选择器生效。`
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: NowCodingDetailPage_module_css_default.control,
									children: [
										staleIds.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											className: NowCodingDetailPage_module_css_default.button,
											disabled,
											onClick: cleanStaleModels,
											children: [
												"清理失效（",
												staleIds.length,
												"）"
											]
										}),
										drafts.visibleModels.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: NowCodingDetailPage_module_css_default.button,
											disabled,
											onClick: clearVisibleModels,
											children: "显示全部"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: NowCodingDetailPage_module_css_default.button,
											disabled: modelListLoading,
											onClick: () => {
												fetchModels();
											},
											children: modelListLoading ? "拉取中…" : modelList === null ? "拉取模型列表" : "重新拉取"
										})
									]
								})]
							}),
							modelListError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: NowCodingDetailPage_module_css_default.error,
								role: "alert",
								children: modelListError
							}),
							modelList !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: NowCodingDetailPage_module_css_default.row,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: NowCodingDetailPage_module_css_default.quotaBody,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: NowCodingDetailPage_module_css_default.input,
											type: "search",
											placeholder: "搜索模型 id…",
											"aria-label": "搜索模型",
											value: modelQuery,
											onChange: (event) => {
												setModelQuery(event.currentTarget.value);
											}
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: NowCodingDetailPage_module_css_default.modelList,
											children: [filteredModels.map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												className: NowCodingDetailPage_module_css_default.modelRow,
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
														type: "checkbox",
														className: NowCodingDetailPage_module_css_default.checkbox,
														checked: drafts.visibleModels.includes(model.id),
														onChange: () => {
															toggleModel(model.id);
														}
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: NowCodingDetailPage_module_css_default.modelId,
														children: model.id
													}),
													model.ownedBy !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: NowCodingDetailPage_module_css_default.modelOwner,
														children: model.ownedBy
													}),
													!model.known && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: NowCodingDetailPage_module_css_default.badgeOff,
														children: "目录外"
													})
												]
											}, model.id)), filteredModels.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: NowCodingDetailPage_module_css_default.hint,
												children: "没有匹配的模型。"
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
											className: NowCodingDetailPage_module_css_default.hint,
											children: [
												"站方为当前 Key 返回 ",
												modelList.length,
												" 个模型；标注「目录外」的模型可以勾选保存，但插件目录收录它之前不会出现在模型选择器里。"
											]
										})
									]
								})
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: NowCodingDetailPage_module_css_default.card,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: NowCodingDetailPage_module_css_default.cardIntro,
								children: "用 NowCoding 账号登录即可获取订阅（月卡）余量所需的控制台凭据（控制台接口不接受 sk- 开头的模型 Key）：密码只随这一次登录请求发出、不写入配置，登录会话与用户 ID 由 Host 直接写进配置、不回传浏览器，会话过期后重新登录一次即可。"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: NowCodingDetailPage_module_css_default.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: NowCodingDetailPage_module_css_default.rowText,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
										className: NowCodingDetailPage_module_css_default.title,
										htmlFor: "nowcoding-login-username",
										children: "账号"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: NowCodingDetailPage_module_css_default.desc,
										children: "站方控制台的用户名或邮箱。"
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: NowCodingDetailPage_module_css_default.control,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										id: "nowcoding-login-username",
										className: NowCodingDetailPage_module_css_default.input,
										type: "text",
										autoComplete: "username",
										value: loginUsername,
										disabled: disabled || loggingIn,
										onChange: (event) => {
											setLoginUsername(event.currentTarget.value);
										}
									})
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: NowCodingDetailPage_module_css_default.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: NowCodingDetailPage_module_css_default.rowText,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
										className: NowCodingDetailPage_module_css_default.title,
										htmlFor: "nowcoding-login-password",
										children: "密码"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: NowCodingDetailPage_module_css_default.desc,
										children: "只用于本次登录换取令牌；登录成功后即从页面清除。"
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: NowCodingDetailPage_module_css_default.control,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										id: "nowcoding-login-password",
										className: NowCodingDetailPage_module_css_default.input,
										type: "password",
										autoComplete: "current-password",
										value: loginPassword,
										disabled: disabled || loggingIn,
										onKeyDown: (event) => {
											if (event.key === "Enter") signIn();
										},
										onChange: (event) => {
											setLoginPassword(event.currentTarget.value);
										}
									})
								})]
							}),
							loginChallenge && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: NowCodingDetailPage_module_css_default.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: NowCodingDetailPage_module_css_default.rowText,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
										className: NowCodingDetailPage_module_css_default.title,
										htmlFor: "nowcoding-login-code",
										children: "两步验证码"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: NowCodingDetailPage_module_css_default.desc,
										children: "认证器应用的 6 位验证码，或一个 8 位备用码。"
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: NowCodingDetailPage_module_css_default.control,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										id: "nowcoding-login-code",
										className: NowCodingDetailPage_module_css_default.input,
										type: "text",
										inputMode: "numeric",
										autoComplete: "one-time-code",
										value: loginCode,
										disabled: disabled || loggingIn,
										onKeyDown: (event) => {
											if (event.key === "Enter") submitLoginCode();
										},
										onChange: (event) => {
											setLoginCode(event.currentTarget.value);
										}
									})
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: NowCodingDetailPage_module_css_default.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: NowCodingDetailPage_module_css_default.rowText,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: NowCodingDetailPage_module_css_default.title,
										children: "登录控制台"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: NowCodingDetailPage_module_css_default.desc,
										children: "登录成功后订阅余量与按量余额立即可读。站方若开启 Turnstile 人机校验，这一步在插件里无法完成。"
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: NowCodingDetailPage_module_css_default.control,
									children: [panelSessionConfigured && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: NowCodingDetailPage_module_css_default.badgeOn,
										children: "已保存会话"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: NowCodingDetailPage_module_css_default.buttonPrimary,
										disabled: disabled || loggingIn || (loginChallenge ? loginCode.trim() === "" : loginUsername.trim() === "" || loginPassword === ""),
										onClick: () => {
											loginChallenge ? submitLoginCode() : signIn();
										},
										children: loggingIn ? "登录中…" : loginChallenge ? "提交验证码" : "登录"
									})]
								})]
							}),
							loginError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: NowCodingDetailPage_module_css_default.error,
								role: "alert",
								children: loginError
							}),
							loginNotice !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: NowCodingDetailPage_module_css_default.notice,
								role: "status",
								children: loginNotice
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: NowCodingDetailPage_module_css_default.card,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: NowCodingDetailPage_module_css_default.row,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: NowCodingDetailPage_module_css_default.rowText,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: NowCodingDetailPage_module_css_default.title,
									children: "余量"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: NowCodingDetailPage_module_css_default.desc,
									children: "当前 API Key 的额度余额，读取自站方的计费接口。"
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: NowCodingDetailPage_module_css_default.control,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: NowCodingDetailPage_module_css_default.button,
									disabled: quotaLoading,
									onClick: () => {
										refreshQuota();
									},
									children: quotaLoading ? "刷新中…" : "刷新"
								})
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: NowCodingDetailPage_module_css_default.row,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: NowCodingDetailPage_module_css_default.quotaBody,
								children: [
									snapshot !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: NowCodingDetailPage_module_css_default.quotaGrid,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: NowCodingDetailPage_module_css_default.quotaLabel,
												children: "剩余"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: NowCodingDetailPage_module_css_default.quotaValue,
												children: snapshot.unlimited ? "不限额度" : formatMoney(snapshot.remaining, quota?.currency ?? "")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: NowCodingDetailPage_module_css_default.quotaLabel,
												children: "总额度"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: NowCodingDetailPage_module_css_default.quotaValue,
												children: snapshot.unlimited ? "不限额度" : formatMoney(snapshot.total, quota?.currency ?? "")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: NowCodingDetailPage_module_css_default.quotaLabel,
												children: "已用"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: NowCodingDetailPage_module_css_default.quotaValue,
												children: snapshot.unlimited ? "—" : formatMoney(snapshot.used, quota?.currency ?? "")
											}),
											snapshot.accessUntil > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: NowCodingDetailPage_module_css_default.quotaLabel,
												children: "额度到期"
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: NowCodingDetailPage_module_css_default.quotaValue,
												children: formatTimestamp(snapshot.accessUntil)
											})] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: NowCodingDetailPage_module_css_default.quotaLabel,
												children: "抓取时间"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: NowCodingDetailPage_module_css_default.quotaValue,
												children: formatTimestamp(snapshot.fetchedAt)
											})
										]
									}),
									quotaError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: NowCodingDetailPage_module_css_default.error,
										role: "alert",
										children: quotaError
									}),
									quotaError === null && snapshot === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: NowCodingDetailPage_module_css_default.hint,
										children: quotaLoading ? "正在读取余量…" : "尚未配置凭据：在上方保存一个 API Key 或用账号登录，或让 Host 的 apiKeyEnv 指向一个环境变量。"
									})
								]
							})
						})]
					}),
					error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: NowCodingDetailPage_module_css_default.error,
						role: "alert",
						children: error
					}),
					notice !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: NowCodingDetailPage_module_css_default.notice,
						role: "status",
						children: notice
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: NowCodingDetailPage_module_css_default.actions,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: NowCodingDetailPage_module_css_default.button,
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
							className: NowCodingDetailPage_module_css_default.buttonPrimary,
							disabled,
							onClick: save,
							children: saving ? "保存中…" : "保存"
						})]
					})
				]
			});
		}
		//#endregion
		//#region src/client/package.ts
		/**
		* The bundle's package identity, shared by the Plugins-page seat key and the
		* update face. One home because two spellings would desynchronize the seat
		* the Plugins page dispatches by from the package the update API queries.
		*
		* @module @elves-ai/dsh-llm-nowcoding/client/package
		*/
		/** The package name the Loader row, the `plugins.bundle.config` key, and the update API all carry. */
		const NOWCODING_PACKAGE_NAME = "@elves-ai/dsh-llm-nowcoding";
		//#endregion
		//#region src/client/index.tsx
		/** Required services before mounting. */
		const inject = ["slots"];
		/**
		* Register the sidebar balance card and the NowCoding detail page.
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
			ctx.slots.inject("plugins.bundle.config", () => {
				ctx.slots.register({
					name: "plugins.bundle.config",
					key: NOWCODING_PACKAGE_NAME
				}, (owner) => {
					if (owner?.view === "summary") return null;
					return NowCodingDetailPage();
				});
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map