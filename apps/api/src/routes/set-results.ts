import { and, asc, count, eq, isNull, ne, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { LIMITS, setResultBodySchema, validateResponses, type SetResultResponse } from '@picklab/shared';
import type { Deps } from '../app';
import { responses, sessions, setResults, variants, variantSets } from '../db/schema';
import { HttpError, parseBody, rateLimiter, requireUser, type AppEnv } from '../middleware';
import { assertVotingOpen, doneCount, flagsFor, isUuid } from '../queries';
import { ownSession } from './sessions';

export const setResultsRoutes = (deps: Deps) => {
  const r = new Hono<AppEnv>();
  const { db } = deps;
  const limit = rateLimiter(LIMITS.setResultsPerMinute, deps.now);

  r.post('/set-results', async (c) => {
    const u = requireUser(c);
    limit(u.id);
    const body = await parseBody(c, setResultBodySchema);
    const s = await ownSession(db, c, body.sessionId);
    if (!isUuid(body.setId)) throw new HttpError(404, 'not_found', 'Set not found');
    assertVotingOpen(await flagsFor(deps, u), s.module);

    const state = async (): Promise<SetResultResponse> => {
      const [row] = await db.select({ completedAt: sessions.completedAt }).from(sessions).where(eq(sessions.id, s.id));
      return { doneCount: await doneCount(db, s.id), targetCount: s.targetCount, sessionComplete: !!row?.completedAt };
    };

    // Replay (same id) or a second answer to the same set: no new rows, current state (A-31, A-32).
    const [dupe] = await db
      .select({ id: setResults.id })
      .from(setResults)
      .where(or(eq(setResults.id, body.id), and(eq(setResults.testerId, u.id), eq(setResults.setId, body.setId))));
    if (dupe) return c.json(await state());
    if (s.completedAt) throw new HttpError(409, 'session_closed', 'This session is complete');

    const [set] = await db
      .select({ id: variantSets.id })
      .from(variantSets)
      .where(
        and(
          eq(variantSets.id, body.setId),
          eq(variantSets.module, s.module),
          eq(variantSets.status, 'active'),
          or(isNull(variantSets.creatorId), ne(variantSets.creatorId, u.id)),
        ),
      );
    if (!set) throw new HttpError(404, 'not_found', 'Set not found');
    const variantIds = (
      await db.select({ id: variants.id }).from(variants).where(eq(variants.setId, set.id)).orderBy(asc(variants.position))
    ).map((v) => v.id);
    const check = validateResponses(s.layout, variantIds, body.responses);
    if (!check.ok) throw new HttpError(400, 'invalid_responses', check.reason);

    const now = deps.now();
    const result = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(setResults)
        .values({
          id: body.id,
          sessionId: s.id,
          setId: set.id,
          testerId: u.id,
          layout: s.layout,
          durationMs: body.durationMs,
          createdAt: now,
        })
        .onConflictDoNothing()
        .returning({ id: setResults.id });
      if (inserted.length) {
        await tx.insert(responses).values(body.responses.map((x) => ({ setResultId: body.id, ...x })));
      }
      const [done] = await tx.select({ n: count() }).from(setResults).where(eq(setResults.sessionId, s.id));
      const doneN = done?.n ?? 0;
      const complete = doneN >= s.targetCount;
      await tx
        .update(sessions)
        .set(complete ? { lastSeenAt: now, completedAt: now } : { lastSeenAt: now })
        .where(and(eq(sessions.id, s.id), isNull(sessions.completedAt)));
      return { doneCount: doneN, targetCount: s.targetCount, sessionComplete: complete };
    });
    return c.json(result satisfies SetResultResponse);
  });

  return r;
};
