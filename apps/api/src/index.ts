import { fileURLToPath } from 'node:url';
import { Flagsmith } from '@flagsmith/nodejs';
import { serve } from '@hono/node-server';
import { pino } from 'pino';
import { createApp } from './app';
import { openDb } from './db/client';
import { parseEnv } from './env';
import { cachedFlags, flagsmithSource, localFlagSource } from './flags';
import { diskStorage, r2Storage } from './storage';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

try {
  process.loadEnvFile(here('../../../.env'));
} catch {
  // No root .env: use process env and local defaults (LOCAL-DEV.md).
}

const env = parseEnv(process.env);
const log = pino({ level: env.LOG_LEVEL });
const now = () => new Date();

const opened = await openDb({ databaseUrl: env.DATABASE_URL, dataDir: here('../.data/pglite') }).catch((err: unknown) => {
  if (env.DATABASE_URL) throw err;
  // Local PGlite is single-process and can be left inconsistent if it was killed mid-write.
  log.error({ err }, 'local database could not be opened; if it was killed mid-write, delete apps/api/.data and run `pnpm seed` again');
  process.exit(1);
});
const { db, close: closeDb } = opened;

const source = env.FLAGSMITH_SERVER_KEY
  ? flagsmithSource(
      new Flagsmith({ environmentKey: env.FLAGSMITH_SERVER_KEY, apiUrl: env.FLAGSMITH_API_URL, requestTimeoutSeconds: 3 }),
    )
  : localFlagSource(here('../local-flags.json'));

const storage =
  env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_PUBLIC_BASE_URL
    ? r2Storage({
        accountId: env.R2_ACCOUNT_ID,
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        bucket: env.R2_BUCKET,
        publicBaseUrl: env.R2_PUBLIC_BASE_URL,
      })
    : diskStorage(here('../.data/uploads'));

const app = createApp({
  db,
  flags: cachedFlags(source, now, (err) => log.warn({ err }, 'flagsmith failed, using cached or default flags')),
  storage,
  now,
  logger: log,
  config: {
    secret: env.secret,
    secureCookies: env.isProduction,
    adminEmails: env.adminEmails,
    allowDevLogin: !env.isProduction && env.ALLOW_DEV_LOGIN === '1',
    flagsmithDashboardUrl: env.FLAGSMITH_DASHBOARD_URL,
    google:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            redirectUri: `${env.BETTER_AUTH_URL.replace(/\/$/, '')}/api/auth/callback/google`,
          }
        : undefined,
  },
});

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) =>
  log.info(
    {
      port: info.port,
      db: env.DATABASE_URL ? 'postgres' : 'pglite',
      flags: env.FLAGSMITH_SERVER_KEY ? 'flagsmith' : 'local-flags.json',
      storage: storage.localDir ? 'local' : 'r2',
    },
    'api listening',
  ),
);

// Close the database cleanly on Ctrl+C / deploy restarts so local PGlite is never left mid-write.
let stopping = false;
const shutdown = (signal: string) => {
  if (stopping) return;
  stopping = true;
  log.info({ signal }, 'shutting down');
  server.close(() => {
    void closeDb().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(0), 5000).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
