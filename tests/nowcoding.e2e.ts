/**
 * Live smoke against the NowCoding gateway.
 *
 * Every case self-skips unless `NOWCODING_API_KEY` is set, so a keyless CI run
 * stays green. This suite is never the only evidence for a behavioural claim:
 * it answers "does the real gateway still look like this", which unit specs
 * with recorded transcripts cannot.
 */
import { describe, expect, it } from 'vitest'
import { createQuotaReader } from '../src/quota.ts'
import { NOWCODING_DEFAULT_BASE_URL } from '../src/settings-shared.ts'

const apiKey = process.env['NOWCODING_API_KEY'] ?? ''
const baseURL = process.env['NOWCODING_BASE_URL'] ?? NOWCODING_DEFAULT_BASE_URL

describe.skipIf(apiKey === '')('live NowCoding gateway', () => {
  it('reads a balance for the configured key', async () => {
    const snapshot = await createQuotaReader({ baseURL, apiKey }).read()
    expect(snapshot.total).toBeGreaterThanOrEqual(0)
    expect(snapshot.remaining).toBeLessThanOrEqual(snapshot.total)
    expect(snapshot.fetchedAt).toBeGreaterThan(0)
  })

  it('lists models the key may use', async () => {
    const response = await fetch(baseURL + '/models', {
      headers: { authorization: `Bearer ${apiKey}` },
    })
    expect(response.status).toBe(200)
    const body = await response.json() as { data?: readonly { id?: unknown }[] }
    const ids = (body.data ?? []).map(entry => entry.id).filter((id): id is string => typeof id === 'string')
    expect(ids.length).toBeGreaterThan(0)
  })

  it('serves the public pricing catalog without a credential', async () => {
    const origin = new URL(baseURL).origin
    const response = await fetch(origin + '/api/pricing')
    expect(response.status).toBe(200)
  })
})
