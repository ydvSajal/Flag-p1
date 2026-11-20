import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { count, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import type { Deps } from './app';
import type { Db } from './db/client';
import { profiles, user } from './db/schema';
import { HttpError, parseBody, type AppEnv, type Ctx, type CurrentUser } from './middleware';

/** One signed cookie carries the user id for guests and creators alike (TRD 4.3, LOCAL-DEV). */
export const USER_COOKIE = 'pl_guest';
const OAUTH_COOKIE = 'pl_oauth';
const YEAR_S = 365 * 24 * 60 * 60;

const hmac = (value: string, secret: string) => createHmac('sha256', secret).update(value).digest('base64url');

export const signValue = (value: string, secret: string): string => `${value}.${hmac(value, secret)}`;

export const verifyValue = (signed: string | undefined, secret: string): string | null => {
  if (!signed) return null;
  const dot = signed.lastIndexOf('.');
  if (dot < 1) return null;
  const value = signed.slice(0, dot);
  const given = Buffer.from(signed.slice(dot + 1));
  const expected = Buffer.from(hmac(value, secret));
  return given.length === expected.length && timingSafeEqual(given, expected) ? value : null;
};

export const cookieUserId = (c: Ctx, secret: string): string | null => verifyValue(getCookie(c, USER_COOKIE), secret);

export const setUserCookie = (c: Ctx, id: string, deps: Deps): void =>
  setCookie(c, USER_COOKIE, signValue(id, deps.config.secret), {
    httpOnly: true,
    sameSite: 'Lax',
    secure: deps.config.secureCookies,
    path: '/',
    maxAge: YEAR_S,
  });

export const loadUser = async (db: Db, id: string, adminEmails: readonly string[]): Promise<CurrentUser | null> => {
  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      isAnonymous: user.isAnonymous,
      role: profiles.role,
      wave: profiles.wave,
      consentedAt: profiles.consentedAt,
    })
    .from(user)
    .innerJoin(profiles, eq(profiles.userId, user.id))
    .where(eq(user.id, id));
  if (!row) return null;
  return { ...row, isAdmin: !!row.email && adminEmails.includes(row.email.toLowerCase()) };
};

/** New anonymous user and profile. Wave = (profiles before insert) % 3 + 1 (TRD 4.2). */
export const createGuest = (db: Db, now: Date): Promise<string> =>
  db.transaction(async (tx) => {
    const id = randomUUID();
    const [{ n } = { n: 0 }] = await tx.select({ n: count() }).from(profiles);
    await tx.insert(user).values({ id, isAnonymous: true, createdAt: now, updatedAt: now });
    await tx.insert(profiles).values({ userId: id, wave: (n % 3) + 1, createdAt: now });
    return id;
  });

/**
 * Sign-in for Google and dev login. A known email switches to that account; otherwise the
 * current guest is upgraded in place, so the id (and the Flagsmith identity) never changes (A-07).
 */
export const signInWithEmail = async (
  deps: Deps,
  currentId: string | null,
  identity: { email: string; name?: string },
): Promise<string> => {
  const { db } = deps;
  const now = deps.now();
  const email = identity.email.trim().toLowerCase();
  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  const id = existing?.id ?? currentId ?? (await createGuest(db, now));
  await db.transaction(async (tx) => {
    await tx
      .update(user)
      .set({ email, name: identity.name ?? email.split('@')[0] ?? '', emailVerified: true, isAnonymous: false, updatedAt: now })
      .where(eq(user.id, id));
    await tx.update(profiles).set({ role: 'creator' }).where(eq(profiles.userId, id));
  });
  return id;
};

const devLoginBody = z.object({ email: z.email(), name: z.string().trim().min(1).max(80).optional() });

type GoogleUserInfo = { email?: string; email_verified?: boolean; name?: string };

/** Relative paths only, so the redirect can never leave our origin. */
const safeRedirect = (value: string | undefined): string =>
  value && value.startsWith('/') && !value.startsWith('//') ? value : '/creator';

export const authRoutes = (deps: Deps) => {
  const r = new Hono<AppEnv>();
  const { config } = deps;
  const doFetch = deps.fetch ?? fetch;

  r.post('/auth/dev-login', async (c) => {
    if (!config.allowDevLogin) throw new HttpError(404, 'not_found', 'Not found');
    const body = await parseBody(c, devLoginBody);
    const id = await signInWithEmail(deps, c.get('user')?.id ?? null, body);
    setUserCookie(c, id, deps);
    return c.json({ id });
  });

  r.post('/auth/logout', (c) => {
    deleteCookie(c, USER_COOKIE, { path: '/' });
    return c.body(null, 204);
  });

  r.get('/auth/google', (c) => {
    const google = config.google;
    if (!google) throw new HttpError(404, 'not_found', 'Google sign-in is not configured');
    const state = randomUUID();
    const payload = `${state}|${safeRedirect(c.req.query('redirect'))}`;
    setCookie(c, OAUTH_COOKIE, signValue(payload, config.secret), {
      httpOnly: true,
      sameSite: 'Lax',
      secure: config.secureCookies,
      path: '/',
      maxAge: 600,
    });
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: google.clientId,
      redirect_uri: google.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    }).toString();
    return c.redirect(url.toString());
  });

  r.get('/auth/callback/google', async (c) => {
    const google = config.google;
    if (!google) throw new HttpError(404, 'not_found', 'Google sign-in is not configured');
    const saved = verifyValue(getCookie(c, OAUTH_COOKIE), config.secret);
    deleteCookie(c, OAUTH_COOKIE, { path: '/' });
    const [state, redirect] = saved?.split('|') ?? [];
    const code = c.req.query('code');
    if (!state || state !== c.req.query('state') || !code) return c.redirect('/login?error=google');

    const tokenRes = await doFetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: google.clientId,
        client_secret: google.clientSecret,
        redirect_uri: google.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const token = (await tokenRes.json().catch(() => ({}))) as { access_token?: string };
    if (!tokenRes.ok || !token.access_token) return c.redirect('/login?error=google');

    const infoRes = await doFetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { authorization: `Bearer ${token.access_token}` },
    });
    const info = (await infoRes.json().catch(() => ({}))) as GoogleUserInfo;
    if (!infoRes.ok || !info.email || info.email_verified === false) return c.redirect('/login?error=google');

    const id = await signInWithEmail(deps, c.get('user')?.id ?? null, { email: info.email, name: info.name });
    setUserCookie(c, id, deps);
    return c.redirect(safeRedirect(redirect));
  });

  return r;
};
