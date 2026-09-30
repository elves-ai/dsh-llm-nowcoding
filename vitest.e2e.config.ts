import { defineConfig } from 'vitest/config'

/**
 * Live suite: talks to the real NowCoding endpoint. Self-skips unless
 * `NOWCODING_API_KEY` is set, so a keyless CI run stays green.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.e2e.ts'],
    environment: 'node',
    testTimeout: 120_000,
    hookTimeout: 30_000,
  },
})
