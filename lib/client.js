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
		* Sign in with the account's NowCoding console credentials.
		*
		* The password rides this one request and is stored by neither half: the Host
		* exchanges it for the dashboard token it writes into the settings slot, and
		* the token never rides an answer back.
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
				...typeof value.panelUserId === "string" ? { panelUserId: value.panelUserId } : {}
			};
		}
		/** True when the write-only `apiKey` slot currently holds a value. */
		function isNowCodingApiKeyConfigured(envelope) {
			return secretSet(envelope, "apiKey");
		}
		/**
		* True when the write-only `panelToken` slot currently holds a value.
		* @param envelope - a settings envelope.
		* @returns whether a dashboard token is stored.
		*/
		function isNowCodingPanelTokenConfigured(envelope) {
			return secretSet(envelope, "panelToken");
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
			"summary": "nowcoding_G1rn4q_summary",
			"total": "nowcoding_G1rn4q_total",
			"detail": "nowcoding_G1rn4q_detail",
			"track": "nowcoding_G1rn4q_track",
			"fill": "nowcoding_G1rn4q_fill",
			"card": "nowcoding_G1rn4q_card",
			"row": "nowcoding_G1rn4q_row",
			"retry": "nowcoding_G1rn4q_retry"
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
			panelUserId: ""
		};
		//#endregion
		//#region \0dsh-css:/Users/lingyun/mywork/dsh-llm-nowcoding/src/client/NowCodingDetailPage.module.css.mjs
		const css = ".nowcoding_cGnama_section{flex-direction:column;gap:14px;display:flex}.nowcoding_cGnama_intro{color:var(--dsw-text-secondary,#9a9aa8);margin:0;font-size:13px;line-height:1.55}.nowcoding_cGnama_cardIntro{color:var(--dsw-text-secondary,#9a9aa8);margin:0;padding:12px 16px 0;font-size:12px;line-height:1.5}.nowcoding_cGnama_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:16px;flex-direction:column;display:flex;overflow:hidden}.nowcoding_cGnama_row{justify-content:space-between;align-items:center;gap:20px;padding:14px 16px;display:flex}.nowcoding_cGnama_row+.nowcoding_cGnama_row{border-top:1px solid var(--dsw-line-secondary,#2a2a35)}.nowcoding_cGnama_rowText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.nowcoding_cGnama_title{color:var(--dsw-text-primary,#f2f2f5);font-size:14px;font-weight:600}.nowcoding_cGnama_desc{color:var(--dsw-text-secondary,#9a9aa8);font-size:12px;line-height:1.5}.nowcoding_cGnama_control{justify-content:flex-end;align-items:center;gap:8px;min-width:260px;display:flex}.nowcoding_cGnama_input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2,#0000002e);min-width:0;height:28px;color:var(--dsw-text-primary,#f2f2f5);border-radius:8px;flex:1;padding:0 10px;font-size:13px}.nowcoding_cGnama_input:disabled{opacity:.6}.nowcoding_cGnama_button,.nowcoding_cGnama_buttonPrimary,.nowcoding_cGnama_iconButton{border:1px solid var(--dsw-alias-border-l2);height:28px;color:var(--dsw-text-primary,#f2f2f5);cursor:pointer;background:0 0;border-radius:999px;flex:none;padding:0 12px;font-size:12px}.nowcoding_cGnama_buttonPrimary{background:var(--dsw-brand,#4f7cff);color:#fff;border-color:#0000}.nowcoding_cGnama_button:disabled,.nowcoding_cGnama_buttonPrimary:disabled,.nowcoding_cGnama_iconButton:disabled{opacity:.5;cursor:default}.nowcoding_cGnama_checkbox{width:16px;height:16px;accent-color:var(--dsw-brand,#4f7cff)}.nowcoding_cGnama_segmented{align-items:center;gap:6px;display:inline-flex}.nowcoding_cGnama_segment{border:1px solid var(--dsw-alias-border-l2);height:28px;color:var(--dsw-text-secondary,#9a9aa8);font-variant-numeric:tabular-nums;cursor:pointer;background:0 0;border-radius:999px;padding:0 12px;font-size:12px}.nowcoding_cGnama_segmentActive{background:var(--dsw-brand,#4f7cff);color:#fff;border-color:#0000}.nowcoding_cGnama_badgeOn,.nowcoding_cGnama_badgeOff{border-radius:999px;flex:none;padding:5px 8px;font-size:11px;line-height:1}.nowcoding_cGnama_badgeOn{color:#6fe3b2;background:#6fe3b21f}.nowcoding_cGnama_badgeOff{color:#9a9aa8;background:#9a9aa81f}.nowcoding_cGnama_quotaBody{flex-direction:column;flex:1;gap:8px;min-width:0;display:flex}.nowcoding_cGnama_quotaGrid{grid-template-columns:auto 1fr;align-items:baseline;gap:6px 16px;display:grid}.nowcoding_cGnama_quotaLabel{color:var(--dsw-text-secondary,#9a9aa8);font-size:12px}.nowcoding_cGnama_quotaValue{color:var(--dsw-text-primary,#f2f2f5);font-variant-numeric:tabular-nums;font-size:13px}.nowcoding_cGnama_error{color:#f2a1a1;margin:0;font-size:12px;line-height:1.5}.nowcoding_cGnama_notice{color:#6fe3b2;margin:0;font-size:12px;line-height:1.5}.nowcoding_cGnama_hint{color:var(--dsw-text-secondary,#9a9aa8);margin:0;font-size:12px;line-height:1.5}.nowcoding_cGnama_actions{justify-content:flex-end;gap:8px;display:flex}.nowcoding_cGnama_meter{background:var(--dsw-line-secondary,#2a2a35);border-radius:3px;height:6px;display:block;overflow:hidden}.nowcoding_cGnama_meterFill{background:var(--dsw-brand,#4f7cff);border-radius:3px;height:100%;transition:width .4s;display:block}.nowcoding_cGnama_command{background:var(--dsw-alias-bg-layer-2,#1b1b24);color:var(--dsw-text-primary,#f2f2f5);border-radius:6px;align-self:flex-start;margin:2px 0 0;padding:3px 8px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px}";
		const tagId = "@elves-ai/dsh-llm-nowcoding/NowCodingDetailPage.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@elves-ai/dsh-llm-nowcoding";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var NowCodingDetailPage_module_css_default = {
			"button": "nowcoding_cGnama_button",
			"title": "nowcoding_cGnama_title",
			"meterFill": "nowcoding_cGnama_meterFill",
			"row": "nowcoding_cGnama_row",
			"buttonPrimary": "nowcoding_cGnama_buttonPrimary",
			"input": "nowcoding_cGnama_input",
			"badgeOff": "nowcoding_cGnama_badgeOff",
			"card": "nowcoding_cGnama_card",
			"quotaBody": "nowcoding_cGnama_quotaBody",
			"desc": "nowcoding_cGnama_desc",
			"intro": "nowcoding_cGnama_intro",
			"quotaValue": "nowcoding_cGnama_quotaValue",
			"notice": "nowcoding_cGnama_notice",
			"segmented": "nowcoding_cGnama_segmented",
			"segment": "nowcoding_cGnama_segment",
			"rowText": "nowcoding_cGnama_rowText",
			"checkbox": "nowcoding_cGnama_checkbox",
			"segmentActive": "nowcoding_cGnama_segmentActive",
			"command": "nowcoding_cGnama_command",
			"hint": "nowcoding_cGnama_hint",
			"quotaGrid": "nowcoding_cGnama_quotaGrid",
			"iconButton": "nowcoding_cGnama_iconButton",
			"meter": "nowcoding_cGnama_meter",
			"control": "nowcoding_cGnama_control",
			"cardIntro": "nowcoding_cGnama_cardIntro",
			"actions": "nowcoding_cGnama_actions",
			"error": "nowcoding_cGnama_error",
			"section": "nowcoding_cGnama_section",
			"quotaLabel": "nowcoding_cGnama_quotaLabel",
			"badgeOn": "nowcoding_cGnama_badgeOn"
		};
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
		//#region src/client/market-update.ts
		/**
		* Browser wire face for dsh-market's public plugin update API v1
		* (`/dsh-market/api/v1`), the contract that project documents in its
		* `UPDATE-API-V1.md`: capability discovery, a single-package update check,
		* mutation start, operation polling, and the restart delegate.
		*
		* The detail page never spawns a package manager of its own. The market's
		* Host plane owns the install algorithm, and when its discovery is absent
		* this feature degrades to a manual-command hint rather than poking the
		* market's legacy routes.
		*
		* This speaks dsh-market's envelope — a `schema` field on answers and bare
		* `{ error }` failures — NOT the plugin's fenced-route envelope owned by
		* `./api.ts`. Every read is structural: these shapes are another project's
		* contract and are parsed defensively rather than trusted.
		*
		* @module @elves-ai/dsh-llm-nowcoding/client/market-update
		*/
		/** Root of the public update API the market serves beside its own UI. */
		const API_ROOT = "/dsh-market/api/v1";
		/** Schema string every v1 answer carries; a mismatch means a foreign route. */
		const SCHEMA = "dsh-market/update-api/v1";
		/** An error reading the update API, carrying the stable code when one exists. */
		var MarketUpdateApiError = class extends Error {
			code;
			status;
			retryable;
			constructor(code, status, message, retryable = false) {
				super(message);
				this.code = code;
				this.status = status;
				this.retryable = retryable;
			}
		};
		/**
		* Build the update face over one transport.
		* @param fetchImpl - transport seam; the page uses the default instance.
		* @returns the update face.
		*/
		function createMarketUpdateClient(fetchImpl = globalThis.fetch) {
			const readError = async (status, response) => {
				let message = `dsh-market 更新接口返回 HTTP ${String(status)}`;
				let code = status === 404 ? "PLUGIN_NOT_INSTALLED" : status === 403 ? "UPDATE_FORBIDDEN" : "UPDATE_FAILED";
				let retryable = false;
				try {
					const body = await response.json();
					if (body !== null && typeof body === "object") {
						const record = body;
						if (typeof record.error === "string" && record.error.trim() !== "") message = record.error.trim();
						const failure = record.failure;
						if (failure !== null && typeof failure === "object") {
							const shaped = failure;
							if (typeof shaped.code === "string" && shaped.code !== "") code = shaped.code;
							if (typeof shaped.message === "string" && shaped.message.trim() !== "") message = shaped.message.trim();
							retryable = shaped.retryable === true;
						}
					}
				} catch {}
				return new MarketUpdateApiError(code, status, message, retryable);
			};
			const getJson = async (path) => {
				let response;
				try {
					response = await fetchImpl(path, { method: "GET" });
				} catch (error) {
					throw new MarketUpdateApiError("MARKET_UNREACHABLE", 0, error instanceof Error ? error.message : String(error));
				}
				if (!response.ok) throw await readError(response.status, response);
				try {
					const body = await response.json();
					return body !== null && typeof body === "object" && !Array.isArray(body) ? body : {};
				} catch {
					throw new MarketUpdateApiError("UPDATE_FAILED", response.status, "dsh-market 更新接口返回了无法解析的响应体");
				}
			};
			const text = (value) => typeof value === "string" && value.trim() !== "" ? value.trim() : null;
			const operationOf = (value) => {
				const op = value !== null && typeof value === "object" ? value : {};
				const progress = op.progress !== null && typeof op.progress === "object" ? op.progress : {};
				const outcome = op.outcome !== null && typeof op.outcome === "object" ? op.outcome : {};
				const rollback = outcome.rollback !== null && typeof outcome.rollback === "object" ? outcome.rollback : {};
				const failureRaw = op.failure !== null && typeof op.failure === "object" ? op.failure : null;
				return {
					operationId: text(op.operationId) ?? "",
					state: text(op.state) ?? "unknown",
					beforeVersion: text(op.beforeVersion),
					installedVersion: text(op.installedVersion),
					percent: typeof progress.percent === "number" ? progress.percent : null,
					phase: text(progress.phase),
					detail: text(progress.detail),
					refreshRequired: outcome.refreshRequired === true,
					restartRequired: outcome.restartRequired === true,
					rollbackAvailable: rollback.available === true,
					failure: failureRaw === null ? null : {
						code: text(failureRaw.code) ?? "UPDATE_FAILED",
						message: text(failureRaw.message) ?? "更新失败，原因未知。",
						retryable: failureRaw.retryable === true
					}
				};
			};
			return {
				async discover() {
					let body;
					try {
						body = await getJson(`${API_ROOT}/capabilities`);
					} catch {
						return null;
					}
					if (body.schema !== SCHEMA) return null;
					const features = body.features !== null && typeof body.features === "object" ? body.features : {};
					const restart = body.restart !== null && typeof body.restart === "object" ? body.restart : {};
					return {
						marketVersion: text(body.marketVersion),
						runtime: text(body.runtime),
						canCheck: features.check === true,
						canUpdate: features.update === true,
						canRestart: restart.supported === true
					};
				},
				async check(force = false) {
					const query = new URLSearchParams({ name: NOWCODING_PACKAGE_NAME });
					if (force) query.set("force", "1");
					const body = await getJson(`${API_ROOT}/updates?${query.toString()}`);
					if (body.schema !== SCHEMA) throw new MarketUpdateApiError("UPDATE_FAILED", 200, "dsh-market 更新接口返回了不认识的响应");
					const pkg = body.package !== null && typeof body.package === "object" ? body.package : {};
					return {
						source: text(pkg.source),
						installedVersion: text(pkg.installedVersion),
						latestVersion: text(pkg.latestVersion),
						updateAvailable: pkg.updateAvailable === true
					};
				},
				async start(force = false) {
					let response;
					const payload = JSON.stringify({
						packageName: NOWCODING_PACKAGE_NAME,
						...force ? { force: true } : {}
					});
					try {
						response = await fetchImpl(`${API_ROOT}/updates`, {
							method: "POST",
							headers: { "content-type": "application/json" },
							body: payload
						});
					} catch (error) {
						throw new MarketUpdateApiError("MARKET_UNREACHABLE", 0, error instanceof Error ? error.message : String(error));
					}
					if (!response.ok) throw await readError(response.status, response);
					const body = await response.json();
					return operationOf(body !== null && typeof body === "object" ? body.operation : null);
				},
				async poll(operationId) {
					const body = await getJson(`${API_ROOT}/operations?operationId=${encodeURIComponent(operationId)}`);
					if (body.schema !== SCHEMA) throw new MarketUpdateApiError("UPDATE_FAILED", 200, "dsh-market 更新接口返回了不认识的响应");
					return operationOf(body.operation);
				},
				async restart() {
					let response;
					try {
						response = await fetchImpl(`${API_ROOT}/restart`, {
							method: "POST",
							headers: { "content-type": "application/json" },
							body: "{}"
						});
					} catch {
						return;
					}
					if (!response.ok) throw await readError(response.status, response);
				}
			};
		}
		/** The instance the detail page renders from. */
		const marketUpdate = createMarketUpdateClient();
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
		* switch, the console sign-in, a quota block with an explicit refresh, and an
		* update card that drives this plugin's own update through dsh-market's
		* public update API (`./market-update.ts`).
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
			panelUserId: "",
			panelToken: ""
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
				panelUserId: view.panelUserId ?? "",
				panelToken: ""
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
				case "token-unavailable": return "登录成功，但站方没有回读访问令牌；请在控制台的系统访问令牌页复制一个，手动填入下方。";
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
		/** Stable update-failure codes whose fix is a force retry, per the market's contract. */
		const FORCEABLE_UPDATE_CODES = /* @__PURE__ */ new Set(["RELEASE_TOO_FRESH", "VERSION_UNCHANGED"]);
		/** Poll cadence and patience for one running update operation. */
		const UPDATE_POLL_INTERVAL_MS = 1500;
		const UPDATE_POLL_MAX_FAILURES = 3;
		const UPDATE_POLL_MAX_MS = 6e5;
		/** Chinese copy for one update failure, by the market's stable codes. */
		function updateFailureText(failure) {
			switch (failure.code) {
				case "OPERATION_BUSY": return "市场正在执行另一个安装或更新操作，请稍后重试。";
				case "AGENTS_RUNNING": return "有会话正在运行，市场暂缓了这次更新；请稍后重试。";
				case "RELEASE_TOO_FRESH": return "新版本发布时间太近，市场按发布冷却策略暂缓安装；可稍后重试，或用强制更新跳过等待。";
				case "VERSION_UNCHANGED": return "更新源没有发现新的版本；如果确要重装，可使用强制更新。";
				case "UPDATE_TIMEOUT": return "更新操作超时，请重试。";
				case "RESOLVED_VERSION_MISMATCH": return "实际安装的版本低于预期目标（源或镜像尚未同步），市场已回滚；请稍后重试。";
				case "DOWNGRADE_DETECTED": return "目标版本比当前已安装的更旧，市场拒绝了这次更新。";
				case "UPDATE_FORBIDDEN": return "当前环境不允许执行这次更新。";
				case "PLUGIN_NOT_INSTALLED": return "插件不在当前 profile 的安装清单里，无法通过市场更新。";
				case "MARKET_UNREACHABLE": return "无法连接 dsh-market 的更新接口，请稍后重试。";
				case "OPERATION_LOST": return "更新操作记录已不存在（Host 可能重启过）；请用「检查更新」确认当前版本。";
				default: return failure.message;
			}
		}
		/** Normalize any thrown value into the failure shape the card renders. */
		function updateFailureOf(error) {
			if (error instanceof MarketUpdateApiError) return {
				code: error.code,
				message: error.message,
				retryable: error.retryable
			};
			return {
				code: "UPDATE_FAILED",
				message: error instanceof Error ? error.message : String(error),
				retryable: false
			};
		}
		/** Label for the install source a check reports. */
		function updateSourceLabel(source) {
			if (source === "github") return "GitHub";
			if (source === "npm") return "npm";
			return source ?? "";
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
			const [showPanelToken, setShowPanelToken] = (0, react.useState)(false);
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
				const rotated = view.tokenSource === "generated" ? "站方本次新签发了一个访问令牌。" : "";
				setLoginNotice(`已登录 ${view.username}（用户 ID ${view.userId}），面板令牌与用户 ID 已写入配置。${rotated}`);
				refreshQuota();
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
				const panelUserId = drafts.panelUserId.trim();
				if (panelUserId === "") ops.push({
					op: "unset",
					path: ["panelUserId"]
				});
				else ops.push({
					op: "set",
					path: ["panelUserId"],
					value: panelUserId
				});
				const panelToken = drafts.panelToken.trim();
				if (panelToken !== "") ops.push({
					op: "set",
					path: ["panelToken"],
					value: panelToken
				});
				applyOps(ops);
			};
			const [updateCapsState, setUpdateCapsState] = (0, react.useState)("loading");
			const [updateCaps, setUpdateCaps] = (0, react.useState)(null);
			const [updateCheck, setUpdateCheck] = (0, react.useState)(null);
			const [updateChecking, setUpdateChecking] = (0, react.useState)(false);
			const [updateCheckError, setUpdateCheckError] = (0, react.useState)(null);
			const [updateOp, setUpdateOp] = (0, react.useState)(null);
			const [updateError, setUpdateError] = (0, react.useState)(null);
			const [updateNotice, setUpdateNotice] = (0, react.useState)(null);
			const [restarting, setRestarting] = (0, react.useState)(false);
			const updatePollFailures = (0, react.useRef)(0);
			const updateStartedAt = (0, react.useRef)(0);
			const refreshUpdateCheck = (0, react.useCallback)(async (force) => {
				setUpdateChecking(true);
				setUpdateCheckError(null);
				try {
					setUpdateCheck(await marketUpdate.check(force));
				} catch (caught) {
					setUpdateCheck(null);
					setUpdateCheckError(updateFailureOf(caught));
				} finally {
					setUpdateChecking(false);
				}
			}, []);
			(0, react.useEffect)(() => {
				let cancelled = false;
				marketUpdate.discover().then((caps) => {
					if (cancelled) return;
					if (caps === null || !caps.canCheck) {
						setUpdateCapsState("absent");
						return;
					}
					setUpdateCaps(caps);
					setUpdateCapsState("ready");
					refreshUpdateCheck(false);
				});
				return () => {
					cancelled = true;
				};
			}, [refreshUpdateCheck]);
			(0, react.useEffect)(() => {
				if (updateOp === null || updateOp.state !== "queued" && updateOp.state !== "running") return;
				if (Date.now() - updateStartedAt.current > UPDATE_POLL_MAX_MS) {
					setUpdateOp(null);
					setUpdateNotice("更新操作耗时较长，页面停止等待；稍后可用「检查更新」确认结果。");
					return;
				}
				const timer = window.setTimeout(() => {
					marketUpdate.poll(updateOp.operationId).then((next) => {
						updatePollFailures.current = 0;
						setUpdateOp(next);
					}).catch((caught) => {
						updatePollFailures.current += 1;
						if (updatePollFailures.current >= UPDATE_POLL_MAX_FAILURES) {
							setUpdateError(updateFailureOf(caught));
							setUpdateOp(null);
						}
					});
				}, UPDATE_POLL_INTERVAL_MS);
				return () => {
					window.clearTimeout(timer);
				};
			}, [updateOp]);
			const startUpdate = async (force) => {
				setUpdateError(null);
				setUpdateNotice(null);
				setUpdateCheckError(null);
				updatePollFailures.current = 0;
				updateStartedAt.current = Date.now();
				try {
					setUpdateOp(await marketUpdate.start(force));
				} catch (caught) {
					setUpdateError(updateFailureOf(caught));
				}
			};
			const restartHost = async () => {
				setRestarting(true);
				setUpdateError(null);
				try {
					await marketUpdate.restart();
				} catch (caught) {
					setRestarting(false);
					setUpdateError(updateFailureOf(caught));
					return;
				}
				window.setTimeout(() => {
					window.location.reload();
				}, 2500);
			};
			const backToCheck = () => {
				setUpdateOp(null);
				setUpdateError(null);
				setUpdateNotice(null);
				refreshUpdateCheck(true);
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
			const panelConfigured = isNowCodingPanelTokenConfigured(envelope);
			const disabled = envelope.writable === false || saving;
			const snapshot = quota === null ? null : quota.snapshot;
			/** The operation view: progress while running, outcome and next steps after. */
			const renderUpdateOperation = (op) => {
				if (op.state === "queued" || op.state === "running") {
					const percent = op.percent === null ? null : Math.min(100, Math.max(4, Math.round(op.percent)));
					return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: NowCodingDetailPage_module_css_default.row,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: NowCodingDetailPage_module_css_default.rowText,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: NowCodingDetailPage_module_css_default.title,
									children: ["正在更新", op.installedVersion !== null && op.installedVersion !== op.beforeVersion ? `：${op.beforeVersion ?? "…"} → ${op.installedVersion}` : "…"]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: NowCodingDetailPage_module_css_default.desc,
									children: [
										op.phase ?? "准备中",
										percent === null ? null : `${String(percent)}%`,
										op.detail
									].filter(Boolean).join(" · ")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: NowCodingDetailPage_module_css_default.meter,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: NowCodingDetailPage_module_css_default.meterFill,
										style: { width: percent === null ? "40%" : `${String(percent)}%` }
									})
								})
							]
						})
					});
				}
				if (op.state === "succeeded") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: NowCodingDetailPage_module_css_default.row,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: NowCodingDetailPage_module_css_default.rowText,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: NowCodingDetailPage_module_css_default.title,
							children: ["已更新", op.installedVersion !== null ? `到 ${op.installedVersion}` : ""]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: NowCodingDetailPage_module_css_default.desc,
							children: op.refreshRequired ? "浏览器需要重新加载才能运行新版本。" : op.restartRequired ? "Host 需要重启才能加载新版本。" : "更新完成。"
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: NowCodingDetailPage_module_css_default.control,
						children: [
							op.restartRequired && !(updateCaps?.canRestart ?? false) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: NowCodingDetailPage_module_css_default.hint,
								children: "请手动重启 dsh web。"
							}),
							op.restartRequired && (updateCaps?.canRestart ?? false) && !restarting && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: NowCodingDetailPage_module_css_default.buttonPrimary,
								onClick: () => {
									restartHost();
								},
								children: "重启 Host"
							}),
							op.refreshRequired && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: NowCodingDetailPage_module_css_default.buttonPrimary,
								onClick: () => {
									window.location.reload();
								},
								children: "刷新页面"
							}),
							!op.refreshRequired && !op.restartRequired && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: NowCodingDetailPage_module_css_default.button,
								onClick: backToCheck,
								children: "检查更新"
							})
						]
					})]
				});
				if (op.state === "failed") {
					const failure = op.failure ?? {
						code: "UPDATE_FAILED",
						message: "更新失败，原因未知。",
						retryable: false
					};
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: NowCodingDetailPage_module_css_default.row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: NowCodingDetailPage_module_css_default.rowText,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: NowCodingDetailPage_module_css_default.title,
								children: "更新失败"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: NowCodingDetailPage_module_css_default.error,
								role: "alert",
								children: updateFailureText(failure)
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: NowCodingDetailPage_module_css_default.control,
							children: [
								failure.retryable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: NowCodingDetailPage_module_css_default.button,
									onClick: () => {
										startUpdate(false);
									},
									children: "重试"
								}),
								FORCEABLE_UPDATE_CODES.has(failure.code) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: NowCodingDetailPage_module_css_default.button,
									onClick: () => {
										startUpdate(true);
									},
									children: "强制更新"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: NowCodingDetailPage_module_css_default.button,
									onClick: backToCheck,
									children: "返回"
								})
							]
						})]
					});
				}
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: NowCodingDetailPage_module_css_default.row,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: NowCodingDetailPage_module_css_default.rowText,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: NowCodingDetailPage_module_css_default.title,
							children: op.state === "cancelled" ? "更新已取消" : "已回滚"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: NowCodingDetailPage_module_css_default.desc,
							children: op.state === "cancelled" ? "这次更新没有完成。" : "已恢复到更新前的版本。"
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: NowCodingDetailPage_module_css_default.control,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: NowCodingDetailPage_module_css_default.button,
							onClick: backToCheck,
							children: "返回"
						})
					})]
				});
			};
			/** The check view: current version, and the update action when one exists. */
			const renderUpdateCheckView = () => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: NowCodingDetailPage_module_css_default.row,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: NowCodingDetailPage_module_css_default.rowText,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: NowCodingDetailPage_module_css_default.title,
							children: "插件更新"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: NowCodingDetailPage_module_css_default.desc,
							children: [
								"当前版本 ",
								updateCheck?.installedVersion ?? "未知",
								updateCheck !== null && updateSourceLabel(updateCheck.source) !== "" ? ` · 来源 ${updateSourceLabel(updateCheck.source)}` : ""
							]
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: NowCodingDetailPage_module_css_default.control,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: NowCodingDetailPage_module_css_default.button,
							disabled: updateChecking,
							onClick: () => {
								refreshUpdateCheck(true);
							},
							children: updateChecking ? "检查中…" : "检查更新"
						})
					})]
				}),
				(updateCheckError !== null || (updateCheck?.updateAvailable ?? false)) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: NowCodingDetailPage_module_css_default.row,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: NowCodingDetailPage_module_css_default.rowText,
						children: [updateCheckError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: NowCodingDetailPage_module_css_default.error,
							role: "alert",
							children: updateFailureText(updateCheckError)
						}), updateCheckError === null && updateCheck !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: NowCodingDetailPage_module_css_default.desc,
							children: [
								"有可用更新：",
								updateCheck.installedVersion ?? "未知",
								" → ",
								updateCheck.latestVersion ?? "未知"
							]
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: NowCodingDetailPage_module_css_default.control,
						children: [updateCheckError === null && updateCheck !== null && (updateCaps?.canUpdate ?? false) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: NowCodingDetailPage_module_css_default.buttonPrimary,
							onClick: () => {
								startUpdate(false);
							},
							children: "更新"
						}), updateCheckError === null && updateCheck !== null && !(updateCaps?.canUpdate ?? false) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: NowCodingDetailPage_module_css_default.hint,
							children: "当前 dsh-market 版本不提供更新操作。"
						})]
					})]
				}),
				updateError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: NowCodingDetailPage_module_css_default.row,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: NowCodingDetailPage_module_css_default.error,
						role: "alert",
						children: updateFailureText(updateError)
					})
				})
			] });
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
								children: "订阅（月卡）余量需要控制台凭据：控制台接口不接受 sk- 开头的模型 Key。用下面的账号登录会自动填入这两项，也可以手动填写；两项都留空时，卡片显示按量余额。"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: NowCodingDetailPage_module_css_default.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: NowCodingDetailPage_module_css_default.rowText,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
										className: NowCodingDetailPage_module_css_default.title,
										htmlFor: "nowcoding-panel-user",
										children: "面板用户 ID"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: NowCodingDetailPage_module_css_default.desc,
										children: "控制台里的数字用户 ID，连同面板令牌一起作为 New-Api-User 头发送。"
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: NowCodingDetailPage_module_css_default.control,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										id: "nowcoding-panel-user",
										className: NowCodingDetailPage_module_css_default.input,
										type: "text",
										autoComplete: "off",
										value: drafts.panelUserId,
										placeholder: "例如 8893",
										disabled,
										onChange: (event) => {
											setDrafts({
												...drafts,
												panelUserId: event.currentTarget.value
											});
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
										htmlFor: "nowcoding-panel-token",
										children: "面板访问令牌"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: NowCodingDetailPage_module_css_default.desc,
										children: "在控制台的系统访问令牌页生成。读取订阅额度时用它，不会回显；留空保存表示保持当前值。"
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: NowCodingDetailPage_module_css_default.control,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											id: "nowcoding-panel-token",
											className: NowCodingDetailPage_module_css_default.input,
											type: showPanelToken ? "text" : "password",
											autoComplete: "off",
											value: drafts.panelToken,
											placeholder: panelConfigured ? "已配置（留空保持不变）" : "未配置",
											disabled,
											onChange: (event) => {
												setDrafts({
													...drafts,
													panelToken: event.currentTarget.value
												});
											}
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: NowCodingDetailPage_module_css_default.iconButton,
											"aria-label": showPanelToken ? "隐藏面板访问令牌" : "显示面板访问令牌",
											title: showPanelToken ? "隐藏面板访问令牌" : "显示面板访问令牌",
											disabled,
											onClick: () => {
												setShowPanelToken((previous) => !previous);
											},
											children: showPanelToken ? "隐藏" : "显示"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: panelConfigured ? NowCodingDetailPage_module_css_default.badgeOn : NowCodingDetailPage_module_css_default.badgeOff,
											children: panelConfigured ? "已配置" : "未配置"
										}),
										panelConfigured && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: NowCodingDetailPage_module_css_default.button,
											disabled,
											onClick: () => {
												applyOps([{
													op: "unset",
													path: ["panelToken"]
												}]);
											},
											children: "清除"
										})
									]
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: NowCodingDetailPage_module_css_default.card,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: NowCodingDetailPage_module_css_default.cardIntro,
								children: "用 NowCoding 账号登录，自动获取上面的控制台凭据：密码只随这一次登录请求发出、不写入配置，换到的访问令牌由 Host 直接写进配置、不回传浏览器。"
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
										children: "获取面板凭据"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: NowCodingDetailPage_module_css_default.desc,
										children: "登录成功后订阅余量与按量余额立即可读。站方若开启 Turnstile 人机校验，这一步在插件里无法完成，请改用手动填写。"
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: NowCodingDetailPage_module_css_default.control,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: NowCodingDetailPage_module_css_default.buttonPrimary,
										disabled: disabled || loggingIn || (loginChallenge ? loginCode.trim() === "" : loginUsername.trim() === "" || loginPassword === ""),
										onClick: () => {
											loginChallenge ? submitLoginCode() : signIn();
										},
										children: loggingIn ? "登录中…" : loginChallenge ? "提交验证码" : "登录"
									})
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
										children: quotaLoading ? "正在读取余量…" : "尚未配置 API Key：先在上方保存一个密钥，或让 Host 的 apiKeyEnv 指向一个环境变量。"
									})
								]
							})
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: NowCodingDetailPage_module_css_default.card,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: NowCodingDetailPage_module_css_default.cardIntro,
								children: "插件更新经由 dsh-market 插件市场的公开更新接口完成：检查、下载与安装都在市场一侧执行；更新后按提示刷新页面或重启 Host。"
							}),
							updateCapsState === "loading" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: NowCodingDetailPage_module_css_default.row,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: NowCodingDetailPage_module_css_default.hint,
									children: "正在检测 dsh-market 插件市场…"
								})
							}),
							updateCapsState === "absent" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: NowCodingDetailPage_module_css_default.row,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: NowCodingDetailPage_module_css_default.rowText,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: NowCodingDetailPage_module_css_default.title,
											children: "页面内更新不可用"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: NowCodingDetailPage_module_css_default.desc,
											children: "未检测到 dsh-market 插件市场，或其版本不提供更新接口。可在终端手动更新："
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("code", {
											className: NowCodingDetailPage_module_css_default.command,
											children: ["dsh plugin --profile <profile> update ", "@elves-ai/dsh-llm-nowcoding"]
										})
									]
								})
							}),
							updateCapsState === "ready" && updateOp !== null && renderUpdateOperation(updateOp),
							updateCapsState === "ready" && updateOp === null && renderUpdateCheckView(),
							restarting && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: NowCodingDetailPage_module_css_default.row,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: NowCodingDetailPage_module_css_default.notice,
									role: "status",
									children: "Host 正在重启，页面将自动重新加载；若长时间未恢复，请手动刷新。"
								})
							}),
							updateNotice !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: NowCodingDetailPage_module_css_default.row,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: NowCodingDetailPage_module_css_default.notice,
									role: "status",
									children: updateNotice
								})
							})
						]
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