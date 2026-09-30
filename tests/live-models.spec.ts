import { describe, expect, it } from 'vitest'
import {
  createLiveModelLister,
  normalizeModelList,
  NowCodingModelsError,
} from '../src/live-models.ts'

/** The OpenAI list shape, as the live gateway answers it. */
const LIST_BODY = {
  object: 'list',
  success: true,
  data: [
    { id: 'gpt-5.6-sol', object: 'model', created: 1_626_777_600, owned_by: 'custom' },
    { id: 'gpt-6-astra', object: 'model', created: 1_626_777_600, owned_by: 'custom' },
  ],
}

/** One request a fake transport saw. */
interface Sent {
  url: string
  headers: Headers
}

/**
 * A lister over a recording transport that answers from a script.
 * @param script - maps the recorded request to its answer; a thrown error stands in for a transport failure.
 */
function listerWith(script: (sent: Sent) => Response | Promise<Response>): {
  lister: ReturnType<typeof createLiveModelLister>
  sent: Sent[]
} {
  const sent: Sent[] = []
  const fetchImpl: typeof fetch = async (input, init) => {
    sent.push({
      url: typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      headers: new Headers(init?.headers),
    })
    return script(sent[sent.length - 1]!)
  }
  return { lister: createLiveModelLister({ baseURL: 'https://nowcoding.ai/v1', apiKey: 'sk-test', fetchImpl }), sent }
}

describe('normalizeModelList', () => {
  it('projects the OpenAI list shape into id/owner entries', () => {
    expect(normalizeModelList(LIST_BODY)).toEqual([
      { id: 'gpt-5.6-sol', ownedBy: 'custom' },
      { id: 'gpt-6-astra', ownedBy: 'custom' },
    ])
  })

  it('tolerates a bare array, malformed entries, and duplicate ids', () => {
    expect(normalizeModelList([
      { id: 'a', owned_by: 'x' },
      { nope: true },
      'not-an-object',
      { id: 'a', owned_by: 'x' },
      { id: 'b' },
    ])).toEqual([{ id: 'a', ownedBy: 'x' }, { id: 'b' }])
  })

  it('answers empty for a body it cannot read rather than throwing', () => {
    expect(normalizeModelList(undefined)).toEqual([])
    expect(normalizeModelList({ data: 'not-an-array' })).toEqual([])
  })
})

describe('createLiveModelLister', () => {
  it('reads the key-scoped listing with bearer and attribution headers', async () => {
    const { lister, sent } = listerWith(() => new Response(JSON.stringify(LIST_BODY), { status: 200 }))
    await expect(lister.list()).resolves.toHaveLength(2)
    expect(sent).toHaveLength(1)
    expect(sent[0]!.url).toBe('https://nowcoding.ai/v1/models')
    expect(sent[0]!.headers.get('authorization')).toBe('Bearer sk-test')
    expect(sent[0]!.headers.get('accept')).toBe('application/json')
    // The attribution contract: the reader is a provider request like chat.
    expect([...sent[0]!.headers.keys()].length).toBeGreaterThan(2)
  })

  it('classifies a refused key as unauthorized', async () => {
    const { lister } = listerWith(() => new Response('{"error":{"message":"no"}}', { status: 401 }))
    await expect(lister.list()).rejects.toMatchObject({ name: 'NowCodingModelsError', code: 'unauthorized' })
  })

  it('classifies a non-success status as gateway-error', async () => {
    const { lister } = listerWith(() => new Response('boom', { status: 503 }))
    await expect(lister.list()).rejects.toMatchObject({ name: 'NowCodingModelsError', code: 'gateway-error' })
  })

  it('classifies a non-JSON success body as unprocessable', async () => {
    const { lister } = listerWith(() => new Response('<html>', { status: 200 }))
    await expect(lister.list()).rejects.toMatchObject({ name: 'NowCodingModelsError', code: 'unprocessable' })
  })

  it('classifies a transport failure as unreachable', async () => {
    const { lister } = listerWith(() => {
      throw new TypeError('network down')
    })
    await expect(lister.list()).rejects.toBeInstanceOf(NowCodingModelsError)
    await expect(lister.list()).rejects.toMatchObject({ code: 'unreachable' })
  })

  it('rethrows the transport error untouched when the caller aborted mid-flight', async () => {
    const controller = new AbortController()
    const { lister } = listerWith(() => {
      controller.abort()
      throw new TypeError('aborted by caller')
    })
    await expect(lister.list(controller.signal)).rejects.toBeInstanceOf(TypeError)
    await expect(lister.list(controller.signal)).rejects.not.toBeInstanceOf(NowCodingModelsError)
  })
})
