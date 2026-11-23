import { avg, count, countDistinct, desc, eq, gte, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import {
  FLAG_VOTING_LAYOUT,
  LAYOUTS,
  LIMITS,
  liveStatus,
  shortId,
  type LiveResponse,
  type OverviewResponse,
  type Split,
} from '@picklab/shared';
import type { Deps } from '../app';
import { profiles, responses, sessions, setResults } from '../db/schema';
import { requireAdmin, type AppEnv } from '../middleware';

export const adminRoutes = (deps: Deps) => {
  const r = new Hono<AppEnv>();
  const { db } = deps;
  r.use('/admin/*', requireAdmin);

  r.get('/admin/live', async (c) => {
    const now = deps.now();
    const since = new Date(now.getTime() - LIMITS.liveWindowMs);
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const rows = await db
      .select({
        id: sessions.id,
        testerId: sessions.testerId,
        module: sessions.module,
        layout: sessions.layout,
        targetCount: sessions.targetCount,
        lastSeenAt: sessions.lastSeenAt,
        completedAt: sessions.completedAt,
        wave: profiles.wave,
      })
      .from(sessions)
      .innerJoin(profiles, eq(profiles.userId, sessions.testerId))
      .where(gte(sessions.lastSeenAt, since))
      .orderBy(desc(sessions.lastSeenAt))
      .limit(LIMITS.liveMaxRows);
    const done = rows.length
      ? await db
          .select({ sessionId: setResults.sessionId, n: count() })
          .from(setResults)
          .where(inArray(setResults.sessionId, rows.map((x) => x.id)))
          .groupBy(setResults.sessionId)
      : [];
    const doneBy = new Map(done.map((d) => [d.sessionId, d.n]));

    const splitRows = await db
      .select({ layout: sessions.layout, n: count() })
      .from(sessions)
      .where(gte(sessions.lastSeenAt, since))
      .groupBy(sessions.layout);
    const split = Object.fromEntries(LAYOUTS.map((l) => [l, splitRows.find((s) => s.layout === l)?.n ?? 0])) as Split;

    const [onSite] = await db
      .select({ n: countDistinct(sessions.testerId) })
      .from(sessions)
      .where(gte(sessions.lastSeenAt, new Date(now.getTime() - LIMITS.droppedAfterMs)));
    const [started] = await db.select({ n: count() }).from(sessions).where(gte(sessions.startedAt, today));
    const [finished] = await db.select({ n: count() }).from(sessions).where(gte(sessions.completedAt, today));

    const body: LiveResponse = {
      now: now.toISOString(),
      counters: { onSite: onSite?.n ?? 0, sessionsToday: started?.n ?? 0, finishedToday: finished?.n ?? 0 },
      split,
      visitors: rows.map((s) => ({
        shortId: shortId(s.testerId),
        wave: s.wave,
        layout: s.layout,
        module: s.module,
        doneCount: doneBy.get(s.id) ?? 0,
        targetCount: s.targetCount,
        status: liveStatus(s, now),
        lastSeenAt: s.lastSeenAt.toISOString(),
      })),
    };
    return c.json(body);
  });

  r.get('/admin/overview', async (c) => {
    const waves = await db.select({ wave: profiles.wave, n: count() }).from(profiles).groupBy(profiles.wave);
    const byLayoutRows = await db
      .select({
        layout: sessions.layout,
        visitors: countDistinct(sessions.testerId),
        started: count(),
        completed: count(sessions.completedAt),
      })
      .from(sessions)
      .groupBy(sessions.layout);
    const durations = await db
      .select({ layout: setResults.layout, avg: avg(setResults.durationMs) })
      .from(setResults)
      .groupBy(setResults.layout);
    const [total] = await db.select({ n: count() }).from(responses);
    const wave = (w: number) => waves.find((x) => x.wave === w)?.n ?? 0;
    // FLAGSMITH_DASHBOARD_URL is the environment's dashboard base, e.g. https://<host>/project/1/environment/<key>.
    const base = deps.config.flagsmithDashboardUrl.replace(/\/$/, '');

    const body: OverviewResponse = {
      visitorsByWave: { '1': wave(1), '2': wave(2), '3': wave(3) },
      byLayout: LAYOUTS.map((layout) => {
        const row = byLayoutRows.find((x) => x.layout === layout);
        const started = row?.started ?? 0;
        const completed = row?.completed ?? 0;
        return {
          layout,
          visitors: row?.visitors ?? 0,
          started,
          completed,
          completionRate: started ? completed / started : 0,
          avgDurationMs: Number(durations.find((d) => d.layout === layout)?.avg ?? 0),
        };
      }),
      responsesTotal: total?.n ?? 0,
      links: {
        flag: `${base}/features?search=${FLAG_VOTING_LAYOUT}`,
        experiment: `${base}/experiments`,
        identities: `${base}/users`,
      },
    };
    return c.json(body);
  });

  return r;
};
