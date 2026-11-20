import { fileURLToPath } from 'node:url';
import { parseEnv } from '../env';
import { openDb } from './client';

/** `pnpm db:migrate`: Railway pre-deploy step. openDb() applies the migrations. */
const env = parseEnv(process.env);
const handle = await openDb({
  databaseUrl: env.DATABASE_URL,
  dataDir: fileURLToPath(new URL('../../.data/pglite', import.meta.url)),
});
await handle.close();
