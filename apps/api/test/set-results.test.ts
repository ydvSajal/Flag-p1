import { count, eq, sql } from 'drizzle-orm';
import { nextSetsResponseSchema, sessionSchema, setResultResponseSchema, type Layout } from '@picklab/shared';
import { describe, expect, it } from 'vitest';
import { responses, sessions, setResults } from '../src/db/schema';
import { answers, as, makeApp, makeSet, makeUser, type TestUser } from './helpers';

/** n sets of `options` choices, a consented tester with an open session in `layout`, and its first set. */
const setup = async (layout: Layout, o: { sets?: number; options?: number; perSession?: number } = {}) => {
  const t = await makeApp();
  if (o.perSession) t.flags.set('*', { modules: { captions: { enabled: true, config: { sets_per_session: o.perSession } } } });
  const creator = await makeUser(t.db, { role: 'creator', email: 'c@picklab.test' });
  const sets = await Promise.all(
    Array.from({ length: o.sets ?? 3 }, () => makeSet(t.db, { creator, options: o.options ?? 3 })),
  );
  const u = await makeUser(t.db);
  const s = (await t.req('POST', '/api/sessions', { ...as(u), body: { module: 'captions', layout } })).parse(sessionSchema);
  const next = (await t.req('GET', `/api/sessions/${s.id}/next`, as(u))).parse(nextSetsResponseSchema);
  const first = next.sets[0];
  if (!first) throw new Error('no set');
  const variantIds = first.variants.map((v) => v.id);
  const post = (body: Record<string, unknown> = {}, who: TestUser = u) =>
    t.req('POST', '/api/set-results', {
      ...as(who),
      body: {
        id: crypto.randomUUID(),
        sessionId: s.id,
        setId: first.id,
        durationMs: 1200,
        responses: answers(layout, variantIds),
        ...body,
      },
    });
  const rows = async () => {
    const [a] = await t.db.select({ n: count() }).from(setResults);
    const [b] = await t.db.select({ n: count() }).from(responses);
    return { results: a?.n, responses: b?.n };
  };
  return { t, u, s, sets, first, variantIds, post, rows };
};

describe('POST /api/set-results', () => {
  it('A-29 valid grid result', async () => {
    const { post, rows } = await setup('grid');
    const r = await post();
    expect(r.status).toBe(200);
    expect(r.parse(setResultResponseSchema)).toEqual({ doneCount: 1, targetCount: 3, sessionComplete: false });
    expect(await rows()).toEqual({ results: 1, responses: 1 });
  });

  it('A-30 swipe on a 4-option set writes 4 responses', async () => {
    const { post, rows } = await setup('swipe', { options: 4 });
    expect((await post()).status).toBe(200);
    expect((await rows()).responses).toBe(4);
  });

  it('A-31 same id twice: same body, one row', async () => {
    const { post, rows } = await setup('grid');
    const id = crypto.randomUUID();
    const a = await post({ id });
    const b = await post({ id });
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(b.body).toEqual(a.body);
    expect(await rows()).toEqual({ results: 1, responses: 1 });
  });

  it('A-32 a different id for the same set adds nothing', async () => {
    const { post, rows } = await setup('grid');
    await post();
    const b = await post();
    expect(b.status).toBe(200);
    expect(b.parse(setResultResponseSchema).doneCount).toBe(1);
    expect(await rows()).toEqual({ results: 1, responses: 1 });
  });

  it('A-33 responses that do not fit are 400 and write nothing', async () => {
    const grid = await setup('grid');
    const [a, b] = grid.variantIds;
    const twoPicks = await grid.post({ responses: [{ variantId: a, signal: 'pick' }, { variantId: b, signal: 'pick' }] });
    expect([twoPicks.status, twoPicks.code]).toEqual([400, 'invalid_responses']);
    const foreign = grid.sets.find((x) => x.id !== grid.first.id)?.variantIds[0];
    const otherSet = await grid.post({ responses: [{ variantId: foreign, signal: 'pick' }] });
    expect(otherSet.code).toBe('invalid_responses');
    expect(await grid.rows()).toEqual({ results: 0, responses: 0 });

    const yesNo = await setup('yes_no');
    const missing = await yesNo.post({ responses: answers('yes_no', yesNo.variantIds).slice(1) });
    expect([missing.status, missing.code]).toEqual([400, 'invalid_responses']);
    expect(await yesNo.rows()).toEqual({ results: 0, responses: 0 });
  });

  it('A-34 last set completes the session; more is 409 session_closed', async () => {
    const { t, s, sets, first, post } = await setup('grid', { sets: 2, perSession: 1 });
    const r = (await post()).parse(setResultResponseSchema);
    expect(r).toEqual({ doneCount: 1, targetCount: 1, sessionComplete: true });
    const [row] = await t.db.select().from(sessions).where(eq(sessions.id, s.id));
    expect(row?.completedAt).not.toBeNull();
    const other = sets.find((x) => x.id !== first.id);
    const closed = await post({ setId: other?.id, responses: answers('grid', other?.variantIds ?? []) });
    expect([closed.status, closed.code]).toEqual([409, 'session_closed']);
  });

  it('A-34a session of another user is 404', async () => {
    const { t, post } = await setup('grid');
    const stranger = await makeUser(t.db);
    expect((await post({}, stranger)).status).toBe(404);
  });

  it('A-34b module turned off mid-session is 403 and writes nothing', async () => {
    const { t, u, post, rows } = await setup('grid');
    t.flags.set(u.id, { modules: { captions: { enabled: false } } });
    t.clock.advance(11_000);
    const r = await post();
    expect([r.status, r.code]).toEqual([403, 'module_off']);
    expect((await rows()).results).toBe(0);
  });

  it('A-34c voting off mid-session is 503 and writes nothing', async () => {
    const { t, post, rows } = await setup('grid');
    t.flags.set('*', { votingEnabled: false });
    t.clock.advance(11_000);
    const r = await post();
    expect([r.status, r.code]).toEqual([503, 'voting_paused']);
    expect((await rows()).results).toBe(0);
  });

  it('A-34d durationMs out of range is 400 invalid_body', async () => {
    const { post } = await setup('grid');
    expect((await post({ durationMs: -1 })).code).toBe('invalid_body');
    expect((await post({ durationMs: 600_001 })).code).toBe('invalid_body');
  });

  it('A-34e a failing responses insert rolls back the set result', async () => {
    const { t, post, rows } = await setup('grid');
    await t.db.execute(sql`create function boom() returns trigger language plpgsql as $$ begin raise exception 'boom'; end $$`);
    await t.db.execute(sql`create trigger boom before insert on responses for each row execute function boom()`);
    expect((await post()).status).toBe(500);
    expect((await rows()).results).toBe(0);
  });
});
