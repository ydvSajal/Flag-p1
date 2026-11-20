import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { LAYOUTS, type Layout, type ModuleKey } from '@picklab/shared';
import { makeClient } from './lib/http';

const { values: opt } = parseArgs({
  options: {
    visitors: { type: 'string', default: '40' },
    dropoff: { type: 'string', default: '0.3' },
    layouts: { type: 'string' },
    module: { type: 'string' },
  },
});
const API_URL = process.env.API_URL ?? 'http://localhost:3001';
const N = Number(opt.visitors);
const DROPOFF = Number(opt.dropoff);
const CONCURRENCY = 8;
const layouts = (opt.layouts ? opt.layouts.split(',').map((s) => s.trim()) : [...LAYOUTS]) as Layout[];
if (!Number.isInteger(N) || N < 1 || !(DROPOFF >= 0 && DROPOFF <= 1) || layouts.some((l) => !LAYOUTS.includes(l))) {
  console.error('usage: pnpm simulate --visitors 40 --dropoff 0.3 [--layouts swipe,grid] [--module captions]');
  process.exit(2);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pickOne = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]!;

const stats = {
  perLayout: Object.fromEntries(LAYOUTS.map((l) => [l, 0])) as Record<string, number>,
  completed: 0,
  dropped: 0,
  idle: 0, // visitors with nothing to vote on (no module / no sets left)
  setResults: 0,
  errors: new Map<string, number>(),
  fiveXX: 0,
};
const err = (what: string, status: number, json: any) => {
  const code = json?.error?.code ?? 'unknown';
  const k = `${status} ${code} (${what})`;
  stats.errors.set(k, (stats.errors.get(k) ?? 0) + 1);
  if (status >= 500) stats.fiveXX++;
};

const visitor = async () => {
  const api = makeClient(API_URL);
  const check = (what: string, r: { ok: boolean; status: number; json: any }) => {
    if (!r.ok) err(what, r.status, r.json);
    return r.ok;
  };
  if (!check('GET /me', await api.get('/api/me'))) return;
  if (!check('POST /me/consent', await api.post('/api/me/consent'))) return;
  const mods = await api.get('/api/modules');
  if (!check('GET /modules', mods)) return;
  const usable = (mods.json.modules as { key: ModuleKey; setsLeft: number }[]).filter(
    (m) => m.setsLeft > 0 && (!opt.module || m.key === opt.module),
  );
  if (!mods.json.votingEnabled || !usable.length) return void stats.idle++;

  const layout = pickOne(layouts);
  stats.perLayout[layout]!++;
  const session = await api.post('/api/sessions', { module: pickOne(usable).key, layout });
  if (!check('POST /sessions', session)) return;
  // trackEvent hook: a Flagsmith SDK call would go here (e.g. trackEvent('session_started')). Out of scope for the simulator.

  const dropAfter = Math.random() < DROPOFF ? Math.floor(rand(0, session.json.targetCount)) : Infinity;
  let done = 0;
  for (;;) {
    const next = await api.get(`/api/sessions/${session.json.id}/next`);
    if (!check('GET next', next)) return;
    const batch = next.json.sets as { id: string; variants: { id: string }[] }[];
    if (!batch.length) break;
    for (const set of batch) {
      if (done >= dropAfter) return void stats.dropped++;
      await sleep(rand(5, 25)); // think time is faked via durationMs, not real waiting
      const ids = set.variants.map((v) => v.id);
      const responses =
        layout === 'grid' || layout === 'this_or_that'
          ? [{ variantId: pickOne(ids), signal: 'pick' as const }]
          : ids.map((variantId) => ({ variantId, signal: pickOne(['yes', 'no'] as const) }));
      const res = await api.post('/api/set-results', {
        id: randomUUID(),
        sessionId: session.json.id,
        setId: set.id,
        durationMs: Math.round(rand(1500, 9000)),
        responses,
      });
      if (!check('POST set-results', res)) return;
      stats.setResults++;
      done++;
      if (res.json.sessionComplete) {
        stats.completed++; // expected session_completed count; trackEvent('session_completed') would go here.
        return;
      }
    }
  }
};

const run = async () => {
  let started = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, N) }, async () => {
      while (started < N) {
        started++;
        await visitor().catch((e) => {
          stats.fiveXX++; // network failure counts as a hard error
          stats.errors.set(`network (${e.cause?.code ?? e.message})`, (stats.errors.get('network') ?? 0) + 1);
        });
      }
    }),
  );
  console.log(`visitors: ${N}  (dropoff ${DROPOFF}, layouts ${layouts.join(',')}${opt.module ? `, module ${opt.module}` : ''})`);
  console.log('visitors per layout:', JSON.stringify(stats.perLayout));
  console.log(`sessions completed: ${stats.completed}  dropped: ${stats.dropped}  idle/no sets: ${stats.idle}  set-results posted: ${stats.setResults}`);
  console.log('API errors by code:', stats.errors.size ? Object.fromEntries(stats.errors) : 'none');
  console.log(`expected session_completed count: ${stats.completed}`);
  if (stats.fiveXX) {
    console.error(`FAIL: ${stats.fiveXX} server error(s)`);
    process.exit(1);
  }
};

run();
