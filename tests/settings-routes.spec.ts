import { describe, expect, it } from 'vitest'
import type { SettingsDescriptor, SettingsPathOp } from '@deepseek-ai/dsh-settings'
import type { NowCodingResolvedOptions } from '../src/config.ts'
import { createPanelLogin } from '../src/panel-login.ts'
import {
  dispatchNowCodingMethod,
  isTrustedApiRequest,
  type NowCodingRouteDeps,
  type NowCodingSettingsFace,
} from '../src/settings-routes.ts'
import {
  NOWCODING_DISPLAY_CURRENCY_SYMBOL,
  NOWCODING_SETTINGS_NAMESPACE,
} from '../src/settings-shared.ts'
import { answer, transport, type Sent } from './console-fetch.ts'

/** A keyless route: every method here either answers from settings or from the console. */
const OPTIONS: NowCodingResolvedOptions = {
  apiKey: '',
  baseURL: 'https://nowcoding.ai/v1',
  displayName: 'NowCoding',
  fast: false,
  fastServiceTier: 'priority',
  catalog: [],
  quotaCard: true,
  panelToken: '',
  panelUserId: '',
  quotaRefreshSeconds: 300,
  requestTimeoutMs: 300_000,
  settingsNs: NOWCODING_SETTINGS_NAMESPACE,
}

/** A console account document, shaped as the live gateway answers it. */
const account = { success: true, message: '', data: { id: 8893, username: 'demo', role: 1 } }

/** The session cookie a successful login sets. */
const session = 'session=abc123; Path=/; HttpOnly'

/** The namespace key, branded the way the settings seam declares a descriptor. */
const NS = NOWCODING_SETTINGS_NAMESPACE as SettingsDescriptor['ns']

/** One settings write the route performed. */
interface Write {
  ops: readonly SettingsPathOp[]
  expectedRevision: number | undefined
}

/** A settings seam double that records writes and exposes the resulting document. */
function settingsDouble(): { face: NowCodingSettingsFace; writes: Write[]; value: () => Record<string, unknown> } {
  const writes: Write[] = []
  let value: Record<string, unknown> = {}
  let revision = 3
  const face: NowCodingSettingsFace = {
    writable: true,
    describe: (): SettingsDescriptor[] => [{
      ns: NS,
      value,
      revision,
      applies: 'live',
      secrets: [],
      autoGenerate: false,
      schema: undefined,
    }],
    mutate: async (_ns, ops, expectedRevision) => {
      writes.push({ ops, expectedRevision })
      const next = { ...value }
      for (const op of ops) {
        const field = op.path[0] ?? ''
        if (op.op === 'set') next[field] = op.value
        else delete next[field]
      }
      value = next
      revision += 1
    },
  }
  return { face, writes, value: () => value }
}

/** Route dependencies over a recording console transport. */
function depsOf(script: (sent: Sent) => Response) {
  const settings = settingsDouble()
  const { fetchImpl, sent } = transport(script)
  const login = createPanelLogin({ baseURL: () => OPTIONS.baseURL, fetchImpl })
  const deps: NowCodingRouteDeps = { settings: settings.face, options: OPTIONS, login }
  return { deps, settings, sent }
}

/** Console answers for a plain sign-in whose account already holds a token. */
function tokenConsole(request: Sent): Response {
  if (request.path === '/api/user/login') return answer(account, [session])
  return answer({ success: true, data: 'tok-42' })
}

describe('the fenced route dispatch', () => {
  it('stores the console credential and answers without the token', async () => {
    const { deps, settings } = depsOf(tokenConsole)
    const result = await dispatchNowCodingMethod(deps, 'panel.login', { username: 'demo', password: 'hunter2' })

    expect(result).toEqual({ status: 'ok', userId: '8893', username: 'demo', tokenSource: 'read' })
    expect(settings.value()).toEqual({ panelToken: 'tok-42', panelUserId: '8893' })
    expect(settings.writes).toHaveLength(1)
    expect(settings.writes[0]?.expectedRevision).toBeUndefined()
    expect(JSON.stringify(result)).not.toContain('tok-42')
    expect(JSON.stringify(settings.writes)).not.toContain('hunter2')
  })

  it('writes nothing until the second factor lands', async () => {
    const { deps, settings, sent } = depsOf((request) => {
      if (request.path === '/api/user/login') return answer({ success: true, data: { require_2fa: true } }, [session])
      if (request.path === '/api/user/login/2fa') return answer(account)
      return answer({ success: true, data: 'tok-42' })
    })

    await expect(dispatchNowCodingMethod(deps, 'panel.login', { username: 'demo', password: 'hunter2' }))
      .resolves.toEqual({ status: 'two-factor-required' })
    expect(settings.writes).toHaveLength(0)

    await expect(dispatchNowCodingMethod(deps, 'panel.two-factor', { code: '123456' }))
      .resolves.toEqual({ status: 'ok', userId: '8893', username: 'demo', tokenSource: 'read' })
    expect(settings.value()).toEqual({ panelToken: 'tok-42', panelUserId: '8893' })
    expect(sent.map(request => request.path)).toEqual([
      '/api/user/login',
      '/api/user/login/2fa',
      '/api/user/self/access-token',
    ])
  })

  it('surfaces a refused credential as its own code', async () => {
    const { deps } = depsOf(() => answer({ success: false, message: 'Username or password is incorrect' }))
    await expect(dispatchNowCodingMethod(deps, 'panel.login', { username: 'demo', password: 'wrong' }))
      .rejects.toMatchObject({ code: 'bad-credentials' })
  })

  it('refuses a sign-in payload that is missing a field', async () => {
    const { deps, sent } = depsOf(tokenConsole)
    await expect(dispatchNowCodingMethod(deps, 'panel.login', { username: 'demo' }))
      .rejects.toMatchObject({ code: 'bad-request' })
    expect(sent).toHaveLength(0)
  })

  it('reports no snapshot before any credential is configured', async () => {
    const { deps } = depsOf(tokenConsole)
    await expect(dispatchNowCodingMethod(deps, 'quota.get', {}))
      .resolves.toEqual({
        enabled: true,
        snapshot: null,
        currency: NOWCODING_DISPLAY_CURRENCY_SYMBOL,
        refreshSeconds: 300,
      })
  })

  it('refuses a settings field outside the schema', async () => {
    const { deps } = depsOf(tokenConsole)
    await expect(dispatchNowCodingMethod(deps, 'settings.mutate', {
      ops: [{ op: 'set', path: ['apiKeyEnv'], value: 'OTHER_KEY' }],
    })).rejects.toMatchObject({ code: 'bad-request' })
  })

  it('names the missing settings service instead of failing obscurely', async () => {
    const { deps } = depsOf(tokenConsole)
    await expect(dispatchNowCodingMethod({ ...deps, settings: undefined }, 'settings.get', {}))
      .rejects.toMatchObject({ code: 'settings-rejected', status: 503 })
  })

  it('refuses an unknown method', async () => {
    const { deps } = depsOf(tokenConsole)
    await expect(dispatchNowCodingMethod(deps, 'panel.logout', {})).rejects.toMatchObject({ code: 'not-found' })
  })
})

describe('the browser-trust fence', () => {
  it('accepts a loopback host', () => {
    expect(isTrustedApiRequest({ host: '127.0.0.1:19387' }, [])).toBe(true)
    expect(isTrustedApiRequest({ host: 'localhost:19387' }, [])).toBe(true)
  })

  it('accepts a configured trusted host, with or without its port', () => {
    expect(isTrustedApiRequest({ host: 'box.local:8080' }, ['box.local:8080'])).toBe(true)
    expect(isTrustedApiRequest({ host: 'box.local:8080' }, ['box.local'])).toBe(true)
  })

  it('refuses a foreign or missing host', () => {
    expect(isTrustedApiRequest({ host: 'evil.example' }, [])).toBe(false)
    expect(isTrustedApiRequest({}, [])).toBe(false)
  })

  it('refuses a cross-site fetch and a foreign origin', () => {
    expect(isTrustedApiRequest({ host: '127.0.0.1:19387', 'sec-fetch-site': 'cross-site' }, [])).toBe(false)
    expect(isTrustedApiRequest({ host: '127.0.0.1:19387', origin: 'https://evil.example' }, [])).toBe(false)
    expect(isTrustedApiRequest({ host: '127.0.0.1:19387', origin: 'http://127.0.0.1:19387' }, [])).toBe(true)
  })
})
