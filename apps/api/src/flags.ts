import { readFile } from 'node:fs/promises';
import type { Flagsmith } from '@flagsmith/nodejs';
import {
  FLAG_VOTING_ENABLED,
  LIMITS,
  MODULE_FLAG,
  MODULES,
  parseModuleConfig,
  type ModuleConfig,
  type ModuleKey,
  type Role,
} from '@picklab/shared';

export type FlagUser = { id: string; role: Role; wave: number };
export type ModuleFlags = Record<ModuleKey, { enabled: boolean; config: ModuleConfig }>;
export type FlagState = { votingEnabled: boolean; modules: ModuleFlags };
export type Flags = { forUser: (u: FlagUser) => Promise<FlagState> };

/** What a flag source returns before parsing: enabled state and the raw remote-config value per flag key. */
export type RawFlag = { enabled: boolean; value: unknown };
export type RawFlags = (key: string) => RawFlag | undefined;
export type FlagSource = (u: FlagUser) => Promise<RawFlags>;

const toState = (raw: RawFlags): FlagState => ({
  votingEnabled: raw(FLAG_VOTING_ENABLED)?.enabled ?? true,
  modules: Object.fromEntries(
    MODULES.map((m) => {
      const f = raw(MODULE_FLAG[m]);
      return [m, { enabled: f?.enabled ?? false, config: parseModuleConfig(f?.value, m) }];
    }),
  ) as ModuleFlags,
});

const OUTAGE_DEFAULT = toState(() => undefined);

/**
 * 10 s per-identity cache over a flag source (TRD 6, D11f). On failure: last cached value
 * for that identity, else modules off and voting on.
 */
export const cachedFlags = (source: FlagSource, now: () => Date, onError?: (err: unknown) => void): Flags => {
  const cache = new Map<string, { at: number; state: FlagState }>();
  return {
    forUser: async (u) => {
      // ponytail: unbounded map, one entry per identity; fine for a few thousand visitors.
      const key = `${u.id}|${u.role}|${u.wave}`;
      const hit = cache.get(key);
      const t = now().getTime();
      if (hit && t - hit.at < LIMITS.flagCacheMs) return hit.state;
      try {
        const state = toState(await source(u));
        cache.set(key, { at: t, state });
        return state;
      } catch (err) {
        onError?.(err);
        return hit?.state ?? OUTAGE_DEFAULT;
      }
    },
  };
};

/**
 * Real source: @flagsmith/nodejs 9.4 remote evaluation. Verified in build/esm/sdk: `getIdentityFlags(id, traits)`
 * returns `Flags`; `getFlag(key)` gives `{ enabled, value, isDefault }` and never throws for unknown keys.
 * The client is created once by the caller (D11e).
 */
export const flagsmithSource =
  (client: Flagsmith): FlagSource =>
  async (u) => {
    const flags = await client.getIdentityFlags(u.id, { role: u.role, wave: u.wave });
    return (key) => {
      const f = flags.getFlag(key);
      return f.isDefault ? undefined : { enabled: f.enabled, value: f.value };
    };
  };

/* Local stand-in: apps/api/local-flags.json, re-read on each cache miss. */

type LocalFlag = { enabled: boolean; value?: unknown; waves?: number[] };

export const localFlagSource =
  (file: string): FlagSource =>
  async (u) => {
    const json = JSON.parse(await readFile(file, 'utf8')) as Record<string, LocalFlag>;
    return (key) => {
      const f = json[key];
      if (!f) return undefined;
      // `waves` mimics wave segment overrides; creators always get it (D3 creators override).
      const inWave = !f.waves || u.role === 'creator' || f.waves.includes(u.wave);
      return { enabled: f.enabled && inWave, value: f.value };
    };
  };
