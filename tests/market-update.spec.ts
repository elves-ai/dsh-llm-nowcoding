import { describe, expect, it } from 'vitest'
import { createMarketUpdateClient, MarketUpdateApiError } from '../src/client/market-update.ts'

/** The schema string every v1 answer carries. */
const SCHEMA = 'dsh-market/update-api/v1'

/** One request a fake transport saw. */
interface Sent {
  method: string
  url: string
  body: unknown
}

/** A JSON answer with a status. */
function answer(body: unknown, code = 200): Response {
  return new Response(JSON.stringify(body), { status: code, headers: { 'content-type': 'application/json' } })
}

/**
 * Record every request while answering from a script.
 * @param script - maps one recorded request to its answer; a thrown error stands in for a transport failure.
 */
function clientWith(script: (sent: Sent) => Response): { client: ReturnType<typeof createMarketUpdateClient>; sent: Sent[]; failNext: () => void } {
  const sent: Sent[] = []
  let failing = false
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    // The face speaks origin-relative paths (browser-correct); Node needs a base.
    const parsed = new URL(url, 'http://dsh.local')
    sent.push({
      method: init?.method ?? 'GET',
      url: parsed.pathname + parsed.search,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) as unknown : undefined,
    })
    if (failing) { failing = false; throw new TypeError('network down') }
    return script(sent[sent.length - 1]!)
  }
  return { client: createMarketUpdateClient(fetchImpl), sent, failNext: () => { failing = true } }
}

describe('dsh-market update API face', () => {
  it('discovers the market capabilities', async () => {
    const { client, sent } = clientWith(() => answer({
      schema: SCHEMA,
      marketVersion: '1.2.3',
      runtime: 'web',
      features: { check: true, update: true },
      restart: { supported: false },
    }))

    await expect(client.discover()).resolves.toEqual({
      marketVersion: '1.2.3',
      runtime: 'web',
      canCheck: true,
      canUpdate: true,
      canRestart: false,
    })
    expect(sent).toEqual([{ method: 'GET', url: '/dsh-market/api/v1/capabilities', body: undefined }])
  })

  it('treats discovery failure as absence, never an error', async () => {
    const absent = clientWith(() => answer({ error: 'not found' }, 404))
    await expect(absent.client.discover()).resolves.toBeNull()

    const foreign = clientWith(() => answer({ schema: 'something/else' }))
    await expect(foreign.client.discover()).resolves.toBeNull()

    const down = clientWith(() => answer({}))
    down.failNext()
    await expect(down.client.discover()).resolves.toBeNull()
  })

  it('passes the desktop runtime through, the signal mutation controls gate on', async () => {
    const { client } = clientWith(() => answer({
      schema: SCHEMA,
      marketVersion: '1.66.6',
      profile: 'desktop',
      // The market offers the mutation endpoint even on the desktop app, where
      // every mutation refuses because the app owns its profile; `runtime` is
      // the machine-readable signal a client hides its update button behind.
      runtime: 'desktop',
      features: { check: true, update: true, restart: false },
      restart: { supported: false, managedBy: 'desktop-host' },
    }))

    await expect(client.discover()).resolves.toEqual({
      marketVersion: '1.66.6',
      runtime: 'desktop',
      canCheck: true,
      canUpdate: true,
      canRestart: false,
    })
  })

  it('checks this package by its encoded scoped name, forced on demand', async () => {
    const { client, sent } = clientWith(request => request.url.includes('force=1')
      ? answer({ schema: SCHEMA, package: { name: '@elves-ai/dsh-llm-nowcoding', source: 'github', installedVersion: '0.1.0', latestVersion: '0.2.0', updateAvailable: true } })
      : answer({ schema: SCHEMA, package: { source: 'github', installedVersion: '0.1.0', latestVersion: null, updateAvailable: false } }))

    await expect(client.check()).resolves.toEqual({
      source: 'github',
      installedVersion: '0.1.0',
      latestVersion: null,
      updateAvailable: false,
    })
    await expect(client.check(true)).resolves.toEqual({
      source: 'github',
      installedVersion: '0.1.0',
      latestVersion: '0.2.0',
      updateAvailable: true,
    })
    expect(sent.map(request => request.url)).toEqual([
      '/dsh-market/api/v1/updates?name=%40elves-ai%2Fdsh-llm-nowcoding',
      '/dsh-market/api/v1/updates?name=%40elves-ai%2Fdsh-llm-nowcoding&force=1',
    ])
  })

  it('maps check refusals onto stable codes', async () => {
    const missing = clientWith(() => answer({ schema: SCHEMA, error: 'plugin is not installed' }, 404))
    await expect(missing.client.check()).rejects.toMatchObject({ code: 'PLUGIN_NOT_INSTALLED', status: 404 })

    const forbidden = clientWith(() => answer({ schema: SCHEMA, error: 'untrusted origin' }, 403))
    await expect(forbidden.client.check()).rejects.toMatchObject({ code: 'UPDATE_FORBIDDEN', status: 403 })
  })

  it('starts an update with the package name and reads the queued operation', async () => {
    const { client, sent } = clientWith(request => request.body !== null && (request.body as Record<string, unknown>).force === true
      ? answer({ schema: SCHEMA, operation: { operationId: 'boot-1', state: 'queued', beforeVersion: '0.1.0', installedVersion: '0.1.0', failure: null } }, 202)
      : answer({ schema: SCHEMA, operation: { operationId: 'boot-1', state: 'queued', beforeVersion: '0.1.0', installedVersion: '0.1.0', failure: null } }, 202))

    await expect(client.start()).resolves.toMatchObject({ operationId: 'boot-1', state: 'queued', beforeVersion: '0.1.0' })
    await expect(client.start(true)).resolves.toMatchObject({ state: 'queued' })
    expect(sent.map(request => `${request.method} ${request.url} ${JSON.stringify(request.body)}`)).toEqual([
      'POST /dsh-market/api/v1/updates {"packageName":"@elves-ai/dsh-llm-nowcoding"}',
      'POST /dsh-market/api/v1/updates {"packageName":"@elves-ai/dsh-llm-nowcoding","force":true}',
    ])
  })

  it('carries the market failure verdict when a start is refused', async () => {
    const busy = clientWith(() => answer({
      schema: SCHEMA,
      error: 'another public update operation is already running',
      failure: { code: 'OPERATION_BUSY', message: 'another public update operation is already running', retryable: true },
    }, 409))
    await expect(busy.client.start()).rejects.toSatisfy((error: unknown) =>
      error instanceof MarketUpdateApiError && error.code === 'OPERATION_BUSY' && error.retryable)
  })

  it('polls progress and terminal outcomes defensively', async () => {
    const { client } = clientWith(request => request.url.includes('op-7')
      ? answer({
          schema: SCHEMA,
          operation: {
            operationId: 'op-7',
            state: 'running',
            progress: { phase: 'install', done: 3, total: 4, percent: 75, detail: 'linking @elves-ai/dsh-llm-nowcoding' },
            outcome: { refreshRequired: false, restartRequired: false, rollback: { available: false } },
            failure: null,
          },
        })
      : answer({ schema: SCHEMA, operation: null }, 404))

    await expect(client.poll('op-7')).resolves.toMatchObject({
      state: 'running',
      percent: 75,
      phase: 'install',
      detail: 'linking @elves-ai/dsh-llm-nowcoding',
      refreshRequired: false,
      restartRequired: false,
    })
    await expect(client.poll('gone')).rejects.toMatchObject({ code: 'PLUGIN_NOT_INSTALLED', status: 404 })
  })

  it('reports a succeeded operation with its restart outcome and failure shape', async () => {
    const { client } = clientWith(() => answer({
      schema: SCHEMA,
      operation: {
        operationId: 'op-8',
        state: 'failed',
        beforeVersion: '0.1.0',
        installedVersion: '0.1.0',
        progress: {},
        outcome: { refreshRequired: false, restartRequired: true, rollback: { available: true } },
        failure: { code: 'RELEASE_TOO_FRESH', message: 'too fresh', retryable: true },
      },
    }))

    await expect(client.poll('op-8')).resolves.toMatchObject({
      state: 'failed',
      restartRequired: true,
      rollbackAvailable: true,
      failure: { code: 'RELEASE_TOO_FRESH', retryable: true },
    })
  })

  it('resolves the restart even when the Host drops before answering', async () => {
    const ok = clientWith(() => answer({ schema: SCHEMA, result: { ok: true } }))
    await expect(ok.client.restart()).resolves.toBeUndefined()

    const down = clientWith(() => answer({}))
    down.failNext()
    await expect(down.client.restart()).resolves.toBeUndefined()

    const refused = clientWith(() => answer({ error: 'self-restart is disabled for this host' }, 403))
    await expect(refused.client.restart()).rejects.toMatchObject({ code: 'UPDATE_FORBIDDEN', status: 403 })
  })
})
