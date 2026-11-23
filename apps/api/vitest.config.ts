import { defineConfig } from 'vitest/config';

// Each test boots a fresh in-memory Postgres (PGlite); allow for a loaded machine.
export default defineConfig({ test: { testTimeout: 30_000, hookTimeout: 30_000 } });
