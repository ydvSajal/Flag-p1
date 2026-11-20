import { LIMITS, MODULE_LABEL, type Layout, type LiveStatus, type ModuleKey, type Signal } from './constants';

export type ResponseInput = { variantId: string; signal: Signal };
export type Validation = { ok: true } | { ok: false; reason: string };

/** Checks that a set's responses fit the session layout (TRD 4.2 "Valid responses"). */
export const validateResponses = (
  layout: Layout,
  setVariantIds: readonly string[],
  responses: readonly ResponseInput[],
): Validation => {
  const known = new Set(setVariantIds);
  if (responses.some((r) => !known.has(r.variantId))) return { ok: false, reason: 'variant not in set' };

  if (layout === 'grid' || layout === 'this_or_that') {
    if (responses.length !== 1) return { ok: false, reason: 'exactly one pick required' };
    if (responses[0]?.signal !== 'pick') return { ok: false, reason: 'signal must be pick' };
    return { ok: true };
  }

  if (responses.some((r) => r.signal === 'pick')) return { ok: false, reason: 'signal must be yes or no' };
  const answered = new Set(responses.map((r) => r.variantId));
  if (answered.size !== responses.length) return { ok: false, reason: 'duplicate variant' };
  if (answered.size !== known.size) return { ok: false, reason: 'every variant needs an answer' };
  return { ok: true };
};

/** 32-bit string hash (FNV-1a), then mulberry32. Deterministic, no I/O. */
const hashSeed = (seed: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

const mulberry32 = (a: number) => () => {
  let t = (a += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Fisher-Yates shuffle seeded by a string. Same seed, same order. */
export const seededShuffle = <T>(items: readonly T[], seed: string): T[] => {
  const out = [...items];
  const rand = mulberry32(hashSeed(seed));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
};

/**
 * This-or-that knockout as "winner stays on": round 1 is ids[0] vs ids[1],
 * each later round is the previous winner vs the next id. n options = n - 1 rounds.
 * `left: null` means "the previous round's winner".
 */
export type KnockoutRound = { left: string | null; right: string };

export const knockoutRounds = (ids: readonly string[]): KnockoutRound[] => {
  if (ids.length < 2) return [];
  return ids.slice(1).map((right, i) => ({ left: i === 0 ? (ids[0] as string) : null, right }));
};

/** Plays a knockout with a chooser; returns the winner. Used by the view and by tests. */
export const playKnockout = (
  ids: readonly string[],
  choose: (left: string, right: string, round: number) => string,
): string | undefined => {
  let winner: string | undefined;
  knockoutRounds(ids).forEach((r, i) => {
    const left = r.left ?? (winner as string);
    winner = choose(left, r.right, i);
  });
  return winner;
};

export type OptionScore = { variantId: string; positive: number; score: number };

/** Score = (picks + yes) / voters. Zero voters gives 0, never NaN. */
export const optionScores = (
  variantIds: readonly string[],
  responses: readonly ResponseInput[],
  voters: number,
): OptionScore[] =>
  variantIds.map((variantId) => {
    const positive = responses.filter(
      (r) => r.variantId === variantId && (r.signal === 'pick' || r.signal === 'yes'),
    ).length;
    return { variantId, positive, score: voters > 0 ? positive / voters : 0 };
  });

/** Live status (D7): finished, voting (seen in the last 2 min), dropped. */
export const liveStatus = (s: { completedAt: Date | null; lastSeenAt: Date }, now: Date): LiveStatus => {
  if (s.completedAt) return 'finished';
  return now.getTime() - s.lastSeenAt.getTime() <= LIMITS.droppedAfterMs ? 'voting' : 'dropped';
};

export type ModuleConfig = { title: string; instructions: string; setsPerSession: number };

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Parses a module flag value `{ title, instructions, sets_per_session }` with per-field defaults. */
export const parseModuleConfig = (raw: unknown, module: ModuleKey): ModuleConfig => {
  const defaults: ModuleConfig = {
    title: MODULE_LABEL[module],
    instructions: '',
    setsPerSession: LIMITS.setsPerSessionDefault,
  };
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return defaults;
    }
  }
  if (!value || typeof value !== 'object') return defaults;
  const v = value as Record<string, unknown>;
  const title = typeof v.title === 'string' && v.title.trim() ? v.title.trim() : defaults.title;
  const instructions = typeof v.instructions === 'string' ? v.instructions : defaults.instructions;
  const n = typeof v.sets_per_session === 'number' && Number.isFinite(v.sets_per_session)
    ? Math.round(v.sets_per_session)
    : defaults.setsPerSession;
  return {
    title,
    instructions,
    setsPerSession: clamp(n, LIMITS.setsPerSessionMin, LIMITS.setsPerSessionMax),
  };
};

/** First 6 characters of an id, for the Live page. */
export const shortId = (id: string): string => id.replace(/-/g, '').slice(0, 6);

/** Layout from an experiment flag variant key. Anything unknown is `grid` (control). */
export const layoutFromVariant = (variant: string | null | undefined, enabled = true): Layout =>
  enabled && (variant === 'swipe' || variant === 'this_or_that' || variant === 'yes_no') ? variant : 'grid';
