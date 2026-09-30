# AGENTS.md — dsh-llm-nowcoding

Standing orders for any agent working in this repository. Read this before changing `src/`.

This is an out-of-tree [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin. It registers the `nowcoding` provider route on `ctx.llm` for the NowCoding gateway (nowcoding.ai), ships a built-in model catalog, adds the GPT fast tier and reasoning levels, reads the remaining balance, and contributes a sidebar balance card to the Web GUI.

The one rule that matters most: **the active dsh profile owns every `@deepseek-ai/*` instance.** Nothing here may bundle, vendor, or re-implement a Harness package. A second copy of `@deepseek-ai/dsh-llm` registers the adapter into a seam the running loop never reads, and the failure is silent.

-----

## Layout

| Path | Responsibility |
|---|---|
| `src/index.ts` | Plugin entry. Registers the adapter, the configurable-provider entry, and the fenced route. Holds no logic of its own. |
| `src/config.ts` | Config schema, catalog resolution, and the immutable per-operation snapshot. Every field is `volatile`. |
| `src/catalog.ts` | The shipped model catalog, the `-fast` alias grammar, and selector expansion. Data, not policy. |
| `src/fast.ts` | The one decision about `service_tier`, and what happens when the model has no fast tier. |
| `src/models.ts` | Exact-route metadata behind `resolveModel` and `listModels`. No I/O. |
| `src/quota.ts` | The balance reader and its normalization, with an injected transport. |
| `src/settings-routes.ts` | The fenced `/nowcoding/api` route, its dispatch, and the browser-trust policy. |
| `src/settings-shared.ts` | Vocabulary both halves share. **Never import Host-only or Node modules here.** |
| `src/wire.ts` | Gateway wire types and narrowing guards. |
| `src/serialize.ts` | `GenerateOptions` to request body. |
| `src/sse.ts` | Server-sent-event framing. |
| `src/translate.ts` | Wire chunks to `StreamChunk`. |
| `src/transport.ts` | `fetch`, timeouts, cancellation, and failure classification. |
| `src/adapter.ts` | `NowCodingAdapter extends LlmAdapter`. Delegates metadata to `models.ts`. |
| `src/client/` | The browser half: the settings page, the sidebar balance card, and their shared wire client. |
| `tests/` | Unit specs. No spec may reach the network. |

Each fact has one home. The catalog is data only in `catalog.ts`; the fast decision only in `fast.ts`; the quota field semantics only in `quota.ts`. Do not restate them in the adapter, the route, or the client.

## Commands

```sh
pnpm install
pnpm run typecheck                       # tsc --noEmit over src, tests, build config
pnpm test                                # unit suite, no network
NOWCODING_API_KEY=... pnpm run test:e2e   # live smoke, self-skips without a key
pnpm run build                           # tsc declarations to lib/types, then tsdown bundles
```

There is no lint or coverage gate in this repository. `pnpm run typecheck && pnpm test && pnpm run build` is the full local check, and `build` is what catches client-bundle mistakes the unit suite cannot see.

### Distribution: `lib/` is committed on purpose

The plugin is installed from its repository (`dsh plugin --profile web add github:elves-ai/dsh-llm-nowcoding`), and a git install runs no build. pnpm 11 refuses a git dependency's build scripts unless every consumer allowlists the exact tarball URL — the allowlist key embeds the commit — so a `prepare` script does not degrade, it fails the install outright with `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`. The repository therefore ships the bundles.

Two consequences that are easy to get wrong:

- **Rebuild and commit `lib/` in the same change as any `src/` edit.** Users run the bundle, not the source. `pnpm run build` refreshes it, and a `src/` change without a rebuilt `lib/` ships the old behaviour.
- **Never add `prepare` back.** It is the conventional answer for git-distributed packages and it breaks the documented install here. `prepack` covers the publish path instead.

-----

## Contracts that must not drift

### The adapter contract

`@deepseek-ai/dsh-llm` owns the `StreamChunk` protocol. The obligations that were verified against real adapters:

- **Emit `usage` before `finish`, and nothing after `finish`.** The gateway sends trailing usage-only chunks, so buffer the terminal pair and flush at the stream end.
- **Tool-call `arguments` stay raw JSON strings end to end.** Stream fragments as `argumentsDelta`, and put the joined string in `block-end`. Never parse and re-serialize.
- **Allocate block indexes in first-seen stream order** and reuse the index for every delta of that block.
- **Failures take exactly one of two paths:** throw `LlmError` with a stable code from `stream()` for transport and protocol failures, or end the stream with `finish { kind: 'error' | 'aborted' }` for an in-band provider error. `translate.ts` and `transport.ts` own which is which; keep their JSDoc accurate.
- **Honor `options.signal`** down to `fetch`.
- **Never silently drop a `GenerateOptions` field.** A field the provider cannot honor is `LlmError(..., 'UNSUPPORTED_OPTION')`.
- **Every provider HTTP request carries `attributionHeaders()`** from `@deepseek-ai/dsh-llm`. A request without it fails the repository contract this plugin is held to. The quota reader sends them too, because the billing pair is a provider request.

### Configuration is volatile and keyed by the Loader entry id

The 0.1.7 Harness rewrote the settings seam. There is no `installSettingsSection`, no `settingsNamespace`, and no `settingsScope` for a third-party plugin:

- `ctx.settings` is a `SettingsForms` service. `describe()`, `mutate()`, and `update()` take a namespace **string**, and that namespace is the `id` of the Loader row that mounted the plugin — `llm-nowcoding` in `cordis.patch.yml`.
- A plugin does not register its section. The Harness projects the exported `Config` schema into a form automatically, so the NowCoding page exists because the row is mounted.
- `Config` fields are `Volatile<T>` references. Read `.get()` at the start of each operation; never capture a value in `apply`, or a settings save will not reach the next request.
- `NOWCODING_SETTINGS_NAMESPACE` is only the **default** for the `settingsNs` field. A profile that mounts the plugin under a different row id must set `settingsNs` to match, which is why the route reads it from the resolved options instead of importing the constant.
- `apiKey` is `role('secret')`. It never rides a settings response; surfaces only learn whether one is set. Do not add a code path that echoes it.
- **This plugin ships its own settings page, so `apply` calls `ctx.settings.configure({ auto: false })`.** Without it the Harness would generate a second page over the same section, and two editors would race on one revision. The call is guarded by `ctx.get('settings')` so a headless deployment without the service still loads.

### Fast mode

`fast.ts` owns the decision and nothing else may inline `service_tier`. Three facts drive it:

1. The wire spelling is `priority` or `fast`; both select OpenAI fast mode, and `priority` is the pre-rename spelling kept as the default for gateways that predate it.
2. A `-fast` model alias is a selector id, never a wire id. `wireModelId()` strips it before the request; `serialize.ts` must send the stripped id.
3. **The gateway strips `service_tier` unless its channel enables `allow_service_tier`.** Fast mode therefore defaults off and the field is dropped, not sent, for a model the catalog does not mark fast-capable. Do not "fix" that by sending it anyway: a gateway that does not know the model's tier rejects the whole request.

### Quota semantics

`quota.ts` reads two balances on two authentication chains, and every property below is load-bearing:

- **Subscription (console chain).** `GET {origin}/api/subscription/self` with `Authorization: Bearer <dashboard token>` **and** `New-Api-User: <user id>`. The `sk-` model key is rejected here, so this balance is unavailable without the second credential — and the chain reports that rejection as **HTTP 200 with `success: false`**, which reads as an empty plan unless the body is checked.
- **Wallet (relay chain).** `GET {base}/dashboard/billing/{subscription,usage}` with the model key.
- **Subscription amounts are raw quota units.** A displayed amount is `raw / quota_per_unit`, and `quota_per_unit` comes from the public `/api/status`; a guessed divisor misreports every figure, so the snapshot records the one it used.
- `soft_limit_usd` (wallet) is the **granted total**, not the remaining balance. Remaining is `soft_limit_usd - total_usage / 100`.
- `total_usage` is in **hundredths**, and the `*_usd` names carry the **display currency, which this gateway sets to CNY**.

`NOWCODING_UNLIMITED_QUOTA_SENTINEL` marks a key with no limit. A reader change must keep the `unreachable` / `unauthorized` / `gateway-error` / `unprocessable` / `timeout` classification: the card branches on it and a stale number must never be presented as current.

### The fenced route

`/nowcoding/api` is the only way the browser half reaches the Host. It is gated by the same browser-trust policy as the `/api` gateway: a loopback or configured trusted Host header, no `sec-fetch-site: cross-site`, and an `Origin` that matches when present. `isTrustedApiRequest` is copied from the sibling `dsh-web-search-firecrawl` plugin deliberately; keep the two in step and keep its tests if you add any.

The success envelope is `{ ok: true, value }` and the failure envelope is `{ ok: false, error: { code, message } }`, owned jointly with `src/client/api.ts`. Changing one without the other breaks the card silently.

### The browser half

- It registers two slots through `ctx.slots.inject`: `settings.section` (the NowCoding page) and `sidebar.footer.action` (the balance card). Registrations are effect-based; a bare `slots.register` into an undeclared slot is an error at load.
- It must not import Node builtins or any Host-only package. `tsdown.config.ts` enforces this with a purity gate that rejects a non-platform `@deepseek-ai/*` value import at build time.
- The card takes no props and holds no configuration. Every decision it renders — enabled, amounts, refresh interval — arrives from `quota.get`.
- Product copy is Chinese, matching the users this plugin serves. Keep it in the component; the Harness locale dictionaries are not available to an out-of-tree bundle.

-----

## Gateway facts, and how to re-verify them

These were confirmed against the live gateway on **2026-09-30**. The gateway is a new-api deployment with local modifications, so an upstream new-api behaviour is not automatically true here.

| Fact | Value | How to re-check |
|---|---|---|
| OpenAI-compatible base | `https://nowcoding.ai/v1` | `GET /api/status` → `api_info[].url` |
| Anthropic-compatible base | `https://nowcoding.ai` (`/v1/messages`) | same field, `route: Claude` |
| Auth | `Authorization: Bearer sk-...`; no extra headers required | — |
| Public catalog | `GET /api/pricing` (no credential) | returns `data[]`, `group_ratio`, `supported_endpoint` |
| Key-scoped models | `GET /v1/models` | 401 with the same error body as `/dashboard/billing/*`, so both sit behind one token-auth chain |
| Wallet balance | `GET {base}/dashboard/billing/subscription` and `/usage` | 401 for a bad key, not 404, which is what proves the routes exist |
| Subscription balance | `GET {origin}/api/subscription/self` | needs a dashboard token **and** `New-Api-User`; a bad credential answers `200 {success:false}` |
| Display divisor | `quota_per_unit` = 500000 | `GET /api/status` → `data.quota_per_unit` |
| Display currency | CNY despite `*_usd` field names | `GET /api/status` → `quota_display_type` |
| Health and latency | `GET /api/service-status/overview` (public) | per-group probes with `template` naming the protocol actually used |
| Fast passthrough | management-side `allow_service_tier`, value not public | compare the tier echoed in responses with and without the field |

**This plugin targets the `0.1.7-rc.2` and `0.2.0-rc.2` lines, which are identical in every seam it touches.** `packages/llm/llm/src`, `packages/settings/settings/src`, and the `sidebar.footer.action` contract have no diff between the two release tags, so the peer range covers both. Re-check that diff before widening the range further: the composition patch (`packages/bundle/web-app/cordis.patch.yml`) does change between lines, and a plugin row is composed through exactly that file.

**Do not treat the shipped catalog as verified truth.** It is a snapshot of `/api/pricing`; ids change as vendors ship models, and a wrong id surfaces as a provider error on the first request. When in doubt, re-read the live listing and update `catalog.ts`, or point users at `models` / `modelOverrides`.

**Operator notices belong in user-facing copy, not in code comments.** The gateway publishes that it does not serve Mainland China, that a VPN or proxy used to bypass that is a violation, and that several groups are restricted to a named client. Those are facts a user must weigh, and `README.md` states them; do not remove them to make the plugin read as neutral.

-----

## Verification expectations

| Change | Run at least |
|---|---|
| Pure logic in `catalog.ts`, `fast.ts`, `config.ts` | `pnpm test` — extend the owning spec |
| `quota.ts` | `pnpm test` — drive `normalizeQuota` with literal documents and `createQuotaReader` with an injected `fetch` |
| `serialize.ts`, `translate.ts`, `sse.ts`, `adapter.ts` | `pnpm test` against a recorded SSE transcript; `pnpm run typecheck` |
| `settings-routes.ts` | `pnpm run typecheck`; assert dispatch behaviour through a unit spec if you add one |
| `src/client/**` or `tsdown.config.ts` | `pnpm run build` — the purity gate and the client bundle are only exercised there |
| Anything under `src/` | `pnpm run build`, then commit the refreshed `lib/` with the source change |
| Anything user-visible | Update `README.md` and `README.zh.md` in the same change |

Unit specs must not touch the network. A live check is `tests/*.e2e.ts`, it self-skips without `NOWCODING_API_KEY`, and it is never the only evidence for a behavioural claim.

## Documentation

`README.md` is the user-facing contract and `README.zh.md` is its Chinese counterpart; update both together. Write one physical line per paragraph. State the current behaviour, not the history of how it got there. Package READMEs in this ecosystem list limitations rather than aspirations: if something does not work, `## Known limitations` says so plainly.

## Roadmap

Deferred work, in the order it is worth doing:

1. **Locale-owned copy.** The client half writes its strings inline in Chinese. The Harness expects product copy in typed locale dictionaries, which needs `@deepseek-ai/dsh-client-locale` and a `locale` registration.
2. **The Responses protocol.** Codex groups are reported by the gateway's own health checks as running `/v1/responses`, while the pricing metadata lists only `openai`. A second protocol on the adapter fixes a Codex-only group.
3. **The Anthropic Messages protocol.** The gateway serves `/v1/messages` at the origin-level base.
4. **Credential-seam integration.** `apiKeyEnv` resolves through `launchEnvironmentOf`. Resolving through `ctx.credentials` instead would let a key live in the credential store rather than the environment.
5. **Subscription balances.** `/api/subscription/self` reports monthly-plan remaining usage, but needs a dashboard access token rather than the API key, and answers HTTP 200 with `success: false` on failure.

## Gotchas

- **A `-fast` suffix in a request body is a bug.** It is a picker id; `wireModelId()` strips it.
- **`lib/types` is generated.** `tsdown` runs with `clean: false` precisely so it cannot wipe the declaration tree; keep it that way, and never hand-edit `lib/`.
- **`@deepseek-ai/dsh-client-runtime` no longer exists.** It was retired after `0.1.1-rc.2`; a 0.1.7-era client bundle types its context from `@deepseek-ai/cordis`.
- **`gpt-5.6-luna` is redirected to `gpt-5.6-terra`** and billed at the terra rate. The catalog entry says so; do not quietly drop the note.
- **`dsh plugin` forwards to pnpm inside the profile.** Installing here does not install there; the two have separate lockfiles.
