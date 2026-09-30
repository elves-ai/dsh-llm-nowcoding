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

import { useCallback, useEffect, useState, type ReactElement } from 'react'
import {
  NOWCODING_DEFAULT_BASE_URL,
  NOWCODING_SETTINGS_DEFAULTS,
  type NowCodingFastServiceTier,
} from '../settings-shared.ts'
import {
  NowCodingApiError,
  getNowCodingSettings,
  getQuota,
  isNowCodingApiKeyConfigured,
  isNowCodingPanelTokenConfigured,
  mutateNowCodingSettings,
  panelLogin,
  panelTwoFactorLogin,
  settingsViewOf,
  type NowCodingLoginView,
  type NowCodingQuotaView,
  type NowCodingSettingsEnvelope,
  type NowCodingSettingsOp,
} from './api.ts'
import css from './NowCodingSettingsSection.module.css'

/** Local drafts for the five editable controls. */
interface Drafts {
  apiKey: string
  baseURL: string
  fast: boolean
  fastServiceTier: NowCodingFastServiceTier
  quotaCard: boolean
  panelUserId: string
  panelToken: string
}

const INITIAL_DRAFTS: Drafts = {
  apiKey: '',
  baseURL: NOWCODING_DEFAULT_BASE_URL,
  fast: NOWCODING_SETTINGS_DEFAULTS.fast,
  fastServiceTier: NOWCODING_SETTINGS_DEFAULTS.fastServiceTier,
  quotaCard: NOWCODING_SETTINGS_DEFAULTS.quotaCard,
  panelUserId: '',
  panelToken: '',
}

/** The two wire spellings of the fast tier, in presentation order. */
const FAST_SERVICE_TIERS: readonly { value: NowCodingFastServiceTier; label: string; hint: string }[] = [
  { value: 'priority', label: 'priority', hint: '较早的写法，对未跟进改名的网关兼容性最好' },
  { value: 'fast', label: 'fast', hint: '当前写法，用于站方已支持 service_tier: fast 的渠道' },
]

/** Read the redacted document into editable drafts; the key draft stays blank. */
function draftsOf(envelope: NowCodingSettingsEnvelope): Drafts {
  const view = settingsViewOf(envelope)
  return {
    apiKey: '',
    baseURL: typeof view.baseURL === 'string' && view.baseURL.length > 0 ? view.baseURL : NOWCODING_DEFAULT_BASE_URL,
    fast: typeof view.fast === 'boolean' ? view.fast : NOWCODING_SETTINGS_DEFAULTS.fast,
    fastServiceTier: view.fastServiceTier ?? NOWCODING_SETTINGS_DEFAULTS.fastServiceTier,
    quotaCard: typeof view.quotaCard === 'boolean' ? view.quotaCard : NOWCODING_SETTINGS_DEFAULTS.quotaCard,
    panelUserId: view.panelUserId ?? '',
    // Write-only: the stored token never rides a response, so the draft starts blank.
    panelToken: '',
  }
}

/** Format an amount in the site's display currency. */
function formatMoney(amount: number, currency: string): string {
  if (!Number.isFinite(amount)) return '—'
  return `${currency === '' ? '¥' : currency}${amount.toFixed(2)}`
}

/** Format an epoch-ms instant as local `YYYY-MM-DD HH:mm:ss`. */
function formatTimestamp(at: number): string {
  if (!Number.isFinite(at) || at <= 0) return '—'
  const moment = new Date(at)
  const pad = (part: number): string => String(part).padStart(2, '0')
  return `${moment.getFullYear()}-${pad(moment.getMonth() + 1)}-${pad(moment.getDate())} ${pad(moment.getHours())}:${pad(moment.getMinutes())}:${pad(moment.getSeconds())}`
}

/** Chinese copy for the sign-in failures a user can act on. */
function loginMessageOf(error: unknown): string {
  const code = error instanceof NowCodingApiError ? error.code : ''
  switch (code) {
    case 'bad-credentials':
      return '账号或密码不正确；站方也可能已封禁该账号。'
    case 'two-factor-invalid':
      return '验证码不正确，请重新输入。'
    case 'two-factor-unavailable':
      return '验证会话已过期，请重新输入账号密码登录。'
    case 'turnstile-required':
      return '站方已开启 Turnstile 人机校验，插件无法完成这一步；请在控制台复制访问令牌后手动填入。'
    case 'token-unavailable':
      return '登录成功，但站方没有回读访问令牌；请在控制台的系统访问令牌页复制一个，手动填入下方。'
    case 'unreachable':
    case 'timeout':
    case 'gateway-error':
      return '无法连接 NowCoding 控制台，请检查网络后重试。'
    default:
      return messageOf(error)
  }
}

/** Human-readable error copy for one route failure. */
function messageOf(error: unknown): string {
  if (error instanceof NowCodingApiError && error.code === 'settings-conflict') {
    return '设置已在其他窗口被修改，已重新载入；请再次保存。'
  }
  return error instanceof Error ? error.message : String(error)
}

/**
 * Render the NowCoding settings page.
 * @returns the section element tree.
 */
export function NowCodingSettingsSection(): ReactElement | null {
  const [envelope, setEnvelope] = useState<NowCodingSettingsEnvelope | null>(null)
  const [drafts, setDrafts] = useState<Drafts>(INITIAL_DRAFTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [showPanelToken, setShowPanelToken] = useState(false)
  const [quota, setQuota] = useState<NowCodingQuotaView | null>(null)
  const [quotaLoading, setQuotaLoading] = useState(false)
  const [quotaError, setQuotaError] = useState<string | null>(null)
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginCode, setLoginCode] = useState('')
  const [loginChallenge, setLoginChallenge] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loginNotice, setLoginNotice] = useState<string | null>(null)

  const refreshQuota = useCallback(async (): Promise<void> => {
    setQuotaLoading(true)
    try {
      setQuota(await getQuota())
      setQuotaError(null)
    } catch (caught) {
      setQuotaError(messageOf(caught))
    } finally {
      setQuotaLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void getNowCodingSettings().then((next) => {
      if (cancelled) return
      setEnvelope(next)
      setDrafts(draftsOf(next))
      setLoading(false)
      void refreshQuota()
    }).catch((caught: unknown) => {
      if (cancelled) return
      setError(messageOf(caught))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [refreshQuota])

  const applyOps = async (ops: NowCodingSettingsOp[]): Promise<void> => {
    if (envelope === null || envelope.writable === false) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const next = await mutateNowCodingSettings(ops, envelope.revision)
      setEnvelope(next)
      setDrafts(draftsOf(next))
      setNotice('已保存，新配置立即用于下一次请求。')
      void refreshQuota()
    } catch (caught) {
      setError(messageOf(caught))
      // A conflict means another surface committed since this page read the
      // revision; adopt the fresh document so the next save lands.
      if (caught instanceof NowCodingApiError && caught.code === 'settings-conflict') {
        void getNowCodingSettings().then((next) => {
          setEnvelope(next)
          setDrafts(draftsOf(next))
        }).catch(() => undefined)
      }
    } finally {
      setSaving(false)
    }
  }

  /** Adopt a finished sign-in: drop the password, re-read the document, refresh the balance. */
  const adoptSignIn = async (view: NowCodingLoginView): Promise<void> => {
    if (view.status !== 'ok') return
    setLoginPassword('')
    setLoginCode('')
    setLoginChallenge(false)
    const next = await getNowCodingSettings()
    setEnvelope(next)
    setDrafts(draftsOf(next))
    const rotated = view.tokenSource === 'generated' ? '站方本次新签发了一个访问令牌。' : ''
    setLoginNotice(`已登录 ${view.username}（用户 ID ${view.userId}），面板令牌与用户 ID 已写入配置。${rotated}`)
    void refreshQuota()
  }

  /** Exchange the account credentials for the console credential pair. */
  const signIn = async (): Promise<void> => {
    setLoggingIn(true)
    setLoginError(null)
    setLoginNotice(null)
    try {
      const view = await panelLogin(loginUsername.trim(), loginPassword)
      if (view.status === 'two-factor-required') {
        setLoginChallenge(true)
        // The Host holds the half-finished session, so the password is not needed again.
        setLoginPassword('')
        setLoginNotice('该账号开启了两步验证，请输入认证器应用中的验证码。')
        return
      }
      await adoptSignIn(view)
    } catch (caught) {
      setLoginError(loginMessageOf(caught))
    } finally {
      setLoggingIn(false)
    }
  }

  /** Answer the challenge with the code the user typed. */
  const submitLoginCode = async (): Promise<void> => {
    setLoggingIn(true)
    setLoginError(null)
    setLoginNotice(null)
    try {
      await adoptSignIn(await panelTwoFactorLogin(loginCode.trim()))
    } catch (caught) {
      setLoginError(loginMessageOf(caught))
    } finally {
      setLoggingIn(false)
    }
  }

  /** Commit every draft in one revision-checked edit. */
  const save = (): void => {
    const baseURL = drafts.baseURL.trim()
    const apiKey = drafts.apiKey.trim()
    const ops: NowCodingSettingsOp[] = []
    if (apiKey !== '') ops.push({ op: 'set', path: ['apiKey'], value: apiKey })
    if (baseURL === '') ops.push({ op: 'unset', path: ['baseURL'] })
    else ops.push({ op: 'set', path: ['baseURL'], value: baseURL })
    ops.push({ op: 'set', path: ['fast'], value: drafts.fast })
    ops.push({ op: 'set', path: ['fastServiceTier'], value: drafts.fastServiceTier })
    ops.push({ op: 'set', path: ['quotaCard'], value: drafts.quotaCard })
    const panelUserId = drafts.panelUserId.trim()
    if (panelUserId === '') ops.push({ op: 'unset', path: ['panelUserId'] })
    else ops.push({ op: 'set', path: ['panelUserId'], value: panelUserId })
    // Blank means "keep the stored token"; Clear is the only way to remove it.
    const panelToken = drafts.panelToken.trim()
    if (panelToken !== '') ops.push({ op: 'set', path: ['panelToken'], value: panelToken })
    void applyOps(ops)
  }

  if (loading) return <div className={css.section}><p className={css.hint}>正在加载 NowCoding 配置…</p></div>
  if (envelope === null) {
    return (
      <div className={css.section}>
        <p className={css.intro}>NowCoding 提供方的 API Key、端点与快速模式设置。</p>
        <p className={css.error} role="alert">{error ?? '无法读取 NowCoding 配置。'}</p>
      </div>
    )
  }

  const configured = isNowCodingApiKeyConfigured(envelope)
  const panelConfigured = isNowCodingPanelTokenConfigured(envelope)
  const disabled = envelope.writable === false || saving
  const snapshot = quota === null ? null : quota.snapshot

  return (
    <div className={css.section}>
      <p className={css.intro}>NowCoding 提供方的 API Key、端点，以及 GPT 快速模式与侧栏余量卡片的开关。保存后立即生效。</p>

      <div className={css.card}>
        <div className={css.row}>
          <div className={css.rowText}>
            <label className={css.title} htmlFor="nowcoding-api-key">API Key</label>
            <span className={css.desc}>密钥不会回显；留空保存表示保持当前值，未配置时回退 Host 的 apiKeyEnv 环境变量。</span>
          </div>
          <div className={css.control}>
            <input
              id="nowcoding-api-key"
              className={css.input}
              type={showApiKey ? 'text' : 'password'}
              autoComplete="off"
              value={drafts.apiKey}
              placeholder={configured ? '已配置（留空保持不变）' : 'sk-...'}
              disabled={disabled}
              onChange={event => { setDrafts({ ...drafts, apiKey: event.currentTarget.value }) }}
            />
            <button
              type="button"
              className={css.iconButton}
              aria-label={showApiKey ? '隐藏 API Key' : '显示 API Key'}
              title={showApiKey ? '隐藏 API Key' : '显示 API Key'}
              disabled={disabled}
              onClick={() => { setShowApiKey(previous => !previous) }}
            >
              {showApiKey ? '隐藏' : '显示'}
            </button>
            <span className={configured ? css.badgeOn : css.badgeOff}>{configured ? '已配置' : '未配置'}</span>
            {configured && (
              <button
                type="button"
                className={css.button}
                disabled={disabled}
                onClick={() => { void applyOps([{ op: 'unset', path: ['apiKey'] }]) }}
              >
                清除
              </button>
            )}
          </div>
        </div>

        <div className={css.row}>
          <div className={css.rowText}>
            <label className={css.title} htmlFor="nowcoding-base-url">Base URL</label>
            <span className={css.desc}>端点基址，默认 {NOWCODING_DEFAULT_BASE_URL}；模型、余量与价格请求都基于它拼接。</span>
          </div>
          <div className={css.control}>
            <input
              id="nowcoding-base-url"
              className={css.input}
              type="text"
              value={drafts.baseURL}
              placeholder={NOWCODING_DEFAULT_BASE_URL}
              disabled={disabled}
              onChange={event => { setDrafts({ ...drafts, baseURL: event.currentTarget.value }) }}
            />
          </div>
        </div>

        <div className={css.row}>
          <div className={css.rowText}>
            <span className={css.title}>启用 GPT 快速模式（fast）</span>
            <span className={css.desc}>开启后，具备快速档的模型会在请求里带上 service_tier。需要站方渠道开启 allow_service_tier 透传，否则该参数会被静默剥离；快速档计费高于标准档。</span>
          </div>
          <div className={css.control}>
            <input
              type="checkbox"
              className={css.checkbox}
              checked={drafts.fast}
              disabled={disabled}
              aria-label="启用 GPT 快速模式（fast）"
              onChange={event => { setDrafts({ ...drafts, fast: event.currentTarget.checked }) }}
            />
          </div>
        </div>

        <div className={css.row}>
          <div className={css.rowText}>
            <span className={css.title}>fast 的 wire 取值</span>
            <span className={css.desc}>请求里 service_tier 的实际写法，只在快速模式开启时发送。</span>
          </div>
          <div className={css.control}>
            <div className={css.segmented} role="group" aria-label="fast 的 wire 取值">
              {FAST_SERVICE_TIERS.map(tier => (
                <button
                  key={tier.value}
                  type="button"
                  className={drafts.fastServiceTier === tier.value ? `${css.segment} ${css.segmentActive}` : css.segment}
                  aria-pressed={drafts.fastServiceTier === tier.value}
                  title={tier.hint}
                  disabled={disabled}
                  onClick={() => { setDrafts({ ...drafts, fastServiceTier: tier.value }) }}
                >
                  {tier.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={css.row}>
          <div className={css.rowText}>
            <span className={css.title}>在左侧栏显示余量卡片</span>
            <span className={css.desc}>卡片位于左侧栏底部、设置入口上方，按固定间隔读取余量。</span>
          </div>
          <div className={css.control}>
            <input
              type="checkbox"
              className={css.checkbox}
              checked={drafts.quotaCard}
              disabled={disabled}
              aria-label="在左侧栏显示余量卡片"
              onChange={event => { setDrafts({ ...drafts, quotaCard: event.currentTarget.checked }) }}
            />
          </div>
        </div>
      </div>

      <div className={css.card}>
        <p className={css.cardIntro}>订阅（月卡）余量需要控制台凭据：控制台接口不接受 sk- 开头的模型 Key。用下面的账号登录会自动填入这两项，也可以手动填写；两项都留空时，卡片显示按量余额。</p>

        <div className={css.row}>
          <div className={css.rowText}>
            <label className={css.title} htmlFor="nowcoding-panel-user">面板用户 ID</label>
            <span className={css.desc}>控制台里的数字用户 ID，连同面板令牌一起作为 New-Api-User 头发送。</span>
          </div>
          <div className={css.control}>
            <input
              id="nowcoding-panel-user"
              className={css.input}
              type="text"
              autoComplete="off"
              value={drafts.panelUserId}
              placeholder="例如 8893"
              disabled={disabled}
              onChange={event => { setDrafts({ ...drafts, panelUserId: event.currentTarget.value }) }}
            />
          </div>
        </div>

        <div className={css.row}>
          <div className={css.rowText}>
            <label className={css.title} htmlFor="nowcoding-panel-token">面板访问令牌</label>
            <span className={css.desc}>在控制台的系统访问令牌页生成。读取订阅额度时用它，不会回显；留空保存表示保持当前值。</span>
          </div>
          <div className={css.control}>
            <input
              id="nowcoding-panel-token"
              className={css.input}
              type={showPanelToken ? 'text' : 'password'}
              autoComplete="off"
              value={drafts.panelToken}
              placeholder={panelConfigured ? '已配置（留空保持不变）' : '未配置'}
              disabled={disabled}
              onChange={event => { setDrafts({ ...drafts, panelToken: event.currentTarget.value }) }}
            />
            <button
              type="button"
              className={css.iconButton}
              aria-label={showPanelToken ? '隐藏面板访问令牌' : '显示面板访问令牌'}
              title={showPanelToken ? '隐藏面板访问令牌' : '显示面板访问令牌'}
              disabled={disabled}
              onClick={() => { setShowPanelToken(previous => !previous) }}
            >
              {showPanelToken ? '隐藏' : '显示'}
            </button>
            <span className={panelConfigured ? css.badgeOn : css.badgeOff}>{panelConfigured ? '已配置' : '未配置'}</span>
            {panelConfigured && (
              <button
                type="button"
                className={css.button}
                disabled={disabled}
                onClick={() => { void applyOps([{ op: 'unset', path: ['panelToken'] }]) }}
              >
                清除
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={css.card}>
        <p className={css.cardIntro}>用 NowCoding 账号登录，自动获取上面的控制台凭据：密码只随这一次登录请求发出、不写入配置，换到的访问令牌由 Host 直接写进配置、不回传浏览器。</p>

        <div className={css.row}>
          <div className={css.rowText}>
            <label className={css.title} htmlFor="nowcoding-login-username">账号</label>
            <span className={css.desc}>站方控制台的用户名或邮箱。</span>
          </div>
          <div className={css.control}>
            <input
              id="nowcoding-login-username"
              className={css.input}
              type="text"
              autoComplete="username"
              value={loginUsername}
              disabled={disabled || loggingIn}
              onChange={event => { setLoginUsername(event.currentTarget.value) }}
            />
          </div>
        </div>

        <div className={css.row}>
          <div className={css.rowText}>
            <label className={css.title} htmlFor="nowcoding-login-password">密码</label>
            <span className={css.desc}>只用于本次登录换取令牌；登录成功后即从页面清除。</span>
          </div>
          <div className={css.control}>
            <input
              id="nowcoding-login-password"
              className={css.input}
              type="password"
              autoComplete="current-password"
              value={loginPassword}
              disabled={disabled || loggingIn}
              onKeyDown={event => { if (event.key === 'Enter') void signIn() }}
              onChange={event => { setLoginPassword(event.currentTarget.value) }}
            />
          </div>
        </div>

        {loginChallenge && (
          <div className={css.row}>
            <div className={css.rowText}>
              <label className={css.title} htmlFor="nowcoding-login-code">两步验证码</label>
              <span className={css.desc}>认证器应用的 6 位验证码，或一个 8 位备用码。</span>
            </div>
            <div className={css.control}>
              <input
                id="nowcoding-login-code"
                className={css.input}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={loginCode}
                disabled={disabled || loggingIn}
                onKeyDown={event => { if (event.key === 'Enter') void submitLoginCode() }}
                onChange={event => { setLoginCode(event.currentTarget.value) }}
              />
            </div>
          </div>
        )}

        <div className={css.row}>
          <div className={css.rowText}>
            <span className={css.title}>获取面板凭据</span>
            <span className={css.desc}>登录成功后订阅余量与按量余额立即可读。站方若开启 Turnstile 人机校验，这一步在插件里无法完成，请改用手动填写。</span>
          </div>
          <div className={css.control}>
            <button
              type="button"
              className={css.buttonPrimary}
              disabled={disabled || loggingIn || (loginChallenge ? loginCode.trim() === '' : loginUsername.trim() === '' || loginPassword === '')}
              onClick={() => { void (loginChallenge ? submitLoginCode() : signIn()) }}
            >
              {loggingIn ? '登录中…' : loginChallenge ? '提交验证码' : '登录'}
            </button>
          </div>
        </div>

        {loginError !== null && <p className={css.error} role="alert">{loginError}</p>}
        {loginNotice !== null && <p className={css.notice} role="status">{loginNotice}</p>}
      </div>

      <div className={css.card}>
        <div className={css.row}>
          <div className={css.rowText}>
            <span className={css.title}>余量</span>
            <span className={css.desc}>当前 API Key 的额度余额，读取自站方的计费接口。</span>
          </div>
          <div className={css.control}>
            <button type="button" className={css.button} disabled={quotaLoading} onClick={() => { void refreshQuota() }}>
              {quotaLoading ? '刷新中…' : '刷新'}
            </button>
          </div>
        </div>
        <div className={css.row}>
          <div className={css.quotaBody}>
            {snapshot !== null && (
              <div className={css.quotaGrid}>
                <span className={css.quotaLabel}>剩余</span>
                <span className={css.quotaValue}>{snapshot.unlimited ? '不限额度' : formatMoney(snapshot.remaining, quota?.currency ?? '')}</span>
                <span className={css.quotaLabel}>总额度</span>
                <span className={css.quotaValue}>{snapshot.unlimited ? '不限额度' : formatMoney(snapshot.total, quota?.currency ?? '')}</span>
                <span className={css.quotaLabel}>已用</span>
                <span className={css.quotaValue}>{snapshot.unlimited ? '—' : formatMoney(snapshot.used, quota?.currency ?? '')}</span>
                {snapshot.accessUntil > 0 && (
                  <>
                    <span className={css.quotaLabel}>额度到期</span>
                    <span className={css.quotaValue}>{formatTimestamp(snapshot.accessUntil)}</span>
                  </>
                )}
                <span className={css.quotaLabel}>抓取时间</span>
                <span className={css.quotaValue}>{formatTimestamp(snapshot.fetchedAt)}</span>
              </div>
            )}
            {quotaError !== null && <p className={css.error} role="alert">{quotaError}</p>}
            {quotaError === null && snapshot === null && (
              <p className={css.hint}>{quotaLoading ? '正在读取余量…' : '尚未配置 API Key：先在上方保存一个密钥，或让 Host 的 apiKeyEnv 指向一个环境变量。'}</p>
            )}
          </div>
        </div>
      </div>

      {error !== null && <p className={css.error} role="alert">{error}</p>}
      {notice !== null && <p className={css.notice} role="status">{notice}</p>}

      <div className={css.actions}>
        <button type="button" className={css.button} disabled={disabled} onClick={() => { void getNowCodingSettings().then((next) => { setEnvelope(next); setDrafts(draftsOf(next)); setNotice('已重置为当前保存的配置。') }).catch((caught: unknown) => { setError(messageOf(caught)) }) }}>重置</button>
        <button type="button" className={css.buttonPrimary} disabled={disabled} onClick={save}>
          {saving ? '保存中…' : '保存'}
        </button>
      </div>
    </div>
  )
}
