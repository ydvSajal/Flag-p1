import { asc, count, eq } from 'drizzle-orm';
import {
  mySetsResponseSchema,
  nextSetsResponseSchema,
  sessionSchema,
  setResultsResponseSchema,
  uploadSignResponseSchema,
  type Layout,
} from '@picklab/shared';
import { describe, expect, it } from 'vitest';
import { variants, variantSets } from '../src/db/schema';
import { ADMIN_EMAIL, answers, as, makeApp, makeSet, makeUser, type TestSet, type TestUser } from './helpers';

type T = Awaited<ReturnType<typeof makeApp>>;
const creatorOf = (t: T, name = 'c') => makeUser(t.db, { role: 'creator', email: `${name}@picklab.test` });
const createSet = (t: T, u: TestUser, body: unknown) => t.req('POST', '/api/sets', { ...as(u), body });
const texts = (...xs: string[]) => xs.map((text) => ({ kind: 'text', text }));
const setCount = async (t: T) => (await t.db.select({ n: count() }).from(variantSets))[0]?.n;

/** A tester votes on the only set in captions with the given layout and "yes" options. */
const vote = async (t: T, set: TestSet, layout: Layout, yes: string[]) => {
  const u = await makeUser(t.db);
  const s = (await t.req('POST', '/api/sessions', { ...as(u), body: { module: 'captions', layout } })).parse(sessionSchema);
  const r = await t.req('POST', '/api/set-results', {
    ...as(u),
    body: { id: crypto.randomUUID(), sessionId: s.id, setId: set.id, durationMs: 1000, responses: answers(layout, set.variantIds, yes) },
  });
  expect(r.status).toBe(200);
  return u;
};

describe('POST /api/sets', () => {
  it('A-38 image set with 3 uploaded keys', async () => {
    const t = await makeApp();
    const u = await creatorOf(t);
    const files = [1, 2, 3].map(() => ({ contentType: 'image/webp', size: 1000 }));
    const { uploads } = (await t.req('POST', '/api/uploads/sign', { ...as(u), body: { files } })).parse(uploadSignResponseSchema);
    uploads.forEach((up) => t.storage.put(up.key));
    const r = await createSet(t, u, {
      module: 'thumbnails',
      title: 'Which thumb?',
      options: uploads.map((up) => ({ kind: 'image', imageKey: up.key })),
    });
    expect(r.status).toBe(201);
    const id = (r.body as { id: string }).id;
    const rows = await t.db.select().from(variants).where(eq(variants.setId, id)).orderBy(asc(variants.position));
    expect(rows.map((v) => v.position)).toEqual([0, 1, 2]);
    expect(rows.map((v) => v.imageKey)).toEqual(uploads.map((up) => up.key));
  });

  it('A-39 text set with 2 texts', async () => {
    const t = await makeApp();
    const u = await creatorOf(t);
    expect((await createSet(t, u, { module: 'captions', title: 'Hook', options: texts('a', 'b') })).status).toBe(201);
  });

  it('A-40 bad shapes are 400 invalid_body', async () => {
    const t = await makeApp();
    const u = await creatorOf(t);
    t.storage.put(`u/${u.id}/k.png`);
    const bad = [
      { module: 'captions', title: 'x', options: texts('a') },
      { module: 'captions', title: 'x', options: texts('a', 'b', 'c', 'd', 'e') },
      { module: 'captions', title: 'x', options: [...texts('a'), { kind: 'image', imageKey: `u/${u.id}/k.png` }] },
      { module: 'captions', title: '  ', options: texts('a', 'b') },
      { module: 'captions', title: 'x', options: texts('a', 'b'.repeat(281)) },
      { module: 'thumbnails', title: 'x', options: texts('a', 'b') },
    ];
    for (const body of bad) expect((await createSet(t, u, body)).code).toBe('invalid_body');
    expect(await setCount(t)).toBe(0);
  });

  it('A-41 unknown key or another user prefix is 400, nothing written', async () => {
    const t = await makeApp();
    const u = await creatorOf(t);
    const other = await creatorOf(t, 'o');
    const mine = `u/${u.id}/${crypto.randomUUID()}.png`;
    const theirs = `u/${other.id}/${crypto.randomUUID()}.png`;
    t.storage.put(mine);
    t.storage.put(theirs);
    const missing = `u/${u.id}/${crypto.randomUUID()}.png`;
    const opts = (k: string) => [{ kind: 'image', imageKey: mine }, { kind: 'image', imageKey: k }];
    expect((await createSet(t, u, { module: 'thumbnails', title: 'x', options: opts(missing) })).status).toBe(400);
    expect((await createSet(t, u, { module: 'thumbnails', title: 'x', options: opts(theirs) })).status).toBe(400);
    expect(await setCount(t)).toBe(0);
  });

  it('A-42 module off for creators is 403 module_off', async () => {
    const t = await makeApp();
    const u = await creatorOf(t);
    t.flags.set('*', { modules: { captions: { enabled: false } } });
    expect((await createSet(t, u, { module: 'captions', title: 'x', options: texts('a', 'b') })).code).toBe('module_off');
  });

  it('A-42b a tester cannot create sets', async () => {
    const t = await makeApp();
    const u = await makeUser(t.db);
    expect((await createSet(t, u, { module: 'captions', title: 'x', options: texts('a', 'b') })).code).toBe('forbidden');
  });
});

describe('GET /api/sets/mine and results', () => {
  it('A-43 only my active sets, newest first, with voter counts', async () => {
    const t = await makeApp();
    const u = await creatorOf(t);
    const other = await creatorOf(t, 'o');
    const old = await makeSet(t.db, { creator: u, createdAt: new Date('2026-11-27T10:00:00Z') });
    const fresh = await makeSet(t.db, { creator: u, module: 'thumbnails', createdAt: new Date('2026-11-28T08:00:00Z') });
    await makeSet(t.db, { creator: u, status: 'deleted' });
    await makeSet(t.db, { creator: other });
    await vote(t, old, 'grid', old.variantIds.slice(0, 1));
    const { sets } = (await t.req('GET', '/api/sets/mine', as(u))).parse(mySetsResponseSchema);
    expect(sets.map((s) => s.id)).toEqual([fresh.id, old.id]);
    expect(sets.map((s) => s.voters)).toEqual([0, 1]);
    expect(sets[1]?.preview).toHaveLength(3);
  });

  it('A-44 results: scores, 404 for other creators, byLayout for admins', async () => {
    const t = await makeApp();
    const owner = await creatorOf(t);
    const set = await makeSet(t.db, { creator: owner, options: 2 });
    const [a = '', b = ''] = set.variantIds;
    await vote(t, set, 'grid', [a]);
    await vote(t, set, 'grid', [a]);
    await vote(t, set, 'swipe', [a]);
    await vote(t, set, 'swipe', [a, b]);
    const res = (await t.req('GET', `/api/sets/${set.id}/results`, as(owner))).parse(setResultsResponseSchema);
    expect(res.voters).toBe(4);
    expect(res.options.map((o) => [o.variantId, o.positive, o.score])).toEqual([
      [a, 4, 1],
      [b, 1, 0.25],
    ]);
    expect(res.byLayout).toBeUndefined();
    expect((await t.req('GET', `/api/sets/${set.id}/results`, as(await creatorOf(t, 'x')))).status).toBe(404);
    const admin = await makeUser(t.db, { role: 'creator', email: ADMIN_EMAIL });
    const asAdmin = (await t.req('GET', `/api/sets/${set.id}/results`, as(admin))).parse(setResultsResponseSchema);
    expect(asAdmin.byLayout?.find((l) => l.layout === 'swipe')).toMatchObject({ voters: 2 });
  });
});

describe('DELETE /api/sets/:id', () => {
  it('A-52 owner deletes: gone from mine and next, admin still reads results', async () => {
    const t = await makeApp();
    const owner = await creatorOf(t);
    const doomed = await makeSet(t.db, { creator: owner });
    const kept = await makeSet(t.db, { creator: owner });
    await vote(t, doomed, 'grid', doomed.variantIds.slice(0, 1));
    const tester = await makeUser(t.db);
    const s = (await t.req('POST', '/api/sessions', { ...as(tester), body: { module: 'captions', layout: 'grid' } })).parse(
      sessionSchema,
    );
    expect((await t.req('DELETE', `/api/sets/${doomed.id}`, as(owner))).status).toBe(204);
    const mine = (await t.req('GET', '/api/sets/mine', as(owner))).parse(mySetsResponseSchema);
    expect(mine.sets.map((x) => x.id)).toEqual([kept.id]);
    const next = (await t.req('GET', `/api/sessions/${s.id}/next`, as(tester))).parse(nextSetsResponseSchema);
    expect(next.sets.map((x) => x.id)).toEqual([kept.id]);
    const admin = await makeUser(t.db, { role: 'creator', email: ADMIN_EMAIL });
    const res = await t.req('GET', `/api/sets/${doomed.id}/results`, as(admin));
    expect(res.parse(setResultsResponseSchema).voters).toBe(1);
  });

  it('A-53 another creator gets 404', async () => {
    const t = await makeApp();
    const owner = await creatorOf(t);
    const set = await makeSet(t.db, { creator: owner });
    expect((await t.req('DELETE', `/api/sets/${set.id}`, as(await creatorOf(t, 'x')))).status).toBe(404);
  });
});
