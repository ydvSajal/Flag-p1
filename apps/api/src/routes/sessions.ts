import { randomUUID } from 'node:crypto';
import { and, asc, count, eq, inArray, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import {
  createSessionBodySchema,
  LIMITS,
  seededShuffle,
  type NextSetsResponse,
  type Session,
  type SessionDetail,
} from '@picklab/shared';
import type { Deps } from '../app';
import type { Db } from '../db/client';
import { sessions, variants, variantSets } from '../db/schema';
import { HttpError, parseBody, requireUser, type AppEnv, type Ctx } from '../middleware';
import { assertVotingOpen, doneCount, flagsFor, isUuid, setsLeftWhere, variantView } from '../queries';

type SessionRow = typeof sessions.$inferSelect;

const toSession = (s: SessionRow, done: number, resumed: boolean): Session => ({
  id: s.id,
  module: s.module,
  layout: s.layout,
  targetCount: s.targetCount,
  doneCount: done,
  resumed,
});

/** The caller's own session, or 404 for anyone else (A-27, A-34a). */
export const ownSession = async (db: Db, c: Ctx, id: string): Promise<SessionRow> => {
  const u = requireUser(c);
  const [s] = isUuid(id)
    ? await db.select().from(sessions).where(and(eq(sessions.id, id), eq(sessions.testerId, u.id)))
    : [];
  if (!s) throw new HttpError(404, 'not_found', 'Session not found');
  return s;
};

export const sessionsRoutes = (deps: Deps) => {
  const r = new Hono<AppEnv>();
  const { db } = deps;

  const openSession = async (testerId: string, module: SessionRow['module']) => {
    const [s] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.testerId, testerId), eq(sessions.module, module), isNull(sessions.completedAt)));
    return s;
  };

  r.post('/sessions', async (c) => {
    const u = requireUser(c);
    const body = await parseBody(c, createSessionBodySchema);
    const flags = await flagsFor(deps, u);
    assertVotingOpen(flags, body.module);
    if (!u.consentedAt) throw new HttpError(403, 'consent_required', 'Consent first');

    const open = await openSession(u.id, body.module);
    if (open) return c.json(toSession(open, await doneCount(db, open.id), true));

    const [left] = await db.select({ n: count() }).from(variantSets).where(setsLeftWhere(u.id, body.module));
    const setsLeft = left?.n ?? 0;
    if (setsLeft === 0) throw new HttpError(409, 'no_sets_left', 'No sets left in this module');

    const now = deps.now();
    const [created] = await db
      .insert(sessions)
      .values({
        id: randomUUID(),
        testerId: u.id,
        module: body.module,
        layout: body.layout,
        targetCount: Math.min(flags.modules[body.module].config.setsPerSession, setsLeft),
        startedAt: now,
        lastSeenAt: now,
      })
      .onConflictDoNothing()
      .returning();
    if (created) return c.json(toSession(created, 0, false), 201);
    // Lost a race with a parallel start: the partial unique index kept one open session.
    const raced = await openSession(u.id, body.module);
    if (!raced) throw new HttpError(500, 'internal', 'Session could not be created');
    return c.json(toSession(raced, await doneCount(db, raced.id), true));
  });

  r.get('/sessions/:id', async (c) => {
    const s = await ownSession(db, c, c.req.param('id'));
    const body: SessionDetail = { ...toSession(s, await doneCount(db, s.id), true), completed: !!s.completedAt };
    return c.json(body);
  });

  r.get('/sessions/:id/next', async (c) => {
    const u = requireUser(c);
    const s = await ownSession(db, c, c.req.param('id'));
    assertVotingOpen(await flagsFor(deps, u), s.module);
    const done = await doneCount(db, s.id);
    const remaining = s.completedAt ? 0 : Math.max(0, s.targetCount - done);

    const sets = remaining
      ? await db
          .select({ id: variantSets.id, title: variantSets.title })
          .from(variantSets)
          .where(setsLeftWhere(u.id, s.module))
          // Stable per visitor, different across visitors, no queue table (TRD 4.2).
          .orderBy(sql`md5(${variantSets.id}::text || ${u.id})`)
          .limit(Math.min(LIMITS.nextSetsBatch, remaining))
      : [];
    const rows = sets.length
      ? await db
          .select()
          .from(variants)
          .where(
            inArray(
              variants.setId,
              sets.map((x) => x.id),
            ),
          )
          .orderBy(asc(variants.position))
      : [];

    await db.update(sessions).set({ lastSeenAt: deps.now() }).where(eq(sessions.id, s.id));

    const body: NextSetsResponse = {
      doneCount: done,
      targetCount: s.targetCount,
      sets: sets.map((set) => ({
        id: set.id,
        title: set.title,
        variants: seededShuffle(
          rows.filter((v) => v.setId === set.id),
          set.id + u.id,
        ).map((v) => variantView(deps.storage, v)),
      })),
    };
    return c.json(body);
  });

  return r;
};
