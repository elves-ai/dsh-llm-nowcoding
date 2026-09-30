import { defineConfig } from 'vitest/config'

/**
 * Unit suite: no network, no dsh profile. Every provider call is served by an
 * injected `fetch`, so these specs run in CI without a NowCoding key.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts'],
    environment: 'node',
  },
})
