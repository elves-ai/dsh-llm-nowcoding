# dsh-llm-nowcoding

[English](README.md) | [简体中文](README.zh.md)

面向 **NowCoding** 网关（[nowcoding.ai](https://nowcoding.ai/)）的非官方 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 模型提供商插件。

它在 `ctx.llm` 上注册 `nowcoding` 提供商路由，内置模型目录，支持 GPT 快速模式与可选推理档位，能读取剩余额度，并在插件页面提供详情页，在左侧栏提供余量卡片。

> 这是社区集成，不是官方插件。你需要自己的 NowCoding 账号与 API Key，并遵守 NowCoding 的条款。本项目与 NowCoding 无隶属关系。

-----

## 安装前必读

**NowCoding 官方声明不面向中国大陆。** 其公告写明不在中国大陆提供注册与使用，使用 VPN、代理或其他方式绕过该限制属于违规，违规可能导致账号被停用且不退款。购买前请先阅读网关自己的公告（`GET https://nowcoding.ai/api/status`）与用户协议。本插件只实现一个普通的 API 客户端，是否合规由你自己判断。

**部分分组限定客户端。** 网关出售的部分分组在其描述里写明「仅限 Claude Code 使用」「无内置提示词，仅限 cc 客户端」之类。用别的客户端走这些分组可能被拒，甚至导致账号被封。把插件指向某个 Key 之前，先确认它属于哪个分组。

**`gpt-5.6-luna` 会被重定向。** 网关公告称该模型的请求将由 `gpt-5.6-terra` 服务并按 terra 的价格计费。插件在目录条目里保留了这条说明，不会把它藏起来。

-----

## 功能

- **`nowcoding` 提供商路由。** 装进任意 dsh profile 即可使用；路由会带着内置目录出现在模型选择器里，走 OpenAI 兼容的流式对话补全。
- **内置模型目录。** 网关公开的模型随插件一起发布，包含上下文窗口、输出上限、输入模态、推理档位与是否支持快速模式。`models` 可整体替换，`modelOverrides` 可单独改写，目录里没有任何东西被编译进适配器。
- **GPT 快速模式。** 支持快速模式的 GPT 模型在选择器里多出一条入口（如 `gpt-5.6-sol-fast`），它发送同一个线上模型 id 并附带 `service_tier`；也可以打开路由默认值，让所有支持的模型都走快速档。它到底生不生效，见 [快速模式](#快速模式)。
- **可选推理档位。** 每个模型声明选择器提供哪些档位、请求发送什么拼写，档位 id 不会泄漏到线上协议里。
- **专属详情页。** 在侧栏的「插件」页面点开 **NowCoding**，进入插件自己的详情页：Key、端点、快速模式与侧栏开关，外加一个可手动刷新的余量区块。DSH 设置里不再有任何入口 —— 宿主为自带浏览器半侧的插件提供了专属页面（`plugins.bundle.config`），插件也不让 Harness 为同一命名空间再渲染第二个页面。
- **余量查询。** 左侧栏紧挨「设置」的卡片显示余额：配置了面板令牌与用户 ID 时显示订阅（月卡）额度，否则显示按量余额。
- **配置即时生效。** Key、端点、快速模式与侧栏开关保存后，对下一次请求立即生效，无需重启。

-----

## 环境要求

- **dsh `0.1.7-rc.2` 或 `0.2.0-rc.2`。** 这两条线提供的 `ctx.llm` 适配器契约、设置 seam 与客户端槽位契约 —— 包括插件页面的 `plugins.bundle.config` —— 完全相同，因此 peer 范围同时覆盖两者。更早的版本会在 profile 里嵌进第二份 seam，适配器注册进的那份注册表运行中的 loop 根本不会读。
- **Node.js `>=22`。**
- **一个 NowCoding API Key**（`sk-...`），来自 [nowcoding.ai](https://nowcoding.ai/)。

## 安装

插件直接从仓库安装：

```sh
dsh plugin --profile web add github:elves-ai/dsh-llm-nowcoding
```

如果 dsh 是从 `deepseek-harness` 源码仓库里跑的（那里的 `dsh` 是 workspace 脚本而非全局命令），在仓库根目录加 `pnpm` 前缀：

```sh
pnpm dsh plugin --profile web add github:elves-ai/dsh-llm-nowcoding
```

在末尾加 `#<ref>` 可以固定到某个 tag 或 commit，profile 需要可复现时建议这样写：

```sh
dsh plugin --profile web add github:elves-ai/dsh-llm-nowcoding#v0.1.0
```

`dsh plugin` 会在 profile 目录里转发给 pnpm，并把本包自动追加到 profile 的 bundle 列表。bundle 补丁挂载 `llm-nowcoding` 这一行并带上 `apiKeyEnv: NOWCODING_API_KEY`，所以还没做任何配置时环境变量也能用。

安装后重启 `dsh web`，再强制刷新页面（Cmd/Ctrl+Shift+R）以加载浏览器端：

```sh
dsh web
```

**仓库直接携带构建产物，所以安装只做文件复制，不执行任何脚本。** `lib/` 是有意入库的：pnpm 11 默认拒绝执行 git 依赖的构建脚本，除非每个使用方都把那个带 commit 号的 tarball URL 加进 allowlist —— 也就是说 `prepare` 会让安装直接失败而不是降级。代价是 `src/` 一改就必须重新构建并一起提交，这条约束记在 [AGENTS.md](AGENTS.md)。

## 配置

打开侧栏的「插件」页面，点开 **NowCoding**。该页面通过插件自己的 `/nowcoding/api` 路由访问 Host —— 设置 RPC 域只服务白名单内的官方命名空间，第三方插件进不去。

| 字段 | 默认值 | 含义 |
|---|---|---|
| API Key | （空）→ `$NOWCODING_API_KEY` | 以 `Authorization: Bearer` 发送。按密钥存储：永远不会出现在设置响应里，页面只知道「是否已配置」。留空保存表示保持原值，**清除** 才会删除。 |
| Base URL | `https://nowcoding.ai/v1` | 对话路由与计费接口共用的端点基址。网关的 Anthropic 兼容前端在 `https://nowcoding.ai`；本插件走 OpenAI 兼容路由，所以基址带 `/v1`。 |
| 快速模式 | 关 | 对所有支持快速模式的模型发送 `service_tier`。 |
| 快速档位取值 | `priority` | 线上拼写：`priority`（改名前的写法，对老网关最稳）或 `fast`。 |
| 侧栏余量卡片 | 开 | 是否在左侧栏紧挨「设置」的位置显示余量卡片。 |
| 面板用户 ID | （空） | 控制台的数字用户 ID，作为 `New-Api-User` 发送。显示订阅（月卡）余额这条链需要它。用账号登录会自动填入。 |
| 面板访问令牌 | （空） | 控制台「系统访问令牌」页生成的令牌。只有它能读取订阅额度 —— 控制台链不接受 `sk-` 模型 Key。留空时卡片显示按量余额。用账号登录会自动填入。 |

每个字段同时也是 composition 字段，profile 可以只固定需要的几项，其余交给设置层覆盖：

```yaml
- id: llm-nowcoding
  name: '@elves-ai/dsh-llm-nowcoding'
  config:
    apiKeyEnv: NOWCODING_API_KEY   # 第二个账号：指向另一个环境变量
    baseURL: https://nowcoding.ai/v1
    fast: false
    fastServiceTier: priority
    quotaCard: true
    quotaRefreshSeconds: 300
```

完整的配置项与说明见 `src/config.ts` 的 `Config` 及其 JSDoc。

-----

## 模型

内置目录（`src/catalog.ts`）是 **2026-09-30** 对网关公开型号表的一次快照：

- **OpenAI / Codex** —— `gpt-6-astra`、`gpt-6-sol`、`gpt-6.1-sol`、`gpt-5.6-sol`、`gpt-5.6-terra`、`gpt-5.6-luna`、`gpt-5.5`、`gpt-5.4`、`gpt-5.4-mini`、`gpt-5.4-openai-compact`、`gpt-5.3-codex`、`gpt-5.3-codex-spark`、`codex-auto-review`。
- **Anthropic** —— `claude-opus-5`、`claude-sonnet-5`、`claude-sonnet-4-6`、`claude-haiku-4-5-20251001`。
- **xAI** —— `grok-4.6`、`grok-4.5`、`grok-4.3`。

中转站的型号表一直在变，所以目录只是起点而不是权威。三种修正方式：

| 目标 | 配置 |
|---|---|
| 换成另一套型号 | `models: [{ id: acme-think, contextWindow: 262144, maxTokens: 32768, input: [text, image] }]` 整体替换内置目录；每个条目未写的字段从同 id 的内置条目取默认值。 |
| 只修正某个内置模型 | `modelOverrides: { gpt-5.6-sol: { contextWindow: 200000 } }` 只改写它，其余不动。 |
| 从选择器里藏掉某个模型 | `hiddenModels: [grok-4.3]`。 |

模型 id 会原样发到网关：写错 id 会在第一次请求时报提供商错误，而不是被静默替换成别的模型。网关自己的公开型号表在 `GET https://nowcoding.ai/api/pricing`，无需凭据，是确认某个 id 是否还存在的最快办法。

## 快速模式

OpenAI 的快速模式是请求体里的 `service_tier`：`priority` 与 `fast` 都能选中它，`priority` 是改名前的拼写。插件在两种情况下发送它：

1. **模型 id 带 `-fast` 后缀。** 支持快速模式的模型在选择器里出现两次 —— `gpt-5.6-sol` 与 `gpt-5.6-sol-fast`。后缀不会发到网关；请求带的是 `service_tier` 和去掉后缀的线上 id。
2. **路由默认开关打开。** `fast: true`（或详情页开关）让所有支持快速模式的模型走快速档；目录未标注支持的模型不会被硬塞这个字段，以免请求被网关直接拒绝。

**决定它到底有没有用的前提。** 网关是 new-api 部署，而 new-api **默认会把请求里的 `service_tier` 过滤掉**；只有当某个渠道自己打开了 `allow_service_tier` 时才会透传。网关确实有这个开关 —— 它的管理界面里有「允许 service_tier 透传」以及「可能导致实际计费高于预期」的提示 —— 但某个渠道是否开启属于管理端配置，插件读不到。因此：

- 快速模式**默认关闭**。打开它不会让请求失败；最坏情况是字段被剥掉，请求按标准档服务。
- **如果它真的生效，计费会高于标准档。**
- **怎么判断。** 响应里会回显实际服务的档位；如果你发了 `priority` 却回 `default`，说明该渠道在剥离这个字段。

快速模式与推理档位互不影响：`reasoningEffort` 单独作为网关的 `reasoning_effort` 发送，由目录里每个模型的档位表映射而来。

## 余量查询

网关在两条不同的鉴权链上提供两种余额，你需要看哪一种取决于你怎么付费。

**订阅（月卡）余额** 就是网关控制台里显示的那个，读的是控制台接口：

```
GET {origin}/api/subscription/self   Authorization: Bearer <面板令牌>, New-Api-User: <用户 ID>
GET {origin}/api/status              公开；提供 quota_per_unit
```

控制台这条链**不接受 `sk-` 开头的模型 Key**，而且它返回的是 HTTP 200 加 `success: false`，不是 401 —— 凭据不对时看起来像「没有订阅」，除非你检查响应体。所以插件在详情页里要求第二组凭据：面板用户 ID，以及控制台「系统访问令牌」页里生成的访问令牌。两项都填好后，卡片显示的就是套餐额度与已用量，与控制台一致。

### 用账号登录，而不是手动复制令牌

详情页可以直接把这两项取回来：在「用 NowCoding 账号登录」里填账号与密码，插件替你完成控制台登录，并把拿到的访问令牌与用户 ID 写进上面两个字段。

```
POST {origin}/api/user/login        { username, password }   -> 会话 Cookie + 账号文档
POST {origin}/api/user/login/2fa    { code }                 仅当响应里 require_2fa 为真
GET  {origin}/api/user/self/access-token                     -> 账号已有的面板令牌
GET  {origin}/api/user/token                                 -> 签发新令牌，会轮换已有令牌
```

**密码只用一次，不落盘。** 它只随这一次登录请求发往站方；Host 在调用期间持有，不写进设置、不回传页面，登录一结束页面就会清空输入框。换回来的令牌由 Host 直接写入配置，同样不经浏览器返回。

令牌是通过登录返回的会话 Cookie 回读的。插件先走只读的那两个接口，只有在账号本身没有令牌时才调用 `/api/user/token`（也就是控制台里那个「重置」动作），因此不会把你其他工具正在用的令牌悄悄换掉。

三点需要提前知道：

- **Turnstile 会挡住这条路。** `GET /api/status` 里的 `turnstile_check` 在本部署为关闭；一旦开启，只有浏览器能过人机校验，登录会以 `turnstile-required` 失败并提示你改用手动填写。
- **支持两步验证（2FA）。** 账号开启认证器后，同一张卡片里会多出验证码一步，半途的会话在 Host 里保留五分钟。
- **登录拿到的不是模型 Key。** 控制台凭据只用来读套餐额度；对话请求仍然需要控制台令牌页里 `sk-` 开头的 Key。

那个文档里的金额是**原始配额单位**，不是货币：显示值 = `raw / quota_per_unit`，而 `quota_per_unit`（本部署为 500000）来自公开的状态接口。读取器按网关实际返回的值做除法，并把除数记进每个快照里，除数错了是看得见的，而不是静默算错。

**按量余额** 只需要模型 Key，读的是 OpenAI 兼容的计费接口，鉴权链路与 `/v1/models` 相同：

```
GET {baseURL}/dashboard/billing/subscription   ->  { soft_limit_usd, hard_limit_usd, access_until, ... }
GET {baseURL}/dashboard/billing/usage          ->  { total_usage, ... }
```

这对接口有两个很容易算错的地方，插件替你处理了：

- **`soft_limit_usd` 是总额度，不是剩余额度。** 剩余 = `soft_limit_usd - total_usage / 100`。
- **`total_usage` 的单位是百分之一；而 `*_usd` 字段装的其实是展示货币，这里是人民币。** 名字是沿用 OpenAI 计费结构的兼容写法，所以卡片用 `¥` 标注金额 —— 把它当美元读会让余额虚高一个汇率。

不限额度 的 Key 会返回网关的哨兵值而不是真实额度，卡片会显示「不限额度」，而不是拿哨兵值去算余额。

卡片在左侧栏紧挨「设置」的位置（`sidebar.footer.action`），显示剩余／总额度与进度条，剩余低于 20% 转为警示色，挂载时读一次并按 `quotaRefreshSeconds`（默认 300，最小 30）定时刷新，开关关闭时完全不渲染。还没配置 Key 时它会直接说明，而不是报错；读取失败时给一个「重试」，绝不会把过期数字当成当前值。详情页展示同样的数据，并带手动刷新。

读取逻辑是 Host 侧的 `src/quota.ts`，传输可注入，因此可以脱离网络做单测，也能在卡片之外复用。失败带有稳定错误码 —— `unreachable`、`unauthorized`、`gateway-error`、`unprocessable`、`timeout` —— 卡片会说明碰到了哪一种。

## 验证是否可用

1. **路由出现了。** 设置 → 模型 里能看到 **NowCoding** 路由与内置目录。
2. **一轮对话能跑完。** 选 `gpt-5.6-sol`（或你所在分组支持的模型）发一条消息：文本流式返回、工具调用正常、会话的 token 统计有数。
3. **余额能读到。** 侧栏卡片与详情页都显示剩余额度。若显示错误，错误码会说明是 Key 被拒（`unauthorized`）还是网关不可达（`unreachable`）。
4. **快速模式在请求里可见。** 选中 `-fast` 入口时，请求体会带 `service_tier`；看响应回显的档位就能知道该渠道是否透传。
5. **登录能填好控制台凭据。** 详情页的登录区填入账号与密码后，面板用户 ID 与访问令牌被写入，余额切换到套餐额度。密码错误会给出对应提示；站方开启 Turnstile 时会明确说明并让你改用手动填写。

## 更新

```sh
dsh plugin --profile web update @elves-ai/dsh-llm-nowcoding
```

git 方式安装会锁定到添加时的那个 commit，所以更新就是重新解析默认分支。如果 lockfile 没有变化，就改成先移除再添加 —— 那一定会重新解析：

```sh
dsh plugin --profile web remove @elves-ai/dsh-llm-nowcoding
dsh plugin --profile web add github:elves-ai/dsh-llm-nowcoding
```

之后重启 `dsh web` 并强制刷新。如果装在别的 profile，把 `web` 换成对应名字。

## 卸载

```sh
dsh plugin --profile web remove @elves-ai/dsh-llm-nowcoding
```

这会移除包与其 bundle 挂载，但不会删除设置值。想彻底清掉 Key，请先在 NowCoding 详情页点「清除」；保存的值在 Harness 的设置存储里，不在本包内。

-----

## 开发

```sh
pnpm install
pnpm run typecheck        # tsc --noEmit，覆盖 src、tests 与构建配置
pnpm test                 # 单元测试，不联网
NOWCODING_API_KEY=... pnpm run test:e2e   # 真实接口冒烟，无 Key 自动跳过
pnpm run build            # tsc 产出 lib/types，再由 tsdown 打包
```

`src/` 按职责拆分，每个关注点只有一个家：

| 文件 | 职责 |
|---|---|
| `src/index.ts` | 插件入口：注册适配器、可配置提供商条目与受保护路由。 |
| `src/config.ts` | 配置 schema、目录解析，以及每次操作使用的不可变快照。 |
| `src/catalog.ts` | 内置模型目录、`-fast` 别名语法与选择器展开。 |
| `src/fast.ts` | 单次请求是否发送 `service_tier`，以及发不了时怎么办。 |
| `src/models.ts` | `resolveModel` 与 `listModels` 背后的精确路由元数据。 |
| `src/quota.ts` | 余量读取器及其归一化。 |
| `src/panel-login.ts` | 控制台账号登录，换取面板令牌与用户 ID。 |
| `src/settings-routes.ts` | 受保护的 `/nowcoding/api` 路由、分发与浏览器信任策略。 |
| `src/settings-shared.ts` | 两端共享的设置词汇，禁止引入 Host 专有依赖。 |
| `src/adapter.ts`、`src/serialize.ts`、`src/sse.ts`、`src/translate.ts`、`src/transport.ts`、`src/wire.ts` | OpenAI 兼容流式适配器。 |
| `src/client/` | 浏览器端：插件详情页、侧栏余量卡片与共享的 wire client。 |

[AGENTS.md](AGENTS.md) 记录了开发约定、不可漂移的契约，以及各类改动该跑哪些检查。

## 已知限制

- **只实现 OpenAI 兼容的对话补全。** 网关还提供 `/v1/responses` 与 Anthropic 的 `/v1/messages`。网关自己的健康检查显示 Codex 分组跑在 Responses API 上，尽管其价格元数据只标了 `openai`，因此仅支持 Codex 的分组可能需要先补上该协议；适配器 seam 支持把第二种协议加进来。
- **目录是快照。** 它的日期写在 `src/catalog.ts` 里，靠配置而非发版来修正；适配器没有任何地方假定它是当前的。
- **快速模式无法从外部证实。** 某个渠道是否透传 `service_tier` 属于管理端配置；插件只能发送该字段并报告回显的档位。
- **余额可能是 Key 级也可能是账号级。** new-api 究竟统计 API Key 自身额度还是账号总额度，取决于一个网关没有公开的服务端开关。卡片只标注它读到的东西，不声称是哪一种。
- **订阅余额需要第二组凭据。** 控制台链不接受模型 Key，所以插件另外要求面板用户 ID 与访问令牌，可用账号登录自动获取，也可以手动粘贴；不填就退回显示按量余额。其他控制台接口不在范围内。
- **登录是账号密码登录，不是 OAuth。** 站方可以开启 GitHub、LinuxDO、微信、Telegram 与 OIDC 登录，本部署全部关闭；而且 OAuth 需要浏览器回调，插件无法承载。支持的路径是账号密码加 2FA。
- **站方开启 Turnstile 后无法在插件里登录。** 人机校验只有浏览器能过，此时请改用手动填写令牌。
- **浏览器端文案内联在组件里（中文）。** Harness 期望产品文案走类型化语言字典，这需要 `@deepseek-ai/dsh-client-locale` 与 locale 注册，属于后续工作。
- **不支持多账号轮换。** 一个路由一个 Key；第二个账号就是第二个 profile 或第二个环境变量。

## 许可证

[MIT](LICENSE)。
