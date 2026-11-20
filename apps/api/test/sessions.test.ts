import { eq } from 'drizzle-orm';
import { nextSetsResponseSchema, sessionDetailSchema, sessionSchema, type Layout } from '@picklab/shared';
import { describe, expect, it } from 'vitest';
import { sessions } from '../src/db/schema';
import { answers, as, makeApp, makeSet, makeUser, type TestUser } from './helpers';

type T = Awaited<ReturnType<typeof makeApp>>;

const seed = async (t: T, n: number, module: 'captions' | 'thumbnails' = 'captions') => {
  const creator = await makeUser(t.db, { role: 'creator', email: `c${crypto.randomUUID()}@picklab.test` });
  return Promise.all(Array.from({ length: n }, () => makeSet(t.db, { creator, module })));
};

const start = (t: T, u: TestUser, layout: string = 'swipe', module = 'captions') =>
  t.req('POST', '/api/sessions', { ...as(u), body: { module, layout } });

describe('POST /api/sessions', () => {
  it('A-15 creates a session with target = sets_per_session', async () => {
    const t = await makeApp();
    await seed(t, 8);
    const u = await makeUser(t.db);
    const r = await start(t, u);
    expect(r.status).toBe(201);
    expect(r.parse(sessionSchema)).toMatchObject({ targetCount: 5, doneCount: 0, layout: 'swipe', resumed: false });
  });

  it('A-16 target is capped by sets left', async () => {
    const t = await makeApp();
    await seed(t, 3);
    const u = await makeUser(t.db);
    expect((await start(t, u)).parse(sessionSchema).targetCount).toBe(3);
  });

  it('A-17 no sets left is 409', async () => {
    const t = await makeApp();
    const u = await makeUser(t.db);
    const r = await start(t, u);
    expect([r.status, r.code]).toEqual([409, 'no_sets_left']);
  });

  it('A-18 no consent is 403 consent_required', async () => {
    const t = await makeApp();
    await seed(t, 2);
    const u = await makeUser(t.db, { consented: false });
    const r = await start(t, u);
    expect([r.status, r.code]).toEqual([403, 'consent_required']);
  });

  it('A-19 module off is 403 module_off', async () => {
    const t = await makeApp();
    await seed(t, 2);
    const u = await makeUser(t.db);
    t.flags.set(u.id, { modules: { captions: { enabled: false } } });
    const r = await start(t, u);
    expect([r.status, r.code]).toEqual([403, 'module_off']);
  });

  it('A-20 voting off is 503 voting_paused', async () => {
    const t = await makeApp();
    await seed(t, 2);
    const u = await makeUser(t.db);
    t.flags.set('*', { votingEnabled: false });
    const r = await start(t, u);
    expect([r.status, r.code]).toEqual([503, 'voting_paused']);
  });

  it('A-21 unknown layout is 400 invalid_body', async () => {
    const t = await makeApp();
    await seed(t, 2);
    const u = await makeUser(t.db);
    const r = await start(t, u, 'carousel');
    expect([r.status, r.code]).toEqual([400, 'invalid_body']);
  });

  it('A-22 an open session is resumed with its original layout', async () => {
    const t = await makeApp();
    await seed(t, 4);
    const u = await makeUser(t.db);
    const first = (await start(t, u, 'swipe')).parse(sessionSchema);
    const again = await start(t, u, 'grid');
    expect(again.parse(sessionSchema)).toMatchObject({ id: first.id, layout: 'swipe', resumed: true });
  });

  it('A-23 after completion a new session takes the new layout', async () => {
    const t = await makeApp();
    await seed(t, 4);
    const u = await makeUser(t.db);
    const first = (await start(t, u, 'swipe')).parse(sessionSchema);
    await t.db.update(sessions).set({ completedAt: t.clock.now() }).where(eq(sessions.id, first.id));
    const second = (await start(t, u, 'grid')).parse(sessionSchema);
    expect(second.id).not.toBe(first.id);
    expect(second).toMatchObject({ layout: 'grid', resumed: false });
  });
});

describe('GET /api/sessions/:id and /next', () => {
  const next = async (t: T, u: TestUser, id: string) =>
    (await t.req('GET', `/api/sessions/${id}/next`, as(u))).parse(nextSetsResponseSchema);

  it('A-24 next gives up to 2 unfinished, active sets of the module', async () => {
    const t = await makeApp();
    const sets = await seed(t, 4);
    const other = await seed(t, 2, 'thumbnails');
    const creator = await makeUser(t.db, { role: 'creator', email: 'del@picklab.test' });
    const deleted = await makeSet(t.db, { creator, status: 'deleted' });
    const u = await makeUser(t.db);
    const s = (await start(t, u, 'grid')).parse(sessionSchema);
    const first = await next(t, u, s.id);
    expect(first.sets).toHaveLength(2);
    const done = first.sets[0];
    const ids = sets.map((x) => x.id);
    for (const set of first.sets) {
      expect(ids).toContain(set.id);
      expect(set.variants.length).toBeGreaterThanOrEqual(2);
      expect(set.variants.length).toBeLessThanOrEqual(4);
    }
    await t.req('POST', '/api/set-results', {
      ...as(u),
      body: {
        id: crypto.randomUUID(),
        sessionId: s.id,
        setId: done?.id,
        durationMs: 900,
        responses: answers('grid', done?.variants.map((v) => v.id) ?? []),
      },
    });
    const after = await next(t, u, s.id);
    const seen = after.sets.map((x) => x.id);
    expect(seen).not.toContain(done?.id);
    expect(seen).not.toContain(deleted.id);
    for (const o of other) expect(seen).not.toContain(o.id);
  });

  it('A-25 next is stable without voting', async () => {
    const t = await makeApp();
    await seed(t, 4);
    const u = await makeUser(t.db);
    const s = (await start(t, u)).parse(sessionSchema);
    expect(await next(t, u, s.id)).toEqual(await next(t, u, s.id));
  });

  it('A-26 two visitors see a different set or option order', async () => {
    const t = await makeApp();
    await seed(t, 6);
    const order = async () => {
      const u = await makeUser(t.db);
      const s = (await start(t, u)).parse(sessionSchema);
      const n = await next(t, u, s.id);
      return n.sets.map((x) => `${x.id}:${x.variants.map((v) => v.id).join(',')}`).join('|');
    };
    const orders = new Set([await order(), await order(), await order()]);
    expect(orders.size).toBeGreaterThan(1);
  });

  it('A-27 another user gets 404 on the session and next', async () => {
    const t = await makeApp();
    await seed(t, 2);
    const u = await makeUser(t.db);
    const stranger = await makeUser(t.db);
    const s = (await start(t, u)).parse(sessionSchema);
    expect((await t.req('GET', `/api/sessions/${s.id}`, as(stranger))).status).toBe(404);
    expect((await t.req('GET', `/api/sessions/${s.id}/next`, as(stranger))).status).toBe(404);
    expect((await t.req('GET', '/api/sessions/not-a-uuid', as(u))).status).toBe(404);
    const own = (await t.req('GET', `/api/sessions/${s.id}`, as(u))).parse(sessionDetailSchema);
    expect(own).toMatchObject({ id: s.id, completed: false });
  });

  it('A-28 next updates last_seen_at to the clock', async () => {
    const t = await makeApp();
    await seed(t, 2);
    const u = await makeUser(t.db);
    const s = (await start(t, u, 'grid' satisfies Layout)).parse(sessionSchema);
    t.clock.advance(42_000);
    await next(t, u, s.id);
    const [row] = await t.db.select().from(sessions).where(eq(sessions.id, s.id));
    expect(row?.lastSeenAt.toISOString()).toBe(t.clock.now().toISOString());
  });
});
