import { randomUUID } from 'node:crypto';
import {
  errorBodySchema,
  MODULE_FLAG,
  MODULES,
  type Layout,
  type ModuleKey,
  type OptionKind,
  type Role,
} from '@picklab/shared';
import { pino } from 'pino';
import type { z } from 'zod';
import { createApp, type AppConfig, type Deps } from '../src/app';
import { cookieUserId } from '../src/auth';
import { openDb, type Db } from '../src/db/client';
import { profiles, user, variants, variantSets } from '../src/db/schema';
import { cachedFlags, type FlagSource, type RawFlag } from '../src/flags';
import type { Storage } from '../src/storage';

export const TEST_SECRET = 'test-secret';
export const ADMIN_EMAIL = 'admin@picklab.test';
const HEADER = 'x-test-user';

/* Fake clock */
export const makeClock = (start = '2026-11-28T10:00:00.000Z') => {
  let t = new Date(start).getTime();
  return { now: () => new Date(t), advance: (ms: number) => void (t += ms) };
};

/* Fake Flagsmith: per-identity or '*' overrides of raw flag values, call counter, outage switch. */
type FlagOverride = {
  votingEnabled?: boolean;
  modules?: Partial<Record<ModuleKey, { enabled: boolean; config?: unknown }>>;
};

export const makeFlags = () => {
  const state = new Map<string, FlagOverride>();
  let failing = false;
  let calls = 0;
  const source: FlagSource = async (u) => {
    calls++;
    if (failing) throw new Error('flagsmith down');
    const all = state.get('*') ?? {};
    const mine = state.get(u.id) ?? {};
    const raw = new Map<string, RawFlag>();
    raw.set('voting_enabled', { enabled: mine.votingEnabled ?? all.votingEnabled ?? true, value: null });
    for (const m of MODULES) {
      const f = mine.modules?.[m] ?? all.modules?.[m] ?? { enabled: true };
      raw.set(MODULE_FLAG[m], { enabled: f.enabled, value: f.config });
    }
    return (key) => raw.get(key);
  };
  return {
    source,
    set: (who: string, o: FlagOverride) => {
      const prev = state.get(who) ?? {};
      state.set(who, { ...prev, ...o, modules: { ...prev.modules, ...o.modules } });
    },
    fail: (on = true) => void (failing = on),
    calls: () => calls,
  };
};

/* Fake storage: R2-like URLs, `put(key)` marks an object as uploaded. */
export const makeStorage = () => {
  const keys = new Set<string>();
  const storage: Storage = {
    signPut: async (key) => `https://r2.test/put/${key}`,
    exists: async (key) => keys.has(key),
    imageUrl: (key) => `https://img.test/${key}`,
  };
  return { ...storage, put: (key: string) => void keys.add(key) };
};

export type TestUser = { id: string; role: Role; wave: number; email: string | null };

export const makeApp = async (overrides: Omit<Partial<Deps>, 'config'> & { config?: Partial<AppConfig> } = {}) => {
  const { db } = await openDb({});
  const clock = makeClock();
  const flags = makeFlags();
  const storage = makeStorage();
  const config: AppConfig = {
    secret: TEST_SECRET,
    secureCookies: false,
    adminEmails: [ADMIN_EMAIL],
    allowDevLogin: true,
    flagsmithDashboardUrl: 'https://flagsmith.test/project/1/environment/dev',
    ...overrides.config,
  };
  const deps: Deps = {
    db,
    flags: cachedFlags(flags.source, clock.now),
    storage,
    now: clock.now,
    getUser: (c) => c.req.header(HEADER) ?? cookieUserId(c, TEST_SECRET),
    logger: pino({ level: 'silent' }),
    ...overrides,
    config,
  };
  const app = createApp(deps);

  type ReqOpts = { as?: TestUser; body?: unknown; cookie?: string; headers?: Record<string, string> };
  const req = async (method: string, url: string, opts: ReqOpts = {}) => {
    const headers: Record<string, string> = { ...opts.headers };
    if (opts.as) headers[HEADER] = opts.as.id;
    if (opts.cookie) headers.cookie = opts.cookie;
    if (opts.body !== undefined) headers['content-type'] = 'application/json';
    const res = await app.request(url, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const text = await res.text();
    const body: unknown = text ? JSON.parse(text) : undefined;
    const err = errorBodySchema.safeParse(body);
    return {
      res,
      status: res.status,
      body,
      code: err.success ? err.data.error.code : undefined,
      cookie: res.headers.get('set-cookie')?.split(';')[0],
      /** Parse the body with the shared contract schema: asserts the shape and types it. */
      parse: <S extends z.ZodType>(schema: S): z.infer<S> => schema.parse(body),
    };
  };

  return { app, db, flags, clock, storage, deps, req };
};

export const as = (u: TestUser) => ({ as: u });

export const makeUser = async (
  db: Db,
  o: { role?: Role; wave?: number; consented?: boolean; email?: string } = {},
): Promise<TestUser> => {
  const id = randomUUID();
  const role = o.role ?? 'tester';
  const wave = o.wave ?? 1;
  await db.insert(user).values({ id, email: o.email ?? null, isAnonymous: !o.email, name: o.email ? 'Test' : '' });
  await db.insert(profiles).values({
    userId: id,
    role,
    wave,
    consentedAt: o.consented === false ? null : new Date('2026-11-28T09:00:00.000Z'),
  });
  return { id, role, wave, email: o.email ?? null };
};

export type TestSet = { id: string; variantIds: string[] };

export const makeSet = async (
  db: Db,
  o: { creator: TestUser; module?: ModuleKey; kind?: OptionKind; options?: number; status?: 'active' | 'deleted'; createdAt?: Date },
): Promise<TestSet> => {
  const id = randomUUID();
  const kind = o.kind ?? 'text';
  const n = o.options ?? 3;
  await db.insert(variantSets).values({
    id,
    creatorId: o.creator.id,
    module: o.module ?? 'captions',
    title: `Set ${id.slice(0, 4)}`,
    status: o.status ?? 'active',
    ...(o.createdAt ? { createdAt: o.createdAt } : {}),
  });
  const variantIds = Array.from({ length: n }, () => randomUUID());
  await db.insert(variants).values(
    variantIds.map((vid, position) => ({
      id: vid,
      setId: id,
      kind,
      imageKey: kind === 'image' ? `u/${o.creator.id}/${randomUUID()}.png` : null,
      text: kind === 'text' ? `Option ${position + 1}` : null,
      position,
    })),
  );
  return { id, variantIds };
};

/** Valid responses for a set in a layout: first option picked, or yes on the first and no on the rest. */
export const answers = (layout: Layout, variantIds: string[], yes: string[] = variantIds.slice(0, 1)) =>
  layout === 'grid' || layout === 'this_or_that'
    ? [{ variantId: yes[0] ?? '', signal: 'pick' as const }]
    : variantIds.map((variantId) => ({ variantId, signal: yes.includes(variantId) ? ('yes' as const) : ('no' as const) }));
