import { count, eq } from 'drizzle-orm';
import {
  liveResponseSchema,
  overviewResponseSchema,
  sessionSchema,
  type Layout,
  type LayoutStats,
} from '@picklab/shared';
import { describe, expect, it } from 'vitest';
import { profiles, responses, sessions, setResults, user, variantSets } from '../src/db/schema';
import { ADMIN_EMAIL, answers, as, makeApp, makeSet, makeUser, type TestUser } from './helpers';

type T = Awaited<ReturnType<typeof makeApp>>;
const MIN = 60_000;

const adminOf = (t: T) => makeUser(t.db, { role: 'creator', email: ADMIN_EMAIL });

const insertSession = async (
  t: T,
  o: { layout?: Layout; seenAgoMs?: number; completed?: boolean; tester?: TestUser },
) => {
  const tester = o.tester ?? (await makeUser(t.db, { wave: 2 }));
  const id = crypto.randomUUID();
  const seen = new Date(t.clock.now().getTime() - (o.seenAgoMs ?? 0));
  await t.db.insert(sessions).values({
    id,
    testerId: tester.id,
    module: 'captions',
    layout: o.layout ?? 'grid',
    targetCount: 5,
    startedAt: seen,
    lastSeenAt: seen,
    completedAt: o.completed ? seen : null,
  });
  return { id, tester };
};

describe('GET /api/admin/live', () => {
  it('A-45 guests and non-admin creators get 404', async () => {
    const t = await makeApp();
    const guest = await makeUser(t.db);
    const creator = await makeUser(t.db, { role: 'creator', email: 'c@picklab.test' });
    for (const who of [guest, creator]) {
      expect((await t.req('GET', '/api/admin/live', as(who))).status).toBe(404);
      expect((await t.req('GET', '/api/admin/overview', as(who))).status).toBe(404);
    }
    expect((await t.req('GET', '/api/admin/live')).status).toBe(404);
  });

  it('A-46, A-47 statuses, newest first, last hour only', async () => {
    const t = await makeApp();
    await insertSession(t, { seenAgoMs: 5 * MIN });
    await insertSession(t, { seenAgoMs: 30_000 });
    await insertSession(t, { seenAgoMs: 10_000, completed: true });
    await insertSession(t, { seenAgoMs: 61 * MIN });
    const live = (await t.req('GET', '/api/admin/live', as(await adminOf(t)))).parse(liveResponseSchema);
    expect(live.visitors.map((v) => v.status)).toEqual(['finished', 'voting', 'dropped']);
    expect(live.now).toBe(t.clock.now().toISOString());
  });

  it('A-48 short ids only, no email or full id, split matches sessions', async () => {
    const t = await makeApp();
    const a = await insertSession(t, { layout: 'swipe', seenAgoMs: 1000 });
    await insertSession(t, { layout: 'swipe', seenAgoMs: 2000 });
    await insertSession(t, { layout: 'yes_no', seenAgoMs: 3000 });
    const r = await t.req('GET', '/api/admin/live', as(await adminOf(t)));
    const live = r.parse(liveResponseSchema);
    for (const v of live.visitors) expect(v.shortId).toHaveLength(6);
    const raw = JSON.stringify(r.body);
    expect(raw).not.toContain(a.tester.id);
    expect(raw).not.toContain('@');
    expect(live.split).toEqual({ grid: 0, swipe: 2, this_or_that: 0, yes_no: 1 });
    expect(live.counters).toMatchObject({ onSite: 3, sessionsToday: 3 });
  });
});

describe('GET /api/admin/overview', () => {
  it('A-49 completion rate and average duration per layout', async () => {
    const t = await makeApp();
    const creator = await makeUser(t.db, { role: 'creator', email: 'c@picklab.test' });
    const set = await makeSet(t.db, { creator });
    const result = async (layout: Layout, completed: boolean, durationMs: number) => {
      const s = await insertSession(t, { layout, completed });
      await t.db.insert(setResults).values({
        id: crypto.randomUUID(),
        sessionId: s.id,
        setId: set.id,
        testerId: s.tester.id,
        layout,
        durationMs,
      });
    };
    await result('grid', true, 1000);
    await result('grid', false, 3000);
    await result('swipe', true, 500);
    await result('swipe', true, 1500);
    const o = (await t.req('GET', '/api/admin/overview', as(await adminOf(t)))).parse(overviewResponseSchema);
    const by = (l: Layout) => o.byLayout.find((x) => x.layout === l);
    expect(by('grid')).toMatchObject({ started: 2, completed: 1, completionRate: 0.5, avgDurationMs: 2000, visitors: 2 });
    expect(by('swipe')).toMatchObject({ started: 2, completed: 2, completionRate: 1, avgDurationMs: 1000 });
    expect(o.links.flag).toContain('flagsmith.test');
  });

  it('A-50 no data gives zeros, not NaN', async () => {
    const t = await makeApp();
    const r = await t.req('GET', '/api/admin/overview', as(await adminOf(t)));
    expect(r.status).toBe(200);
    const o = r.parse(overviewResponseSchema);
    expect(o.responsesTotal).toBe(0);
    const zero: Omit<LayoutStats, 'layout'> = { visitors: 0, started: 0, completed: 0, completionRate: 0, avgDurationMs: 0 };
    for (const row of o.byLayout) expect(row).toMatchObject(zero);
    expect(o.visitorsByWave).toEqual({ '1': 1, '2': 0, '3': 0 });
  });
});

describe('rate limit and account deletion', () => {
  it('A-51 61st set result in a minute is 429; fine after 60 s', async () => {
    const t = await makeApp();
    const creator = await makeUser(t.db, { role: 'creator', email: 'c@picklab.test' });
    const set = await makeSet(t.db, { creator });
    const u = await makeUser(t.db);
    const s = (await t.req('POST', '/api/sessions', { ...as(u), body: { module: 'captions', layout: 'grid' } })).parse(sessionSchema);
    const body = { id: crypto.randomUUID(), sessionId: s.id, setId: set.id, durationMs: 10, responses: answers('grid', set.variantIds) };
    for (let i = 0; i < 60; i++) expect((await t.req('POST', '/api/set-results', { ...as(u), body })).status).toBe(200);
    const blocked = await t.req('POST', '/api/set-results', { ...as(u), body });
    expect([blocked.status, blocked.code]).toEqual([429, 'rate_limited']);
    t.clock.advance(60_000);
    expect((await t.req('POST', '/api/set-results', { ...as(u), body })).status).toBe(200);
  });

  it('A-54 DELETE /me removes everything; a creator keeps soft-deleted sets', async () => {
    const t = await makeApp();
    const creator = await makeUser(t.db, { role: 'creator', email: 'c@picklab.test' });
    const set = await makeSet(t.db, { creator });
    const own = await makeSet(t.db, { creator: await makeUser(t.db, { role: 'creator', email: 'd@picklab.test' }) });
    // The creator also votes on someone else's set, so they have sessions and responses too.
    const s = (await t.req('POST', '/api/sessions', { ...as(creator), body: { module: 'captions', layout: 'swipe' } })).parse(
      sessionSchema,
    );
    await t.req('POST', '/api/set-results', {
      ...as(creator),
      body: { id: crypto.randomUUID(), sessionId: s.id, setId: own.id, durationMs: 10, responses: answers('swipe', own.variantIds) },
    });
    expect((await t.db.select({ n: count() }).from(responses))[0]?.n).toBe(3);

    expect((await t.req('DELETE', '/api/me', as(creator))).status).toBe(204);
    const left = async (table: typeof profiles | typeof user) => (await t.db.select({ n: count() }).from(table))[0]?.n;
    expect(await left(profiles)).toBe(1);
    expect(await left(user)).toBe(1);
    expect((await t.db.select({ n: count() }).from(sessions))[0]?.n).toBe(0);
    expect((await t.db.select({ n: count() }).from(setResults))[0]?.n).toBe(0);
    expect((await t.db.select({ n: count() }).from(responses))[0]?.n).toBe(0);
    const [kept] = await t.db.select().from(variantSets).where(eq(variantSets.id, set.id));
    expect(kept).toMatchObject({ status: 'deleted', creatorId: null });
  });
});
