import { and, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { deleteCookie } from 'hono/cookie';
import type { Me } from '@picklab/shared';
import type { Deps } from '../app';
import { createGuest, loadUser, setUserCookie, USER_COOKIE } from '../auth';
import { profiles, user, variantSets } from '../db/schema';
import { HttpError, requireUser, type AppEnv, type CurrentUser } from '../middleware';

export const toMe = (u: CurrentUser): Me => ({
  id: u.id,
  role: u.role,
  wave: u.wave,
  consented: !!u.consentedAt,
  isAnonymous: u.isAnonymous,
  isAdmin: u.isAdmin,
  ...(u.name ? { name: u.name } : {}),
});

export const meRoutes = (deps: Deps) => {
  const r = new Hono<AppEnv>();
  const { db } = deps;

  r.get('/me', async (c) => {
    let current = c.get('user');
    if (!current) {
      const id = await createGuest(db, deps.now());
      setUserCookie(c, id, deps);
      current = await loadUser(db, id, deps.config.adminEmails);
      if (!current) throw new HttpError(500, 'internal', 'Guest was not created');
    }
    return c.json(toMe(current));
  });

  r.post('/me/consent', async (c) => {
    const u = requireUser(c);
    await db
      .update(profiles)
      .set({ consentedAt: deps.now() })
      .where(and(eq(profiles.userId, u.id), isNull(profiles.consentedAt)));
    return c.json({ consented: true as const });
  });

  r.delete('/me', async (c) => {
    const u = requireUser(c);
    await db.transaction(async (tx) => {
      await tx.update(variantSets).set({ status: 'deleted' }).where(eq(variantSets.creatorId, u.id));
      // Cascades remove profile, sessions, set results and responses (TRD 4.2).
      await tx.delete(user).where(eq(user.id, u.id));
    });
    deleteCookie(c, USER_COOKIE, { path: '/' });
    return c.body(null, 204);
  });

  return r;
};
