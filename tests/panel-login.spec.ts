import { describe, expect, it } from 'vitest'
import { attributionHeaders } from '@deepseek-ai/dsh-llm'
import { createPanelLogin } from '../src/panel-login.ts'
import { answer, status, transport, type Sent } from './console-fetch.ts'

/** A console account document, shaped as the live gateway answers it. */
const account = { success: true, message: '', data: { id: 8893, username: 'demo', role: 1 } }

/** The session cookie a successful login sets. */
const session = 'session=abc123; Path=/; HttpOnly'

/** A sign-in client over a recording transport. */
function loginWith(script: (sent: Sent) => Response, now: () => number = () => 1_000) {
  const { fetchImpl, sent } = transport(script)
  const client = createPanelLogin({ baseURL: () => 'https://nowcoding.ai/v1', fetchImpl, now })
  return { client, sent, transport: sent }
}

describe('console sign-in', () => {
  it('returns the account token read over the answered session', async () => {
    const { client, sent } = loginWith(request => request.path === '/api/user/login'
      ? answer(account, [session])
      : answer({ success: true, data: 'tok-42' }))

    await expect(client.login(' demo ', 'secret')).resolves.toEqual({
      status: 'ok',
      credential: { accessToken: 'tok-42', userId: '8893', username: 'demo', tokenSource: 'read' },
    })
    expect(sent.map(request => `${request.method} ${request.path}`)).toEqual([
      'POST /api/user/login',
      'GET /api/user/self/access-token',
    ])
    expect(sent[0]?.body).toEqual({ username: 'demo', password: 'secret' })
    expect(sent[1]?.cookie).toBe('session=abc123')
  })

  it('carries JSON content and the harness attribution headers', async () => {
    const expected = attributionHeaders()
    const { client, sent } = loginWith(request => request.path === '/api/user/login'
      ? answer(account, [session])
      : answer({ success: true, data: 'tok-42' }))
    await client.login('demo', 'secret')
    const headers = sent[0]?.headers
    expect(headers?.get('accept')).toBe('application/json')
    expect(headers?.get('content-type')).toBe('application/json')
    for (const [name, value] of Object.entries(expected)) expect(headers?.get(name)).toBe(value)
  })

  it('takes the token the login answer already carried', async () => {
    const { client, sent } = loginWith(() => answer({
      success: true,
      data: { id: 8893, username: 'demo', access_token: 'inline-tok' },
    }))
    await expect(client.login('demo', 'secret')).resolves.toMatchObject({
      credential: { accessToken: 'inline-tok', tokenSource: 'login' },
    })
    expect(sent).toHaveLength(1)
  })

  it('falls back to the account document when the token route refuses', async () => {
    const { client, sent } = loginWith((request) => {
      if (request.path === '/api/user/login') return answer(account, [session])
      if (request.path === '/api/user/self/access-token') return answer({ success: false, message: 'no token' })
      return answer({ success: true, data: { id: 8893, access_token: 'tok-self' } })
    })
    await expect(client.login('demo', 'secret')).resolves.toMatchObject({
      credential: { accessToken: 'tok-self', tokenSource: 'read' },
    })
    expect(sent.map(request => request.path)).toEqual([
      '/api/user/login',
      '/api/user/self/access-token',
      '/api/user/self',
    ])
  })

  it('issues a token only after both read routes came back empty', async () => {
    const { client, sent } = loginWith((request) => {
      if (request.path === '/api/user/login') return answer(account, [session])
      if (request.path === '/api/user/token') return answer({ success: true, data: 'tok-new' })
      return answer({ success: false, message: 'empty' })
    })
    await expect(client.login('demo', 'secret')).resolves.toMatchObject({
      credential: { accessToken: 'tok-new', tokenSource: 'generated' },
    })
    expect(sent.map(request => request.path)).toEqual([
      '/api/user/login',
      '/api/user/self/access-token',
      '/api/user/self',
      '/api/user/token',
    ])
  })

  it('reports an account whose token no route would hand over', async () => {
    const { client } = loginWith(request => request.path === '/api/user/login'
      ? answer(account, [session])
      : answer({ success: false, message: 'Unauthorized, invalid access token' }))
    await expect(client.login('demo', 'secret')).rejects.toMatchObject({ code: 'token-unavailable' })
  })

  it('asks for the second factor and completes it over the same session', async () => {
    const { client, sent } = loginWith((request) => {
      if (request.path === '/api/user/login') return answer({ success: true, data: { require_2fa: true } }, [session])
      if (request.path === '/api/user/login/2fa') return answer(account)
      return answer({ success: true, data: 'tok-42' })
    })

    await expect(client.login('demo', 'secret')).resolves.toEqual({ status: 'two-factor-required' })
    await expect(client.verifyTwoFactor(' 123456 ')).resolves.toMatchObject({
      credential: { accessToken: 'tok-42', userId: '8893' },
    })
    expect(sent[1]?.body).toEqual({ code: '123456' })
    expect(sent[1]?.cookie).toBe('session=abc123')
    expect(sent[2]?.cookie).toBe('session=abc123')
  })

  it('reports a refused password with the console message', async () => {
    const { client } = loginWith(() => answer({
      success: false,
      message: 'Username or password is incorrect, or user has been banned',
    }))
    await expect(client.login('demo', 'wrong')).rejects.toMatchObject({
      code: 'bad-credentials',
      message: 'Username or password is incorrect, or user has been banned',
    })
  })

  it('reports Turnstile as its own state, not as a wrong password', async () => {
    const { client } = loginWith(() => answer({ success: false, message: 'Turnstile 校验失败，请刷新页面重试' }))
    await expect(client.login('demo', 'secret')).rejects.toMatchObject({ code: 'turnstile-required' })
  })

  it('reports a refused verification code', async () => {
    const { client } = loginWith((request) => request.path === '/api/user/login'
      ? answer({ success: true, data: { require_2fa: true } }, [session])
      : answer({ success: false, message: '验证码错误或已过期' }))
    await client.login('demo', 'secret')
    await expect(client.verifyTwoFactor('000000')).rejects.toMatchObject({ code: 'two-factor-invalid' })
  })

  it('refuses a code with no challenge open', async () => {
    const { client, sent } = loginWith(() => answer(account))
    await expect(client.verifyTwoFactor('123456')).rejects.toMatchObject({ code: 'two-factor-unavailable' })
    expect(sent).toHaveLength(0)
  })

  it('drops a challenge that outlived its window', async () => {
    let clock = 1_000
    const { client } = loginWith(
      request => request.path === '/api/user/login'
        ? answer({ success: true, data: { require_2fa: true } }, [session])
        : answer(account),
      () => clock,
    )
    await client.login('demo', 'secret')
    clock += 300_001
    await expect(client.verifyTwoFactor('123456')).rejects.toMatchObject({ code: 'two-factor-unavailable' })
  })

  it('reports an unreachable console', async () => {
    const fetchImpl: typeof fetch = () => Promise.reject(new Error('getaddrinfo ENOTFOUND nowcoding.ai'))
    const client = createPanelLogin({ baseURL: () => 'https://nowcoding.ai/v1', fetchImpl })
    await expect(client.login('demo', 'secret')).rejects.toMatchObject({ code: 'unreachable' })
  })

  it('reports a console status outside 2xx', async () => {
    const { client } = loginWith(() => status(502))
    await expect(client.login('demo', 'secret')).rejects.toMatchObject({ code: 'gateway-error' })
  })

  it('reports a timeout when the console never answers', async () => {
    const fetchImpl: typeof fetch = (_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => { reject(new Error('aborted')) })
    })
    const client = createPanelLogin({ baseURL: () => 'https://nowcoding.ai/v1', fetchImpl, timeoutMs: 5 })
    await expect(client.login('demo', 'secret')).rejects.toMatchObject({ code: 'timeout' })
  })
})
