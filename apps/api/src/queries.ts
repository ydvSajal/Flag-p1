import { and, count, eq, isNull, ne, notExists, or, sql, type SQL } from 'drizzle-orm';
import type { ModuleKey, VariantView } from '@picklab/shared';
import type { Deps } from './app';
import type { Db } from './db/client';
import { setResults, variantSets } from './db/schema';
import type { FlagState } from './flags';
import { HttpError, type CurrentUser } from './middleware';
import type { Storage } from './storage';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Ids in paths are checked before they reach a uuid column, so junk is a 404, not a Postgres error. */
export const isUuid = (v: string): boolean => UUID.test(v);

/** "Sets left" (TRD 4.2): active, not created by this visitor, not yet finished by this visitor. */
export const setsLeftWhere = (testerId: string, module?: ModuleKey): SQL | undefined =>
  and(
    eq(variantSets.status, 'active'),
    module ? eq(variantSets.module, module) : undefined,
    or(isNull(variantSets.creatorId), ne(variantSets.creatorId, testerId)),
    notExists(
      sql`(select 1 from ${setResults} where ${setResults.setId} = ${variantSets.id} and ${setResults.testerId} = ${testerId})`,
    ),
  );

export const setsLeftByModule = async (db: Db, testerId: string): Promise<Map<string, number>> => {
  const rows = await db
    .select({ module: variantSets.module, n: count() })
    .from(variantSets)
    .where(setsLeftWhere(testerId))
    .groupBy(variantSets.module);
  return new Map(rows.map((r) => [r.module, r.n]));
};

export const doneCount = async (db: Db, sessionId: string): Promise<number> => {
  const [row] = await db.select({ n: count() }).from(setResults).where(eq(setResults.sessionId, sessionId));
  return row?.n ?? 0;
};

type VariantRow = { id: string; kind: 'image' | 'text'; imageKey: string | null; text: string | null };

/** Public shape of an option: image URL or text, never both (text is plain text, never HTML). */
export const variantView = (storage: Storage, v: VariantRow): VariantView =>
  v.kind === 'image' && v.imageKey
    ? { id: v.id, kind: 'image', imageUrl: storage.imageUrl(v.imageKey) }
    : { id: v.id, kind: 'text', text: v.text ?? '' };

export const flagsFor =(deps: Deps, u: CurrentUser): Promise<FlagState> =>
  deps.flags.forUser({ id: u.id, role: u.role, wave: u.wave });

/** Kill switch and module access, enforced with traits from our database (TRD 3). */
export const assertVotingOpen = (flags: FlagState, module: ModuleKey): void => {
  if (!flags.votingEnabled) throw new HttpError(503, 'voting_paused', 'Voting is paused');
  if (!flags.modules[module].enabled) throw new HttpError(403, 'module_off', 'This module is not open for you');
};
