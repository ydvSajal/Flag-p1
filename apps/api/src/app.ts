import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { pino, type Logger } from 'pino';
import { authRoutes, cookieUserId, loadUser } from './auth';
import type { Db } from './db/client';
import type { Flags } from './flags';
import { HttpError, type AppEnv, type Ctx } from './middleware';
import { adminRoutes } from './routes/admin';
import { meRoutes } from './routes/me';
import { modulesRoutes } from './routes/modules';
import { sessionsRoutes } from './routes/sessions';
import { setResultsRoutes } from './routes/set-results';
import { setsRoutes } from './routes/sets';
import { uploadsRoutes } from './routes/uploads';
import type { Storage } from './storage';

export { HttpError } from './middleware';

export type AppConfig = {
  secret: string;
  secureCookies: boolean;
  adminEmails: string[];
  allowDevLogin: boolean;
  flagsmithDashboardUrl: string;
  google?: { clientId: string; clientSecret: string; redirectUri: string };
};

export type Deps = {
  db: Db;
  flags: Flags;
  storage: Storage;
  now: () => Date;
  config: AppConfig;
  /** Caller's user id. Default: the signed `pl_guest` cookie. Tests swap in a header reader. */
  getUser?: (c: Ctx) => string | null;
  logger?: Logger;
  fetch?: typeof fetch;
};

export const createApp = (deps: Deps) => {
  const log = deps.logger ?? pino();
  const getUser = deps.getUser ?? ((c: Ctx) => cookieUserId(c, deps.config.secret));
  const app = new Hono<AppEnv>();

  app.use('*', async (c, next) => {
    const start = performance.now();
    await next();
    log.info({
      reqId: randomUUID(),
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      ms: Math.round(performance.now() - start),
      userId: c.get('user')?.id,
    });
  });

  app.get('/healthz', async (c) => {
    await deps.db.execute(sql`select 1`);
    return c.json({ ok: true });
  });

  app.use('/api/*', async (c, next) => {
    const id = getUser(c);
    c.set('user', id ? await loadUser(deps.db, id, deps.config.adminEmails) : null);
    await next();
  });

  const api = new Hono<AppEnv>();
  api.route('/', authRoutes(deps));
  api.route('/', meRoutes(deps));
  api.route('/', modulesRoutes(deps));
  api.route('/', sessionsRoutes(deps));
  api.route('/', setResultsRoutes(deps));
  api.route('/', uploadsRoutes(deps));
  api.route('/', setsRoutes(deps));
  api.route('/', adminRoutes(deps));
  app.route('/api', api);

  app.notFound((c) => c.json({ error: { code: 'not_found', message: 'Not found' } }, 404));
  app.onError((err, c) => {
    if (err instanceof HttpError) {
      return c.json({ error: { code: err.code, message: err.message } }, err.status as 400);
    }
    log.error({ err, path: c.req.path }, 'unhandled error');
    return c.json({ error: { code: 'internal', message: 'Something went wrong' } }, 500);
  });

  return app;
};

export type App = ReturnType<typeof createApp>;
