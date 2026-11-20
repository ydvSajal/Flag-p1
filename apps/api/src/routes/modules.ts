import { and, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { MODULES, type ModuleInfo, type ModulesResponse } from '@picklab/shared';
import type { Deps } from '../app';
import { sessions } from '../db/schema';
import { requireUser, type AppEnv } from '../middleware';
import { flagsFor, setsLeftByModule } from '../queries';

export const modulesRoutes = (deps: Deps) => {
  const r = new Hono<AppEnv>();
  const { db } = deps;

  r.get('/modules', async (c) => {
    const u = requireUser(c);
    const flags = await flagsFor(deps, u);
    const left = await setsLeftByModule(db, u.id);
    const open = await db
      .select({ id: sessions.id, module: sessions.module })
      .from(sessions)
      .where(and(eq(sessions.testerId, u.id), isNull(sessions.completedAt)));
    const openByModule = new Map(open.map((s) => [s.module, s.id]));

    const modules = MODULES.filter((m) => flags.modules[m].enabled).map((m): ModuleInfo => {
      const { config } = flags.modules[m];
      const openSessionId = openByModule.get(m);
      return {
        key: m,
        title: config.title,
        instructions: config.instructions,
        setsPerSession: config.setsPerSession,
        setsLeft: left.get(m) ?? 0,
        ...(openSessionId ? { openSessionId } : {}),
      };
    });
    const body: ModulesResponse = { votingEnabled: flags.votingEnabled, modules };
    return c.json(body);
  });

  return r;
};
