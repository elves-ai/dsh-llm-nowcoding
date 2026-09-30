# dsh-llm-nowcoding

[English](README.md) | [简体中文](README.zh.md)

Unofficial [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) LLM provider plugin for the **NowCoding** gateway ([nowcoding.ai](https://nowcoding.ai/)).

It registers a `nowcoding` provider route on `ctx.llm` with a built-in model catalog, the GPT fast tier, selectable reasoning levels, a remaining-quota reader, a settings page, and a balance card in the left sidebar.

> This is a community integration, not an official one. You need your own NowCoding account and API key, and NowCoding's terms apply. This project is not affiliated with NowCoding.

-----

## Before you install

**NowCoding states that it is not available in Mainland China.** Its published announcement says registration and use there are unsupported, that using a VPN or proxy to bypass the restriction is a violation, and that a violation may suspend the account without refund. Read the gateway's own announcements (`GET https://nowcoding.ai/api/status`) and its agreement before buying anything. This plugin implements a plain API client; it does not decide whether your use complies.

**Some groups are restricted to a specific client.** The gateway sells groups whose descriptions say things such as "for Claude Code only" or "no built-in prompt, Claude Code clients only". Routing those groups through any client but the named one may be refused or may get the account banned. Check the group behind your key before pointing this plugin at it.

**`gpt-5.6-luna` is redirected.** The gateway announced that requests for `gpt-5.6-luna` are served by `gpt-5.6-terra` and billed at the terra rate. The catalog entry carries that note; the plugin does not hide it.

-----

## What you get

- **A `nowcoding` provider route.** Install into any dsh profile; the route appears in the model picker with the shipped catalog, and serves OpenAI-compatible streaming chat completions.
- **Built-in model catalog.** The models the gateway publishes are shipped in the plugin, with context windows, output caps, input modalities, reasoning levels, and fast-tier capability. A `models` list replaces it; `modelOverrides` reshapes single entries; nothing about the catalog is compiled into the adapter.
- **GPT fast mode.** Fast-capable GPT models get a second picker entry (`gpt-5.6-sol-fast`) that sends the same wire model with `service_tier`; a route default turns it on for every fast-capable model. See [Fast mode](#fast-mode) for the caveat that actually decides whether it takes effect.
- **Selectable reasoning levels.** Each model declares the levels its picker offers and the spelling the request sends, so the level ids never leak into the wire format.
- **Dedicated settings page.** **DSH Settings → NowCoding** holds the key, the endpoint, fast mode, and the sidebar switch, plus a balance block with a manual refresh. The Harness renders no second page for the same section.
- **Remaining-quota reader.** A card at the sidebar foot, directly beside Settings, shows either a monthly plan's allowance — read from the console with a dashboard token — or the pay-as-you-go wallet read with the same key chat uses.
- **Live settings.** API key, endpoint, fast mode, and the sidebar switch are editable from DSH Settings and apply to the next request without a restart.

-----

## Requirements

- **dsh `0.1.7-rc.2` or `0.2.0-rc.2`.** Both lines ship the same `ctx.llm` adapter contract, settings seam, and sidebar slot contract, so the peer range covers both. An older line nests a second copy of the seam into the profile, and the adapter then registers into a registry the running loop never reads.
- **Node.js `>=22`.**
- **A NowCoding API key** (`sk-...`), from [nowcoding.ai](https://nowcoding.ai/).

## Install

The plugin installs straight from its repository:

```sh
dsh plugin --profile web add github:elves-ai/dsh-llm-nowcoding
```

Running dsh from a `deepseek-harness` source checkout, where `dsh` is a workspace script rather than a global binary, prefix it with `pnpm` from the workspace root:

```sh
pnpm dsh plugin --profile web add github:elves-ai/dsh-llm-nowcoding
```

Append `#<ref>` to pin a tag or a commit, which is what a reproducible profile wants:

```sh
dsh plugin --profile web add github:elves-ai/dsh-llm-nowcoding#v0.1.0
```

`dsh plugin` forwards to pnpm inside the profile directory and appends the package to the profile's bundle list automatically. The bundle patch mounts the `llm-nowcoding` row with `apiKeyEnv: NOWCODING_API_KEY`, so an environment variable works before anything is configured.

Then restart `dsh web` and hard-refresh the page (Cmd/Ctrl+Shift+R) so the browser half loads:

```sh
dsh web
```

**The repository ships its built bundles, so installation copies files and runs nothing.** `lib/` is committed on purpose: pnpm 11 refuses to run a git dependency's build scripts unless every consumer allowlists the exact tarball URL (the key embeds the commit), which would make `prepare` fail the install outright rather than fall back. The cost is that `lib/` must be rebuilt and committed whenever `src/` changes — [AGENTS.md](AGENTS.md) carries that rule.

## Configure

Open **DSH Settings → NowCoding**. The page reaches the Host through the plugin's own fenced `/nowcoding/api` route, because the settings RPC domain serves Host-owned namespaces through an allowlist that a third-party plugin cannot join.

| Field | Default | Meaning |
|---|---|---|
| API Key | (blank) → `$NOWCODING_API_KEY` | Sent as `Authorization: Bearer`. Stored as a secret: it never rides a settings response, so the page only shows whether one is set. Saving with the field blank keeps the current key; **Clear** removes it. |
| Base URL | `https://nowcoding.ai/v1` | Endpoint base for the chat route and the billing pair. The gateway's Anthropic-compatible front end lives at `https://nowcoding.ai`; this plugin speaks the OpenAI-compatible route, so the base carries `/v1`. |
| Fast mode | off | Send `service_tier` on every fast-capable model. |
| Fast tier value | `priority` | Wire spelling: `priority` (the pre-rename spelling, safest on a gateway that predates it) or `fast`. |
| Sidebar balance card | on | Show the remaining-quota card above Settings in the left sidebar. |
| Panel user ID | (blank) | Dashboard user id, sent as `New-Api-User`. Required by the console chain that reports a monthly plan. Signing in fills it. |
| Panel access token | (blank) | Dashboard token from the console's system-access-token page. Only it can read a plan's allowance, because the console chain rejects the `sk-` key. Blank leaves the card on the pay-as-you-go wallet. Signing in fills it. |

Every field also exists as a composition field, so a profile can pin only what it needs and let the settings layer override the rest:

```yaml
- id: llm-nowcoding
  name: '@elves-ai/dsh-llm-nowcoding'
  config:
    apiKeyEnv: NOWCODING_API_KEY   # second account: point this at another variable
    baseURL: https://nowcoding.ai/v1
    fast: false
    fastServiceTier: priority
    quotaCard: true
    quotaRefreshSeconds: 300
```

The generated configuration surface is `Config` in `src/config.ts`; every field carries its JSDoc there.

-----

## Models

The shipped catalog (`src/catalog.ts`) is a snapshot of the gateway's published lineup taken on **2026-09-30**, grouped by vendor:

- **OpenAI / Codex** — `gpt-6-astra`, `gpt-6-sol`, `gpt-6.1-sol`, `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`, `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-openai-compact`, `gpt-5.3-codex`, `gpt-5.3-codex-spark`, `codex-auto-review`.
- **Anthropic** — `claude-opus-5`, `claude-sonnet-5`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`.
- **xAI** — `grok-4.6`, `grok-4.5`, `grok-4.3`.

A model list is a moving target on a relay, so the catalog is a starting point rather than the authority. Three ways to correct it:

| Goal | Configuration |
|---|---|
| Serve a different line-up | `models: [{ id: acme-think, contextWindow: 262144, maxTokens: 32768, input: [text, image] }]` replaces the shipped catalog. Each entry defaults its unset fields from the shipped model of the same id. |
| Correct one shipped model | `modelOverrides: { gpt-5.6-sol: { contextWindow: 200000 } }` reshapes that model and leaves the rest alone. |
| Drop a model from the picker | `hiddenModels: [grok-4.3]`. |

Model ids reach the gateway verbatim: a near miss surfaces as a provider error on the first request rather than as a silently substituted model. The gateway's own public lineup is at `GET https://nowcoding.ai/api/pricing`, which needs no credential and is the fastest way to check whether an id still exists.

## Fast mode

OpenAI's fast mode is a request-body `service_tier`: `priority` or `fast` both select it, `priority` being the older spelling. The plugin sends it in two cases:

1. **The model id carries the `-fast` suffix.** Fast-capable models appear twice in the picker — `gpt-5.6-sol` and `gpt-5.6-sol-fast`. The suffix never reaches the gateway; the request carries `service_tier` and the plain wire id.
2. **The route default is on.** With `fast: true` (or the settings switch), every fast-capable model is served at the fast tier, and a model the catalog does not mark fast-capable is left alone rather than sent a tier the gateway might reject.

**The caveat that decides whether this does anything.** The gateway is a new-api deployment, and new-api **filters `service_tier` out of requests by default**; a channel forwards it only when its own `allow_service_tier` switch is on. The gateway has that switch — its admin UI carries the label "允许 service_tier 透传" with the warning that allowing it may bill above the expected rate — but whether any given channel has it enabled is a management-side setting this plugin cannot read. So:

- Fast mode is **off by default**. Turning it on cannot break a request; at worst the field is stripped and the request is served at the standard tier.
- **Expect the higher rate if it does take effect.** Fast mode is billed above standard processing.
- **How to tell.** The response echoes the tier it served. If it comes back `default` while you sent `priority`, the channel is stripping the field.

Fast is independent of reasoning level: `reasoningEffort` travels separately as the gateway's `reasoning_effort`, mapped from the catalog's per-model level table.

## Remaining quota

The gateway reports two different balances on two different authentication chains, and which one matters depends on how you pay.

**A monthly plan** is what the gateway's own console shows. It is read from the console API:

```
GET {origin}/api/subscription/self   Authorization: Bearer <dashboard token>, New-Api-User: <user id>
GET {origin}/api/status              public; supplies quota_per_unit
```

The console chain **rejects the `sk-` model key**, and it says so with HTTP 200 and `success: false` rather than a 401 — a wrong credential reads as an empty plan unless the body is checked. The plugin therefore takes a second credential on its settings page: the dashboard user id and an access token from the console's system-access-token page. With both set, the card shows the plan's allowance and its consumption against it, matching the console.

### Signing in instead of copying the token

The settings page obtains that credential for you. Its sign-in block takes the NowCoding account name and password, performs the console login, and writes the resulting token and user id into the two fields above.

```
POST {origin}/api/user/login        { username, password }   -> session cookie + account document
POST {origin}/api/user/login/2fa    { code }                 only when the answer sets require_2fa
GET  {origin}/api/user/self/access-token                     -> the account's dashboard token
GET  {origin}/api/user/token                                 -> issues one, rotating an existing token
```

**The password is used once and stored nowhere.** It travels to the gateway in that single login request; the Host keeps it for the duration of the call, never writes it to the settings store, and never returns it to the page, which clears the field as soon as the login settles. The token that comes back is written by the Host process, so it does not ride a response either.

The token is read over the session cookie the login set. The plugin tries the read-only routes first and reaches `/api/user/token` — the route the console itself labels a reset — only when the account holds no token, so an existing token is not rotated out from under your other tools.

Three things worth knowing before you rely on it:

- **Turnstile stops it.** `GET /api/status` reports `turnstile_check`, which is off on this deployment. With it on, only a browser can answer the challenge; the sign-in reports `turnstile-required` and points you at the manual field.
- **2FA is supported.** An account with an authenticator app gets a second step in the same block, and the half-finished session lives in the Host for five minutes.
- **Signing in is not a model key.** The console credential reads a plan's allowance; chat requests still need an `sk-` key from the console's token page.

Amounts in that document are **raw quota units**, not currency: a displayed amount is `raw / quota_per_unit`, and `quota_per_unit` (500000 on this deployment) comes from the public status document. The reader divides by the value the gateway reports and records the divisor in every snapshot, so a wrong one is visible rather than silent.

**A pay-as-you-go wallet** needs only the model key, and is read from the OpenAI-compatible billing pair behind the same authentication as `/v1/models`:

```
GET {baseURL}/dashboard/billing/subscription   ->  { soft_limit_usd, hard_limit_usd, access_until, ... }
GET {baseURL}/dashboard/billing/usage          ->  { total_usage, ... }
```

Two properties of that pair are easy to get wrong, and the plugin handles them so you do not have to:

- **`soft_limit_usd` is the granted total, not the remaining balance.** Remaining is `soft_limit_usd - total_usage / 100`.
- **`total_usage` is in hundredths, and the `*_usd` fields carry the display currency, which is CNY here.** The names are a compatibility leftover from the OpenAI billing shape; the card labels amounts in `¥`, because reading them as dollars overstates a balance by the exchange rate.

A key with no quota limit reports the gateway's unlimited sentinel instead of a grant; the card shows "unlimited" rather than a balance computed against it.

The card sits at the sidebar foot beside Settings (`sidebar.footer.action`), shows remaining over total with a progress bar, turns to a warning colour below 20%, refreshes on mount and every `quotaRefreshSeconds` (default 300, minimum 30), and draws nothing at all when its settings switch is off. Before a key is configured it says so instead of showing an error, and a failed read offers a retry rather than a stale number. The settings page shows the same figures with a manual refresh.

The reader is a host-side client (`src/quota.ts`) with an injected transport, so it is unit-tested without a network and can be reused outside the card. Failures carry a stable code — `unreachable`, `unauthorized`, `gateway-error`, `unprocessable`, `timeout` — and the card reports which one it hit rather than showing a stale number as if it were current.

## Verify it works

1. **The route appears.** Settings → Models lists a **NowCoding** route with the shipped catalog.
2. **A turn completes.** Pick `gpt-5.6-sol` (or any model your group serves) and send a message. Text streams, tool calls run, and the session's token accounting fills in.
3. **The balance reads.** The sidebar card and the settings page both show a remaining balance. If it shows an error, its code says whether the key was rejected (`unauthorized`) or the gateway could not be reached (`unreachable`).
4. **Fast mode is visible in the request.** With the `-fast` entry selected, the request body carries `service_tier`; check the response's echoed tier to learn whether the channel forwards it.
5. **Sign-in fills the console credential.** On the settings page, the sign-in block with the account name and password writes Panel user ID and Panel access token and switches the balance to the plan's allowance. A refused password reports so in Chinese; a deployment with Turnstile on reports that instead.

## Update

```sh
dsh plugin --profile web update @elves-ai/dsh-llm-nowcoding
```

A git install resolves to the commit that was current when it was added, so an update re-resolves the default branch. If the lockfile does not move, remove and re-add instead — that always re-resolves:

```sh
dsh plugin --profile web remove @elves-ai/dsh-llm-nowcoding
dsh plugin --profile web add github:elves-ai/dsh-llm-nowcoding
```

Restart `dsh web` afterwards, then hard-refresh. Replace `web` with another profile name if you installed elsewhere.

## Uninstall

```sh
dsh plugin --profile web remove @elves-ai/dsh-llm-nowcoding
```

This removes the package and its bundle mount, not the settings values. Clear the API key on the NowCoding settings page first if you want it gone; the stored value lives in the harness settings store, not in this package.

-----

## Development

```sh
pnpm install
pnpm run typecheck        # tsc --noEmit over src, tests, and build config
pnpm test                 # unit suite, no network
NOWCODING_API_KEY=... pnpm run test:e2e   # live smoke, self-skips without a key
pnpm run build            # tsc declarations into lib/types, then tsdown bundles
```

`src/` is split so each concern has one home:

| File | Responsibility |
|---|---|
| `src/index.ts` | Plugin entry: registers the adapter, the settings namespace, and the fenced route. |
| `src/config.ts` | Config schema, catalog resolution, and the immutable per-generation snapshot. |
| `src/catalog.ts` | The shipped model catalog, the `-fast` alias grammar, and selector expansion. |
| `src/fast.ts` | Whether one request sends `service_tier`, and what happens when it cannot. |
| `src/models.ts` | Exact-route metadata answering `resolveModel` and `listModels`. |
| `src/quota.ts` | The remaining-quota reader and its normalization. |
| `src/panel-login.ts` | The console sign-in that yields the dashboard token and user id. |
| `src/settings-routes.ts` | The fenced `/nowcoding/api` route and its browser-trust policy. |
| `src/settings-shared.ts` | Settings vocabulary shared by both halves, free of Host-only imports. |
| `src/adapter.ts`, `src/serialize.ts`, `src/sse.ts`, `src/translate.ts`, `src/transport.ts`, `src/wire.ts` | The OpenAI-compatible streaming adapter. |
| `src/client/` | The browser half: the settings page, the sidebar balance card, and their shared wire client. |

[AGENTS.md](AGENTS.md) carries the development rules, the contracts that must not drift, and what to run for which change.

## Known limitations

- **OpenAI-compatible chat completions only.** The gateway also serves `/v1/responses` and Anthropic `/v1/messages`. Codex groups are reported by the gateway's health checks as running on the Responses API even though their pricing metadata lists only `openai`, so a Codex-only group may need that protocol before it works here; the adapter seam supports adding it as a second protocol.
- **The catalog is a snapshot.** It is dated in `src/catalog.ts` and corrected by configuration rather than by a release; nothing in the adapter assumes the list is current.
- **Fast mode cannot be verified from outside.** Whether a channel forwards `service_tier` is a management-side setting; the plugin can send the field and report the echoed tier, and nothing more.
- **The balance is key-scoped or account-scoped depending on a hidden switch.** new-api can report either the API key's own quota or the account's, chosen by a server setting the gateway does not publish. The card labels what it read without claiming which one it is.
- **A subscription balance needs a second credential.** The console chain rejects the model key, so the plugin takes a dashboard user id and access token, obtained by signing in or pasted by hand; without them the card reports the pay-as-you-go wallet instead. Other console APIs are out of scope.
- **Sign-in is a password login, not OAuth.** The gateway can offer GitHub, LinuxDO, WeChat, Telegram, and OIDC sign-in; all are off on this deployment, and an OAuth flow would need a browser redirect this plugin cannot host. Username and password, plus 2FA, is the supported path.
- **A Turnstile deployment cannot be signed into from here.** Only a browser can solve the challenge; the manual token field remains the way in.
- **Client copy is inline Chinese.** The Harness expects product copy in typed locale dictionaries, which needs `@deepseek-ai/dsh-client-locale` and a locale registration; that is later work.
- **No account rotation.** One key per route; a second account is a second profile or a second environment variable.

## License

[MIT](LICENSE).
