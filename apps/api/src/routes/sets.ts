import { randomUUID } from 'node:crypto';
import { and, asc, count, desc, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import {
  createSetBodySchema,
  LAYOUTS,
  MODULE_KIND,
  optionScores,
  type MySetsResponse,
  type SetResultsResponse,
} from '@picklab/shared';
import type { Deps } from '../app';
import { responses, setResults, variants, variantSets } from '../db/schema';
import { HttpError, parseBody, requireCreator, requireUser, type AppEnv } from '../middleware';
import { flagsFor, isUuid, variantView } from '../queries';

const notFound = () => new HttpError(404, 'not_found', 'Set not found');

export const setsRoutes = (deps: Deps) => {
  const r = new Hono<AppEnv>();
  const { db, storage } = deps;

  r.post('/sets', async (c) => {
    const u = requireCreator(c);
    const body = await parseBody(c, createSetBodySchema);
    if (body.options[0]?.kind !== MODULE_KIND[body.module]) {
      throw new HttpError(400, 'invalid_body', `${body.module} takes ${MODULE_KIND[body.module]} options`);
    }
    if (!(await flagsFor(deps, u)).modules[body.module].enabled) {
      throw new HttpError(403, 'module_off', 'This module is not open for you');
    }
    for (const o of body.options) {
      if (o.kind !== 'image') continue;
      const key = o.imageKey ?? '';
      if (!key.startsWith(`u/${u.id}/`) || !(await storage.exists(key))) {
        throw new HttpError(400, 'invalid_body', 'Upload every image before publishing');
      }
    }
    const id = randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(variantSets).values({ id, creatorId: u.id, module: body.module, title: body.title, createdAt: deps.now() });
      await tx.insert(variants).values(
        body.options.map((o, position) => ({
          id: randomUUID(),
          setId: id,
          kind: o.kind,
          imageKey: o.kind === 'image' ? o.imageKey : null,
          text: o.kind === 'text' ? o.text : null,
          position,
        })),
      );
    });
    return c.json({ id }, 201);
  });

  r.get('/sets/mine', async (c) => {
    const u = requireCreator(c);
    const sets = await db
      .select({
        id: variantSets.id,
        module: variantSets.module,
        title: variantSets.title,
        createdAt: variantSets.createdAt,
        voters: db.$count(setResults, eq(setResults.setId, variantSets.id)),
      })
      .from(variantSets)
      .where(and(eq(variantSets.creatorId, u.id), eq(variantSets.status, 'active')))
      .orderBy(desc(variantSets.createdAt));
    const vs = sets.length
      ? await db
          .select()
          .from(variants)
          .where(inArray(variants.setId, sets.map((s) => s.id)))
          .orderBy(asc(variants.position))
      : [];
    const body: MySetsResponse = {
      sets: sets.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        voters: Number(s.voters),
        preview: vs.filter((v) => v.setId === s.id).map((v) => variantView(storage, v)),
      })),
    };
    return c.json(body);
  });

  r.get('/sets/:id/results', async (c) => {
    const u = requireUser(c);
    const id = c.req.param('id');
    const [set] = isUuid(id) ? await db.select().from(variantSets).where(eq(variantSets.id, id)) : [];
    // Owners see their active sets; admins see everything, including deleted sets (A-52).
    if (!set || !(u.isAdmin || (set.creatorId === u.id && set.status === 'active'))) throw notFound();

    const vs = await db.select().from(variants).where(eq(variants.setId, id)).orderBy(asc(variants.position));
    const votes = await db
      .select({ layout: setResults.layout, variantId: responses.variantId, signal: responses.signal })
      .from(responses)
      .innerJoin(setResults, eq(setResults.id, responses.setResultId))
      .where(eq(setResults.setId, id));
    const voterRows = await db
      .select({ layout: setResults.layout, n: count() })
      .from(setResults)
      .where(eq(setResults.setId, id))
      .groupBy(setResults.layout);
    const votersBy = new Map(voterRows.map((v) => [v.layout, v.n]));
    const voters = voterRows.reduce((sum, v) => sum + v.n, 0);
    const ids = vs.map((v) => v.id);
    const scores = optionScores(ids, votes, voters);

    const body: SetResultsResponse = {
      id: set.id,
      title: set.title,
      module: set.module,
      voters,
      options: vs.map((v, i) => {
        const { id: _id, ...view } = variantView(storage, v);
        return { variantId: v.id, ...view, positive: scores[i]?.positive ?? 0, score: scores[i]?.score ?? 0 };
      }),
      ...(u.isAdmin
        ? {
            byLayout: LAYOUTS.map((layout) => ({
              layout,
              voters: votersBy.get(layout) ?? 0,
              options: optionScores(
                ids,
                votes.filter((v) => v.layout === layout),
                votersBy.get(layout) ?? 0,
              ),
            })),
          }
        : {}),
    };
    return c.json(body);
  });

  r.delete('/sets/:id', async (c) => {
    const u = requireCreator(c);
    const id = c.req.param('id');
    if (!isUuid(id)) throw notFound();
    const done = await db
      .update(variantSets)
      .set({ status: 'deleted' })
      .where(and(eq(variantSets.id, id), eq(variantSets.creatorId, u.id), eq(variantSets.status, 'active')))
      .returning({ id: variantSets.id });
    if (!done.length) throw notFound();
    return c.body(null, 204);
  });

  return r;
};
