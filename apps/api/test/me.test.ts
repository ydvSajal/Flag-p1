import { count, eq } from 'drizzle-orm';
import { meSchema } from '@picklab/shared';
import { describe, expect, it } from 'vitest';
import { profiles, user } from '../src/db/schema';
import { ADMIN_EMAIL, as, makeApp, makeUser } from './helpers';

const guest = async (t: Awaited<ReturnType<typeof makeApp>>) => {
  const r = await t.req('GET', '/api/me');
  return { me: r.parse(meSchema), cookie: r.cookie ?? '', res: r };
};

describe('GET /api/me', () => {
  it('A-01 creates an anonymous tester and sets the guest cookie', async () => {
    const t = await makeApp();
    const { me, cookie, res } = await guest(t);
    expect(res.status).toBe(200);
    expect(me).toMatchObject({ role: 'tester', consented: false, isAnonymous: true, isAdmin: false, wave: 1 });
    expect(cookie).toMatch(/^pl_guest=[0-9a-f-]{36}\.[\w-]+$/);
    expect(res.res.headers.get('set-cookie')).toMatch(/HttpOnly/i);
  });

  it('A-02 the cookie returns the same user, still one row', async () => {
    const t = await makeApp();
    const first = await guest(t);
    const again = (await t.req('GET', '/api/me', { cookie: first.cookie })).parse(meSchema);
    expect(again).toMatchObject({ id: first.me.id, wave: first.me.wave });
    const [n] = await t.db.select({ n: count() }).from(user);
    expect(n?.n).toBe(1);
  });

  it('A-02b a tampered cookie gets a fresh guest', async () => {
    const t = await makeApp();
    const first = await guest(t);
    const forged = (await t.req('GET', '/api/me', { cookie: `${first.cookie.slice(0, -2)}xx` })).parse(meSchema);
    expect(forged.id).not.toBe(first.me.id);
  });

  it('A-03 six guests in sequence get waves 1,2,3,1,2,3', async () => {
    const t = await makeApp();
    const waves: number[] = [];
    for (let i = 0; i < 6; i++) waves.push((await guest(t)).me.wave);
    expect(waves).toEqual([1, 2, 3, 1, 2, 3]);
  });
});

describe('POST /api/me/consent', () => {
  it('A-04 consent sticks and keeps the first timestamp', async () => {
    const t = await makeApp();
    const { me, cookie } = await guest(t);
    expect((await t.req('POST', '/api/me/consent', { cookie })).body).toEqual({ consented: true });
    const [first] = await t.db.select().from(profiles).where(eq(profiles.userId, me.id));
    t.clock.advance(60_000);
    await t.req('POST', '/api/me/consent', { cookie });
    const [second] = await t.db.select().from(profiles).where(eq(profiles.userId, me.id));
    expect(second?.consentedAt).toEqual(first?.consentedAt);
    expect((await t.req('GET', '/api/me', { cookie })).parse(meSchema).consented).toBe(true);
  });

  it('A-04b consent without a user is 401', async () => {
    const t = await makeApp();
    expect((await t.req('POST', '/api/me/consent')).code).toBe('unauthenticated');
  });
});

describe('signed-in users', () => {
  it('A-05 signed-in user with an admin email is admin and creator', async () => {
    const t = await makeApp();
    const u = await makeUser(t.db, { role: 'creator', email: ADMIN_EMAIL });
    const me = (await t.req('GET', '/api/me', as(u))).parse(meSchema);
    expect(me).toMatchObject({ isAdmin: true, role: 'creator', isAnonymous: false });
  });

  it('A-06 signed-in user with another email is not admin', async () => {
    const t = await makeApp();
    const u = await makeUser(t.db, { role: 'creator', email: 'someone@picklab.test' });
    expect((await t.req('GET', '/api/me', as(u))).parse(meSchema).isAdmin).toBe(false);
  });

  it('A-07 guest who signs in keeps id and wave and becomes creator (dev login)', async () => {
    const t = await makeApp();
    await guest(t);
    const g = await guest(t); // wave 2
    const r = await t.req('POST', '/api/auth/dev-login', { cookie: g.cookie, body: { email: 'maker@picklab.test' } });
    expect(r.status).toBe(200);
    const me = (await t.req('GET', '/api/me', { cookie: r.cookie })).parse(meSchema);
    expect(me).toMatchObject({ id: g.me.id, wave: 2, role: 'creator', isAnonymous: false });
  });

  it('A-07b Google callback upgrades the same guest', async () => {
    const fakeFetch: typeof fetch = async (url) =>
      String(url).includes('/token')
        ? Response.json({ access_token: 'tok' })
        : Response.json({ email: 'g@picklab.test', email_verified: true, name: 'Gee' });
    const t = await makeApp({
      fetch: fakeFetch,
      config: { google: { clientId: 'cid', clientSecret: 'cs', redirectUri: 'http://web.test/api/auth/callback/google' } },
    });
    const g = await guest(t);
    const start = await t.req('GET', '/api/auth/google?redirect=/creator/new', { cookie: g.cookie });
    expect(start.status).toBe(302);
    const state = new URL(start.res.headers.get('location') ?? '').searchParams.get('state');
    const cb = await t.req('GET', `/api/auth/callback/google?code=c&state=${state}`, {
      cookie: `${g.cookie}; ${start.cookie}`,
    });
    expect(cb.status).toBe(302);
    expect(cb.res.headers.get('location')).toBe('/creator/new');
    const me = (await t.req('GET', '/api/me', { cookie: g.cookie })).parse(meSchema);
    expect(me).toMatchObject({ id: g.me.id, role: 'creator', name: 'Gee' });
  });

  it('dev login is 404 when disabled', async () => {
    const t = await makeApp({ config: { allowDevLogin: false } });
    expect((await t.req('POST', '/api/auth/dev-login', { body: { email: 'a@b.test' } })).status).toBe(404);
  });
});
