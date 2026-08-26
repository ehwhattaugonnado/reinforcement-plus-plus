import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    coverage: { provider: 'v8', include: ['src/**'] },
    projects: [
      {
        // ADR 0002: the simulation core is framework- and DOM-independent, so
        // its tests run in node. A sim test that needs a DOM is a design bug.
        extends: true,
        test: {
          name: 'sim',
          globals: true,
          environment: 'node',
          include: ['src/sim/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'app',
          globals: true,
          environment: 'jsdom',
          setupFiles: ['./tests/setup/vitest.setup.ts'],
          include: ['src/app/**/*.test.{ts,tsx}'],
        },
      },
    ],
  },
})
