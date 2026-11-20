import { modulesResponseSchema } from '@picklab/shared';
import { describe, expect, it } from 'vitest';
import { setResults } from '../src/db/schema';
import { as, makeApp, makeSet, makeUser } from './helpers';

const OFF = { enabled: false };

describe('GET /api/modules', () => {
  it('A-08 only modules enabled for this user are listed', async () => {
    const t = await makeApp();
    const u = await makeUser(t.db);
    t.flags.set(u.id, { modules: { thumbnails: { enabled: true }, captions: OFF, reel_captions: OFF, visuals: OFF } });
    const body = (await t.req('GET', '/api/modules', as(u))).parse(modulesResponseSchema);
    expect(body.modules.map((m) => m.key)).toEqual(['thumbnails']);
  });

  it('A-09 flag JSON sets title, instructions and sets per session', async () => {
    const t = await makeApp();
    const u = await makeUser(t.db);
    t.flags.set('*', {
      modules: {
        captions: { enabled: true, config: JSON.stringify({ title: 'Hooks', instructions: 'Pick one', sets_per_session: 3 }) },
      },
    });
    const body = (await t.req('GET', '/api/modules', as(u))).parse(modulesResponseSchema);
    expect(body.modules.find((m) => m.key === 'captions')).toMatchObject({
      title: 'Hooks',
      instructions: 'Pick one',
      setsPerSession: 3,
    });
  });

  it('A-10 invalid JSON keeps the module with defaults', async () => {
    const t = await makeApp();
    const u = await makeUser(t.db);
    t.flags.set('*', { modules: { captions: { enabled: true, config: '{not json' } } });
    const body = (await t.req('GET', '/api/modules', as(u))).parse(modulesResponseSchema);
    expect(body.modules.find((m) => m.key === 'captions')).toMatchObject({
      title: 'Captions',
      instructions: '',
      setsPerSession: 5,
    });
  });

  it('A-11 setsLeft skips finished, deleted and own sets', async () => {
    const t = await makeApp();
    const creator = await makeUser(t.db, { role: 'creator', email: 'c@picklab.test' });
    const u = await makeUser(t.db, { role: 'creator', email: 'u@picklab.test' });
    // 4 active sets in the module: 3 by another creator, 1 by u. Plus 1 deleted.
    const sets = await Promise.all([1, 2, 3].map(() => makeSet(t.db, { creator, module: 'captions' })));
    await makeSet(t.db, { creator: u, module: 'captions' });
    await makeSet(t.db, { creator, module: 'captions', status: 'deleted' });
    // u finishes one set (needs a session row for the FK)
    const s = await t.req('POST', '/api/sessions', { ...as(u), body: { module: 'captions', layout: 'grid' } });
    const sessionId = (s.body as { id: string }).id;
    await t.db.insert(setResults).values({
      id: crypto.randomUUID(),
      sessionId,
      setId: sets[0]?.id ?? '',
      testerId: u.id,
      layout: 'grid',
      durationMs: 1000,
    });
    const body = (await t.req('GET', '/api/modules', as(u))).parse(modulesResponseSchema);
    const captions = body.modules.find((m) => m.key === 'captions');
    expect(captions?.setsLeft).toBe(2);
    expect(captions?.openSessionId).toBe(sessionId);
  });

  it('A-12 voting off still answers 200 with votingEnabled false', async () => {
    const t = await makeApp();
    const u = await makeUser(t.db);
    t.flags.set('*', { votingEnabled: false });
    const r = await t.req('GET', '/api/modules', as(u));
    expect(r.status).toBe(200);
    expect(r.parse(modulesResponseSchema).votingEnabled).toBe(false);
  });

  it('A-13 flags are cached for 10 s per identity', async () => {
    const t = await makeApp();
    const u = await makeUser(t.db);
    await t.req('GET', '/api/modules', as(u));
    t.clock.advance(5_000);
    await t.req('GET', '/api/modules', as(u));
    expect(t.flags.calls()).toBe(1);
    t.clock.advance(6_000);
    await t.req('GET', '/api/modules', as(u));
    expect(t.flags.calls()).toBe(2);
  });

  it('A-14 outage: no cache gives no modules and voting on; cache is reused', async () => {
    const t = await makeApp();
    const fresh = await makeUser(t.db);
    const cached = await makeUser(t.db);
    await t.req('GET', '/api/modules', as(cached));
    t.flags.fail();
    t.clock.advance(11_000);
    const none = (await t.req('GET', '/api/modules', as(fresh))).parse(modulesResponseSchema);
    expect(none).toEqual({ votingEnabled: true, modules: [] });
    const kept = (await t.req('GET', '/api/modules', as(cached))).parse(modulesResponseSchema);
    expect(kept.modules).toHaveLength(4);
  });

  it('A-14b no user is 401', async () => {
    const t = await makeApp();
    expect((await t.req('GET', '/api/modules')).status).toBe(401);
  });
});
