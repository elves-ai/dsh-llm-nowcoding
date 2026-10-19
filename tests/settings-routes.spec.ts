import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { SettingsDescriptor, SettingsPathOp } from '@deepseek-ai/dsh-settings'
import { effectiveCatalog, type NowCodingResolvedOptions } from '../src/config.ts'
import { resolveModelInfo, listSelectableModels } from '../src/models.ts'
import { createPanelLogin } from '../src/panel-login.ts'
import { createSessionFastStore } from '../src/session-fast.ts'
import {
  dispatchNowCodingMethod,
  isTrustedApiRequest,
  registerNowCodingSettingsRoutes,
  type NowCodingRouteDeps,
  type NowCodingSettingsFace,
} from '../src/settings-routes.ts'
import {
  NOWCODING_DISPLAY_CURRENCY_SYMBOL,
  NOWCODING_SETTINGS_NAMESPACE,
} from '../src/settings-shared.ts'
import { answer, status, transport, type Sent } from './console-fetch.ts'

/** A keyless route: every method here either answers from settings or from the console. */
const OPTIONS: NowCodingResolvedOptions = {
  apiKey: '',
  baseURL: 'https://nowcoding.ai/v1',
  displayName: 'NowCoding',
  fast: false,
  fastServiceTier: 'priority',
  catalog: [],
  visibleModels: [],
  quotaCard: true,
  panelToken: '',
  panelUserId: '',
  panelSession: '',
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
      const next = structuredClone(value)
      for (const op of ops) {
        let parent: any = next
        for (const key of op.path.slice(0, -1)) parent = parent[key] ??= {}
        const field = op.path.at(-1)!
        if (op.op === 'set') parent[field] = op.value
        else delete parent[field]
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
  it('stores the console credential and answers without it', async () => {
    const { deps, settings } = depsOf(tokenConsole)
    const result = await dispatchNowCodingMethod(deps, 'panel.login', { username: 'demo', password: 'hunter2' })

    expect(result).toEqual({ status: 'ok', userId: '8893', username: 'demo', tokenSource: 'read' })
    expect(settings.value()).toEqual({
      panelToken: 'tok-42',
      panelUserId: '8893',
      panelSession: 'session=abc123',
    })
    expect(settings.writes).toHaveLength(1)
    expect(settings.writes[0]?.expectedRevision).toBeUndefined()
    expect(JSON.stringify(result)).not.toContain('tok-42')
    expect(JSON.stringify(result)).not.toContain('abc123')
    expect(JSON.stringify(settings.writes)).not.toContain('hunter2')
  })

  it('stores the sign-in session alone when no token is readable', async () => {
    const { deps, settings, sent } = depsOf((request) => {
      if (request.path === '/api/user/login') return answer(account, [session])
      return answer({ success: false, message: 'Unauthorized, invalid access token' })
    })
    const result = await dispatchNowCodingMethod(deps, 'panel.login', { username: 'demo', password: 'hunter2' })

    expect(result).toEqual({ status: 'ok', userId: '8893', username: 'demo' })
    expect(settings.value()).toEqual({ panelUserId: '8893', panelSession: 'session=abc123' })
    expect(sent.map(request => request.path)).not.toContain('/api/user/token')
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
    expect(settings.value()).toEqual({
      panelToken: 'tok-42',
      panelUserId: '8893',
      panelSession: 'session=abc123',
    })
    expect(sent.map(request => request.path)).toEqual([
      '/api/user/login',
      '/api/user/login/2fa',
      '/api/agreement/accept',
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

  it('accepts the sign-in session as a writable settings field', async () => {
    const { deps, settings } = depsOf(tokenConsole)
    await dispatchNowCodingMethod(deps, 'settings.mutate', {
      ops: [{ op: 'set', path: ['panelSession'], value: 'session=abc123' }],
    })
    expect(settings.value()).toMatchObject({ panelSession: 'session=abc123' })
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

describe('per-model capability writes', () => {
  it('writes image input through both supported catalog paths', async () => {
    const { deps, settings } = depsOf(tokenConsole)
    for (const input of [['text'], ['text', 'image']]) {
      await dispatchNowCodingMethod(deps, 'settings.mutate', { ops: [{ op: 'set', path: ['modelOverrides', 'gpt-5.4', 'input'], value: input }] })
      expect(resolveModelInfo({ provider: 'nowcoding', model: 'gpt-5.4', catalog: effectiveCatalog(settings.value()) }).inputModalities).toEqual(input)
    }
    await settings.face.mutate(NS, [{ op: 'set', path: ['models'], value: [{ id: 'custom', contextWindow: 4096, maxTokens: 1024 }] }])
    await dispatchNowCodingMethod(deps, 'settings.mutate', { ops: [{ op: 'set', path: ['models', '0', 'input'], value: ['text', 'image'] }] })
    expect(effectiveCatalog(settings.value())[0]?.input).toEqual(['text', 'image'])
  })
  it('persists exact model-id leaves without replacing unrelated metadata and applies them to resolution', async () => {
    const { deps, settings } = depsOf(tokenConsole)
    const id = 'gpt-6.1-sol'
    await settings.face.mutate(NS, [{ op: 'set', path: ['modelOverrides'], value: { [id]: { input: ['text', 'image'], description: 'keep' }, other: { fast: false } } }])
    await dispatchNowCodingMethod(deps, 'settings.mutate', { expectedRevision: 4, ops: [
      { op: 'set', path: ['modelOverrides', id, 'contextWindow'], value: 200000 },
      { op: 'set', path: ['modelOverrides', id, 'maxTokens'], value: 8192 },
      { op: 'set', path: ['modelOverrides', id, 'fast'], value: false },
    ] })
    expect(settings.value()).toMatchObject({ modelOverrides: { [id]: { contextWindow: 200000, maxTokens: 8192, fast: false, input: ['text', 'image'], description: 'keep' }, other: { fast: false } } })
    expect(settings.writes.at(-1)?.expectedRevision).toBe(4)
    const catalog = effectiveCatalog(settings.value())
    expect(resolveModelInfo({ provider: 'nowcoding', model: id, catalog })).toMatchObject({ context: { contextWindow: 200000 }, defaultMaxTokens: 8192, inputModalities: ['text', 'image'] })
    expect(listSelectableModels('nowcoding', catalog).some(model => model.id === id + '-fast')).toBe(false)
  })

  it('edits explicit models by string array index, preserving the rest of the entry', async () => {
    const { deps, settings } = depsOf(tokenConsole)
    await settings.face.mutate(NS, [{ op: 'set', path: ['models'], value: [{ id: 'custom.v1', contextWindow: 4096, maxTokens: 1024, input: ['text'], description: 'keep' }] }])
    await dispatchNowCodingMethod(deps, 'settings.mutate', { ops: [{ op: 'set', path: ['models', '0', 'fast'], value: true }] })
    const catalog = effectiveCatalog(settings.value())
    expect(catalog[0]).toMatchObject({ id: 'custom.v1', description: 'keep', fast: true })
    expect(listSelectableModels('nowcoding', catalog).map(model => model.id)).toEqual(['custom.v1'])
    await expect(dispatchNowCodingMethod(deps, 'settings.mutate', { ops: [{ op: 'set', path: ['models', '1', 'fast'], value: true }] })).rejects.toMatchObject({ code: 'bad-request' })
    await expect(dispatchNowCodingMethod(deps, 'settings.mutate', { ops: [{ op: 'set', path: ['modelOverrides', 'custom.v1', 'fast'], value: true }] })).rejects.toMatchObject({ code: 'bad-request' })
  })

  it('rejects unsafe paths, metadata escalation and invalid numeric or boolean values before writing', async () => {
    for (const [path, value] of [
      [['modelOverrides', '__proto__', 'fast'], true], [['modelOverrides', 'constructor', 'fast'], true],
      [['modelOverrides', 'prototype', 'fast'], true], [['modelOverrides', 'model', 'input'], ['image']],
      [['modelOverrides', 'model', 'fast'], 'true'], [['modelOverrides', 'model', 'maxTokens'], 0],
      [['modelOverrides', 'model', 'contextWindow'], 1.5], [['modelOverrides', 'model', 'contextWindow'], Infinity],
      [['models', '-1', 'fast'], true], [['models', '0.5', 'fast'], true], [['models', '0', 'id'], 'changed'],
      [['modelOverrides'], {}],
      [['modelOverrides', 'model', 'input'], []], [['modelOverrides', 'model', 'input'], ['text', 'audio']],
      [['modelOverrides', 'model', 'input'], ['text', 'image', 'image']], [['modelOverrides', 'model', 'input'], true],
    ]) {
      const { deps, settings } = depsOf(tokenConsole)
      await expect(dispatchNowCodingMethod(deps, 'settings.mutate', { ops: [{ op: 'set', path, value }] })).rejects.toMatchObject({ code: 'bad-request' })
      expect(settings.writes).toHaveLength(0)
    }
  })

  it('validates combined limits after all edits, regardless of order', async () => {
    const { deps, settings } = depsOf(tokenConsole)
    deps.options = { ...deps.options, catalog: effectiveCatalog({}) }
    await expect(dispatchNowCodingMethod(deps, 'settings.mutate', { ops: [{ op: 'set', path: ['modelOverrides', 'gpt-6.1-sol', 'contextWindow'], value: 100 }] })).rejects.toMatchObject({ code: 'bad-request' })
    expect(settings.writes).toHaveLength(0)
    await dispatchNowCodingMethod(deps, 'settings.mutate', { ops: [
      { op: 'set', path: ['modelOverrides', 'gpt-6.1-sol', 'contextWindow'], value: 100 },
      { op: 'set', path: ['modelOverrides', 'gpt-6.1-sol', 'maxTokens'], value: 10 },
    ] })
    expect(settings.writes).toHaveLength(1)
  })
})

describe('models.list', () => {
  /** A configured route: the key fetches the listing, the catalog decides `known`. */
  const MODEL_OPTIONS: NowCodingResolvedOptions = {
    ...OPTIONS,
    apiKey: 'sk-test',
    catalog: [
      { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', contextWindow: 400_000, maxTokens: 128_000, input: ['text'], fast: true },
      { id: 'gpt-6-astra', name: 'GPT-6 Astra', contextWindow: 400_000, maxTokens: 128_000, input: ['text'] },
    ],
  }

  /** Route dependencies over a recording gateway transport. */
  function modelDeps(script: (sent: Sent) => Response) {
    const settings = settingsDouble()
    const { fetchImpl, sent } = transport(script)
    const login = createPanelLogin({ baseURL: () => OPTIONS.baseURL, fetchImpl })
    const deps: NowCodingRouteDeps = { settings: settings.face, options: MODEL_OPTIONS, login, fetchImpl }
    return { deps, sent }
  }

  it('refuses to fetch before an API key is configured', async () => {
    const { deps } = depsOf(tokenConsole)
    await expect(dispatchNowCodingMethod(deps, 'models.list', {}))
      .rejects.toMatchObject({ code: 'unauthorized', status: 401 })
  })

  it('annotates the key-scoped listing with catalog knowledge', async () => {
    const { deps, sent } = modelDeps(() => answer({
      object: 'list',
      success: true,
      data: [
        { id: 'gpt-5.6-sol', object: 'model', owned_by: 'custom' },
        { id: 'brand-new-model', object: 'model', owned_by: 'custom' },
      ],
    }))
    await expect(dispatchNowCodingMethod(deps, 'models.list', {})).resolves.toEqual({
      models: [
        { id: 'gpt-5.6-sol', ownedBy: 'custom', known: true, configuration: { contextWindow: 400_000, maxTokens: 128_000, fast: true, input: ['text'] } },
        { id: 'brand-new-model', ownedBy: 'custom', known: false },
      ],
    })
    expect(sent[0]?.path).toBe('/v1/models')
    expect(sent[0]?.headers.get('authorization')).toBe('Bearer sk-test')
  })

  it('refuses the listing when the gateway rejects the key', async () => {
    const { deps } = modelDeps(() => status(401))
    await expect(dispatchNowCodingMethod(deps, 'models.list', {}))
      .rejects.toMatchObject({ name: 'NowCodingModelsError', code: 'unauthorized' })
  })

  it('reports exactly what the conversation picker serves', async () => {
    const { deps } = modelDeps(() => status(200))
    await expect(dispatchNowCodingMethod(deps, 'models.served', {})).resolves.toEqual({
      models: [
        { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol' },
        { id: 'gpt-6-astra', name: 'GPT-6 Astra' },
      ],
    })
  })

  it('reports effective fast capability independently of picker visibility without network I/O', async () => {
    const { deps, sent } = modelDeps(() => { throw new Error('unexpected network') })
    deps.options = { ...deps.options, visibleModels: ['gpt-6-astra'] }
    await expect(dispatchNowCodingMethod(deps, 'models.fast', {})).resolves.toEqual({ models: ['gpt-5.6-sol'] })
    deps.options = { ...deps.options, catalog: deps.options.catalog.map(entry => ({ ...entry, fast: false })) }
    await expect(dispatchNowCodingMethod(deps, 'models.fast', {})).resolves.toEqual({ models: [] })
    expect(sent).toHaveLength(0)
  })

  it('stores a visibleModels allowlist through the settings seam', async () => {
    const { deps, settings } = depsOf(tokenConsole)
    await dispatchNowCodingMethod(deps, 'settings.mutate', {
      ops: [{ op: 'set', path: ['visibleModels'], value: ['gpt-5.6-sol'] }],
    })
    expect(settings.value()).toMatchObject({ visibleModels: ['gpt-5.6-sol'] })
  })

  it('refuses a visibleModels value that is not an array of ids', async () => {
    const { deps } = depsOf(tokenConsole)
    await expect(dispatchNowCodingMethod(deps, 'settings.mutate', {
      ops: [{ op: 'set', path: ['visibleModels'], value: 'gpt-5.6-sol' }],
    })).rejects.toMatchObject({ code: 'bad-request' })
  })
})

describe('session fast mode', () => {
  it('stores mode separately from model selection and provider settings, isolated by session and model', async () => {
    const { deps, settings } = depsOf(tokenConsole)
    deps.sessionFast = createSessionFastStore()
    deps.options = { ...deps.options, catalog: effectiveCatalog({}) }
    const payload = { sessionId: 'first', model: 'gpt-5.4' }
    await expect(dispatchNowCodingMethod(deps, 'session.fast.get', payload)).resolves.toEqual({ enabled: false })
    await expect(dispatchNowCodingMethod(deps, 'session.fast.set', { ...payload, enabled: true })).resolves.toEqual({ enabled: true })
    await expect(dispatchNowCodingMethod(deps, 'session.fast.get', payload)).resolves.toEqual({ enabled: true })
    await expect(dispatchNowCodingMethod(deps, 'session.fast.get', { ...payload, sessionId: 'second' })).resolves.toEqual({ enabled: false })
    await expect(dispatchNowCodingMethod(deps, 'session.fast.get', { ...payload, model: 'gpt-6.1-sol' })).resolves.toEqual({ enabled: false })
    deps.sessionFast.set('first', 'gpt-6.1-sol', true)
    deps.sessionFast.set('first', 'gpt-6.1-sol', false)
    expect(deps.sessionFast.get('first', 'gpt-5.4')).toBe(true)
    expect(settings.writes).toHaveLength(0)
    deps.options = { ...deps.options, catalog: effectiveCatalog({ modelOverrides: { 'gpt-5.4': { fast: false } } }) }
    await expect(dispatchNowCodingMethod(deps, 'session.fast.get', payload)).resolves.toEqual({ enabled: false })
    await expect(dispatchNowCodingMethod(deps, 'session.fast.set', { ...payload, enabled: true })).rejects.toMatchObject({ code: 'bad-request' })
    await expect(dispatchNowCodingMethod(deps, 'session.fast.set', { ...payload, enabled: false })).resolves.toEqual({ enabled: false })
  })
  it('rejects missing session identity, invalid modes and unsupported models', async () => {
    const { deps } = depsOf(tokenConsole)
    deps.sessionFast = createSessionFastStore()
    deps.options = { ...deps.options, catalog: effectiveCatalog({}) }
    for (const payload of [{ model: 'gpt-5.4', enabled: true }, { sessionId: 'first', model: 'gpt-5.4', enabled: 'true' }, { sessionId: 'first', model: 'unknown', enabled: true }]) {
      await expect(dispatchNowCodingMethod(deps, 'session.fast.set', payload)).rejects.toMatchObject({ code: 'bad-request' })
    }
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

  it('accepts the listener bind address on any port, as the /api gateway does', () => {
    expect(isTrustedApiRequest({ host: '192.168.1.5:51345' }, [], '192.168.1.5')).toBe(true)
    expect(isTrustedApiRequest({ host: '192.168.1.5' }, [], '192.168.1.5')).toBe(true)
    expect(isTrustedApiRequest({ host: '192.168.1.6:51345' }, [], '192.168.1.5')).toBe(false)
  })
})

/** One captured HTTP response. */
interface Captured {
  status: number
  headers: Record<string, unknown>
  body: string
}

/** A request double carrying one JSON body. */
function requestOf(method: string, body: unknown, headers: Record<string, string> = { host: '127.0.0.1:51345' }) {
  const text = JSON.stringify(body)
  return {
    method,
    headers,
    async *[Symbol.asyncIterator]() { yield Buffer.from(text) },
  }
}

/** A response double recording the status, headers, and body. */
function responseOf(): Captured & { writeHead: unknown; end: unknown } {
  const captured = {
    status: 0,
    headers: {} as Record<string, unknown>,
    body: '',
    writeHead(status: number, headers?: Record<string, unknown>) {
      captured.status = status
      captured.headers = headers ?? {}
    },
    end(body?: string) { captured.body = body ?? '' },
  }
  return captured as unknown as Captured & { writeHead: unknown; end: unknown }
}

/** The route a Host registration handed the plugin. */
type RegisteredRoute = { kind: 'exact'; path: string; handler: (req: unknown, res: unknown) => void | Promise<void> }

/**
 * Mount the route on a real cordis context whose webServer registers it, then
 * hand back the registration plus a way to run one request through it.
 *
 * The injected fiber activates asynchronously, so mounting awaits it — the
 * point of the test is the dependency set the plugin declares, and a route
 * that only ever activates when some other renamed service exists is exactly
 * the regression this guards.
 */
async function mountRoute(
  trust?: { name: 'webRuntime' | 'webStartup'; trustedHosts: readonly string[] },
  webServer: { host?: string; protocol?: string } = { host: '127.0.0.1', protocol: 'http:' },
) {
  const ctx = new Context()
  let registered: RegisteredRoute | undefined
  ctx.provide('webServer', {
    ...webServer,
    register(route: RegisteredRoute) {
      registered = route
      return () => { registered = undefined }
    },
  })
  if (trust !== undefined) {
    ctx.provide(trust.name, { trustedHosts: trust.trustedHosts })
    if (trust.name === 'webStartup') {
      // 0.2.1 provides webStartup and no webRuntime; asking for the removed
      // service must not be what keeps the route off the server.
      expect(ctx.get('webRuntime')).toBeUndefined()
    }
  }
  await registerNowCodingSettingsRoutes(ctx, () => OPTIONS) as unknown as Promise<unknown>
  return {
    registered: () => registered,
    /** Run one request through the registered handler and return its response. */
    async call(method: string, body: unknown, headers?: Record<string, string>): Promise<Captured> {
      const route = registered
      if (route === undefined) throw new Error('the route was never registered')
      const res = responseOf()
      await route.handler(requestOf(method, body, headers), res)
      return res
    },
  }
}

describe('route registration', () => {
  it('registers /nowcoding/api from webServer alone, on a line without any trust service', async () => {
    const mounted = await mountRoute()
    expect(mounted.registered()?.path).toBe('/nowcoding/api')
    expect(mounted.registered()?.kind).toBe('exact')
  })

  it('registers when the line provides webRuntime and when it provides webStartup instead', async () => {
    expect((await mountRoute({ name: 'webRuntime', trustedHosts: [] })).registered()).toBeDefined()
    expect((await mountRoute({ name: 'webStartup', trustedHosts: [] })).registered()).toBeDefined()
  })

  it('registers on a webServer that exposes no host or protocol, as older lines do not', async () => {
    expect((await mountRoute(undefined, {})).registered()).toBeDefined()
  })

  it('reads the trust authorities from whichever service the line provides', async () => {
    for (const name of ['webRuntime', 'webStartup'] as const) {
      const mounted = await mountRoute({ name, trustedHosts: ['box.local'] })
      const trusted = await mounted.call('POST', { method: 'models.served', payload: {} }, { host: 'box.local:51345' })
      expect(trusted.status).toBe(200)
      const foreign = await mounted.call('POST', { method: 'models.served', payload: {} }, { host: 'evil.example' })
      expect(foreign.status).toBe(403)
    }
  })

  it('accepts the listener bind address when no trust service lists it', async () => {
    const mounted = await mountRoute(undefined, { host: '10.1.2.3', protocol: 'http:' })
    const bound = await mounted.call('POST', { method: 'models.served', payload: {} }, { host: '10.1.2.3:61345' })
    expect(bound.status).toBe(200)
    const other = await mounted.call('POST', { method: 'models.served', payload: {} }, { host: '10.1.2.4:61345' })
    expect(other.status).toBe(403)
  })

  it('answers every route failure as JSON, so a blank 405 cannot be mistaken for this route', async () => {
    const mounted = await mountRoute()
    const ok = await mounted.call('POST', { method: 'models.served', payload: {} })
    expect(ok.status).toBe(200)
    expect(JSON.parse(ok.body)).toMatchObject({ ok: true })
    expect(String(ok.headers['content-type'])).toContain('application/json')

    const wrongMethod = await mounted.call('GET', {})
    expect(wrongMethod.status).toBe(405)
    expect(JSON.parse(wrongMethod.body)).toMatchObject({ ok: false, error: { code: 'method-error' } })

    const unknown = await mounted.call('POST', { method: 'nope', payload: {} })
    expect(unknown.status).toBe(404)
    expect(JSON.parse(unknown.body)).toMatchObject({ ok: false, error: { code: 'not-found' } })
  })
})
