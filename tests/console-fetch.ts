/**
 * Recording transport for the console sign-in specs.
 *
 * Both the module spec and the route spec drive the same client against the
 * same wire documents, so the fake lives here rather than twice. It answers
 * from a script and never touches the network.
 */

/** One request a fake transport saw. */
export interface Sent {
  /** HTTP method the client used. */
  method: string
  /** Origin-relative console path. */
  path: string
  /** Every header the client sent. */
  headers: Headers
  /** Parsed JSON body, or undefined for a GET. */
  body: unknown
  /** Session cookie the client presented, when it presented one. */
  cookie: string | undefined
}

/** A JSON answer, optionally setting session cookies. */
export function answer(body: unknown, cookies: readonly string[] = []): Response {
  const headers = new Headers({ 'content-type': 'application/json' })
  for (const cookie of cookies) headers.append('set-cookie', cookie)
  return new Response(JSON.stringify(body), { status: 200, headers })
}

/** A JSON answer carrying only a status. */
export function status(code: number): Response {
  return new Response('{}', { status: code, headers: { 'content-type': 'application/json' } })
}

/**
 * Record every request while answering from a script.
 * @param script - maps one recorded request to its answer.
 * @returns the fake transport and the requests it saw, in order.
 */
export function transport(script: (sent: Sent) => Response): { fetchImpl: typeof fetch; sent: Sent[] } {
  const sent: Sent[] = []
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const headers = new Headers(init?.headers)
    const request: Sent = {
      method: init?.method ?? 'GET',
      path: new URL(url).pathname,
      headers,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) as unknown : undefined,
      cookie: headers.get('cookie') ?? undefined,
    }
    sent.push(request)
    return script(request)
  }
  return { fetchImpl, sent }
}
