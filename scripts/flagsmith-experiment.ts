/**
 * Experiment pipeline on self-hosted Flagsmith (docs/FLAGSMITH-SETUP.md 7.3).
 *
 *   --probe       throwaway end-to-end run on flag exp_probe: warehouse + metric, experiment
 *                 exp_probe_v1 (a / b 50 / c 0), start, ~120 identities through the JS SDK,
 *                 exposures + results, complete, then delete exp_probe and its identities.
 *   --real --yes  warehouse + metric + experiment voting_layout_v1 (grid 50 / swipe 50 /
 *                 this_or_that 0 / yes_no 0, D2). Created, NOT started. Verified side effects of the
 *                 create (on exp_probe): default weights are zeroed and the 50/50 split is served at
 *                 once through a system rollout segment; exposures only count after start.
 *
 * Idempotent: existing connection / metric / experiment are reused.
 * Env: FLAGSMITH_API_TOKEN, FLAGSMITH_PROJECT_ID (required), FLAGSMITH_API_URL (default
 *      http://localhost:8100/api/v1), FLAGSMITH_EVENTS_URL (default http://localhost:8100/api/),
 *      FLAGSMITH_ENVIRONMENT (default Development).
 * Run: pnpm flagsmith:experiment --probe
 */
import { parseArgs } from 'node:util';
import { createRequire } from 'node:module';
import { FLAG_VOTING_LAYOUT } from '@picklab/shared';
import type { IFlagsmith } from '../apps/web/node_modules/@flagsmith/flagsmith/types';

// The SDK is a dependency of apps/web only; load that copy (no new deps). The /isomorphic entry is
// the Node build (the default one uses XMLHttpRequest). One instance, identify() per identity.
const sdk = createRequire(new URL('../apps/web/package.json', import.meta.url))('@flagsmith/flagsmith/isomorphic') as {
  createFlagsmithInstance: () => IFlagsmith;
};
const flagsmith = sdk.createFlagsmithInstance();

const { values: opt } = parseArgs({
  options: {
    probe: { type: 'boolean', default: false },
    real: { type: 'boolean', default: false },
    yes: { type: 'boolean', default: false },
    identities: { type: 'string', default: '120' },
  },
});

const die = (msg: string): never => {
  console.error(`flagsmith-experiment: ${msg}`);
  process.exit(1);
};

if (opt.probe === opt.real) die('pass exactly one of --probe or --real');
if (opt.real && !opt.yes) {
  die(
    `--real creates experiment voting_layout_v1 on the REAL ${FLAG_VOTING_LAYOUT} flag: its default weights are zeroed ` +
      'and grid 50 / swipe 50 is served immediately (D1: not before 28 Nov). ' +
      'Re-run with --real --yes to do it.',
  );
}

const API = (process.env.FLAGSMITH_API_URL || 'http://localhost:8100/api/v1').replace(/\/+$/, '');
const EVENTS_URL = process.env.FLAGSMITH_EVENTS_URL || 'http://localhost:8100/api/';
const TOKEN = process.env.FLAGSMITH_API_TOKEN || die('set FLAGSMITH_API_TOKEN (admin API token, see flagsmith/flagsmith.env)');
const PROJECT = process.env.FLAGSMITH_PROJECT_ID || die('set FLAGSMITH_PROJECT_ID');
const ENV_NAME = process.env.FLAGSMITH_ENVIRONMENT || 'Development';

const METRIC = 'session_completed';
const PROBE_FLAG = 'exp_probe';
const PROBE_PREFIX = 'exp-probe-';

type Page<T> = { results: T[] };
type Environment = { id: number; name: string; api_key: string };
type MvOption = { id: number; key: string | null };
type Feature = { id: number; name: string; type: string; multivariate_options: MvOption[] };
type Connection = { id: number; warehouse_type: string; config: unknown; status: string };
type Metric = { id: number; name: string };
type Experiment = { id: number; name: string; status: string; feature: number | { id: number } };
type Computation = { as_of: string | null; last_error_at: string | null; is_final: boolean; payload: unknown } | null;

const call = async <T>(method: string, path: string, body?: unknown, okStatus: number[] = []): Promise<T> => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Token ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch((e: Error) => die(`${API} not reachable (${e.message})`));
  const text = await res.text();
  if (!res.ok && !okStatus.includes(res.status)) die(`${method} ${path} -> ${res.status} ${text.slice(0, 500)}`);
  return (text ? JSON.parse(text) : null) as T;
};
const list = async <T>(path: string): Promise<T[]> => {
  const data = await call<Page<T> | T[]>('GET', `${path}${path.includes('?') ? '&' : '?'}page_size=999`);
  return Array.isArray(data) ? data : data.results;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const featureId = (x: Experiment) => (typeof x.feature === 'number' ? x.feature : x.feature.id);

/** Self-hosted needs the Postgres "Flagsmith database" connection: with type `flagsmith` (ClickHouse,
 *  SaaS only) POST /api/v1/events/ answers 404 "does not store events in Flagsmith" (verified). */
const ensureWarehouse = async (env: Environment) => {
  const [conn] = await list<Connection>(`/environments/${env.api_key}/warehouse-connections/`);
  if (conn) {
    const ok = JSON.stringify(conn.config) === '{"source":"flagsmith_database"}';
    console.log(`${ok ? '=' : '!'} warehouse connection ${conn.id} (${conn.warehouse_type}, ${conn.status})`);
    if (!ok) die('existing warehouse connection does not store events in Flagsmith; replace it with postgres/flagsmith_database');
    return;
  }
  const c = await call<Connection>('POST', `/environments/${env.api_key}/warehouse-connections/`, {
    warehouse_type: 'postgres',
    config: { source: 'flagsmith_database' },
  });
  console.log(`+ warehouse connection ${c.id} (postgres/flagsmith_database, ${c.status})`);
};

const ensureMetric = async (env: Environment): Promise<Metric> => {
  const hit = (await list<Metric>(`/environments/${env.api_key}/experiment-metrics/`)).find((m) => m.name === METRIC);
  if (hit) return console.log(`= metric ${METRIC} (id ${hit.id})`), hit;
  const m = await call<Metric>('POST', `/environments/${env.api_key}/experiment-metrics/`, {
    name: METRIC,
    description: 'Identity completed a voting session (occurrence, higher is better).',
    aggregation: 'occurrence',
    direction: 'up',
    definition: { version: 1, event: METRIC },
  });
  console.log(`+ metric ${METRIC} (id ${m.id})`);
  return m;
};

/** Returns the active (not completed) experiment with this name, creating it if absent. */
const ensureExperiment = async (
  env: Environment,
  feature: Feature,
  name: string,
  hypothesis: string,
  metric: Metric,
  control: string,
  weights: Record<string, number>,
): Promise<Experiment> => {
  const active = (await list<Experiment>(`/environments/${env.api_key}/experiments/`)).find(
    (x) => featureId(x) === feature.id && x.status !== 'completed',
  );
  if (active) {
    if (active.name !== name) die(`flag ${feature.name} already has active experiment "${active.name}"`);
    console.log(`= experiment ${name} (id ${active.id}, ${active.status})`);
    return active;
  }
  const optionId = (key: string) =>
    feature.multivariate_options.find((o) => o.key === key)?.id ?? die(`${feature.name} has no variation keyed ${key}`);
  const x = await call<Experiment>('POST', `/environments/${env.api_key}/experiments/`, {
    feature: feature.id,
    name,
    hypothesis,
    metrics: [{ metric: metric.id, expected_direction: 'increase' }],
    experiment_rollout: {
      enabled: true,
      rollout_percentage: 100,
      feature_state_value: { type: 'string', value: control },
      multivariate_feature_state_values: Object.entries(weights).map(([key, w]) => ({
        multivariate_feature_option: optionId(key),
        percentage_allocation: w,
      })),
    },
  });
  console.log(`+ experiment ${name} (id ${x.id}, ${x.status}), split ${control} rest / ${JSON.stringify(weights)}`);
  return x;
};

const real = async (env: Environment) => {
  await ensureWarehouse(env);
  const metric = await ensureMetric(env);
  const feature = (await list<Feature>(`/projects/${PROJECT}/features/`)).find((f) => f.name === FLAG_VOTING_LAYOUT);
  if (!feature) return die(`flag ${FLAG_VOTING_LAYOUT} not found: run pnpm flagsmith:setup first`);
  const x = await ensureExperiment(
    env,
    feature,
    'voting_layout_v1',
    'Swipe completes more sessions than grid (D2: this_or_that and yes_no held at 0).',
    metric,
    'grid',
    { swipe: 50, this_or_that: 0, yes_no: 0 },
  );
  if (x.status === 'created') {
    console.log(`Not started. Start it in the dashboard or: POST ${API}/environments/${env.api_key}/experiments/${x.id}/start/`);
  }
};

const ensureProbeFlag = async (): Promise<Feature> => {
  let f = (await list<Feature>(`/projects/${PROJECT}/features/`)).find((x) => x.name === PROBE_FLAG);
  if (!f) {
    f = await call<Feature>('POST', `/projects/${PROJECT}/features/`, {
      name: PROBE_FLAG,
      type: 'MULTIVARIATE',
      default_enabled: true,
      initial_value: 'a',
      description: 'Throwaway flag for pnpm flagsmith:experiment --probe. Safe to delete.',
    });
    console.log(`+ flag ${PROBE_FLAG} (id ${f.id})`);
  }
  // b = the real variation (default 10, like swipe), c = weight-0 variation (gate G3).
  for (const [key, w] of [['b', 10], ['c', 0]] as const) {
    if (f.multivariate_options.some((o) => o.key === key)) continue;
    await call('POST', `/projects/${PROJECT}/features/${f.id}/mv-options/`, {
      feature: f.id,
      type: 'unicode',
      string_value: key,
      key,
      default_percentage_allocation: w,
    });
    console.log(`+ variation ${key} on ${PROBE_FLAG}`);
  }
  return (await list<Feature>(`/projects/${PROJECT}/features/`)).find((x) => x.name === PROBE_FLAG)!;
};

const initSdk = (env: Environment) =>
  // Same options as apps/web/lib/flags.tsx (minus cacheFlags, which needs browser storage).
  flagsmith.init({
    environmentID: env.api_key,
    api: `${API}/`,
    enableEvents: true,
    eventProcessorConfig: { eventsApiUrl: EVENTS_URL },
  });

/** POST refresh (202) then poll GET until a computation lands. Refresh is throttled to 1 per 5 min. */
const refreshAndRead = async (env: Environment, x: Experiment, what: 'exposures' | 'results'): Promise<Computation> => {
  const base = `/environments/${env.api_key}/experiments/${x.id}/${what}/`;
  const before = (await call<Record<string, Computation>>('GET', base))[what] ?? null;
  const r = await call<{ detail?: unknown } | null>('POST', `${base}refresh/`, {}, [400, 429]);
  if (r?.detail) console.log(`  ${what} refresh: ${JSON.stringify(r.detail)}`);
  for (let i = 0; i < 90; i++) {
    const c = (await call<Record<string, Computation>>('GET', base))[what] ?? null;
    if (c?.is_final || (c?.as_of ?? null) !== (before?.as_of ?? null) || (c?.last_error_at ?? null) !== (before?.last_error_at ?? null)) return c;
    await sleep(2000);
  }
  return (await call<Record<string, Computation>>('GET', base))[what] ?? null;
};

const probe = async (env: Environment) => {
  const n = Number(opt.identities);
  if (!Number.isInteger(n) || n < 1) die('--identities must be a positive integer');
  await ensureWarehouse(env);
  const metric = await ensureMetric(env);
  const feature = await ensureProbeFlag();
  // Environment default weights per option id: Flagsmith zeroes them when the experiment is created.
  const defaults = async () =>
    JSON.stringify(
      (
        await list<{ identity: number | null; feature_segment: number | null; multivariate_feature_state_values: { multivariate_feature_option: number; percentage_allocation: number }[] }>(
          `/environments/${env.api_key}/featurestates/?feature=${feature.id}`,
        )
      )
        .find((s) => s.identity === null && s.feature_segment === null)
        ?.multivariate_feature_state_values.map((v) => [v.multivariate_feature_option, v.percentage_allocation]),
    );
  console.log(`  ${PROBE_FLAG} default weights before experiment: ${await defaults()}`);
  let x = await ensureExperiment(env, feature, 'exp_probe_v1', 'Probe: b completes more sessions than a.', metric, 'a', {
    b: 50,
    c: 0,
  });
  console.log(`  ${PROBE_FLAG} default weights after experiment create: ${await defaults()}`);
  const run = Date.now().toString(36);
  await initSdk(env);

  // Before start: what do identities get, and do they count as in the experiment?
  if (x.status === 'created') {
    const pre: Record<string, number> = {};
    for (let i = 0; i < 10; i++) {
      await flagsmith.identify(`${PROBE_PREFIX}${run}-pre-${i}`);
      const f = flagsmith.getExperimentFlag(PROBE_FLAG);
      const k = `${String(f?.variant)}${f?.experiment?.inExperiment ? '+inExperiment' : ''}`;
      pre[k] = (pre[k] ?? 0) + 1;
    }
    await flagsmith.flushEvents();
    console.log(`  before start, 10 identities: ${JSON.stringify(pre)}`);
    x = await call<Experiment>('POST', `/environments/${env.api_key}/experiments/${x.id}/start/`, {});
    console.log(`+ started ${x.name} (${x.status})`);
  }

  const seen: Record<string, { n: number; conv: number }> = {};
  let notIn = 0;
  for (let i = 0; i < n; i++) {
    await flagsmith.identify(`${PROBE_PREFIX}${run}-${i}`);
    const f = flagsmith.getExperimentFlag(PROBE_FLAG);
    if (!f?.experiment?.inExperiment) notIn++;
    const arm = (seen[f?.variant ?? String(f?.value)] ??= { n: 0, conv: 0 });
    arm.n++;
    if (i % 5 < 3) {
      flagsmith.trackEvent(METRIC);
      arm.conv++;
    }
    await flagsmith.flushEvents();
  }
  await flagsmith.close(10_000);
  console.log(`  sent ${n} identities: ${JSON.stringify(seen)}; not in experiment: ${notIn}`);

  // Complete first, so the one refresh we are allowed per 5 min is the final one.
  x = await call<Experiment>('POST', `/environments/${env.api_key}/experiments/${x.id}/complete/`, {}, [400]);
  console.log(`+ completed exp_probe_v1 (${x.status ?? 'already completed'})`);
  for (const what of ['exposures', 'results'] as const) {
    console.log(`${what}: ${JSON.stringify(await refreshAndRead(env, x, what), null, 1)}`);
  }

  // Cleanup: identities created by this script, then the throwaway flag (also removes its experiment).
  const ids = (await list<{ id: number; identifier: string }>(`/environments/${env.api_key}/identities/?q=${PROBE_PREFIX}`)).filter(
    (i) => i.identifier.startsWith(PROBE_PREFIX),
  );
  for (const i of ids) await call('DELETE', `/environments/${env.api_key}/identities/${i.id}/`);
  await call('DELETE', `/projects/${PROJECT}/features/${feature.id}/`);
  console.log(`- deleted ${ids.length} probe identities and flag ${PROBE_FLAG}`);
};

const main = async () => {
  const env = (await list<Environment>(`/environments/?project=${PROJECT}`)).find((e) => e.name === ENV_NAME);
  if (!env) return die(`environment "${ENV_NAME}" not found in project ${PROJECT}`);
  console.log(`environment ${env.name} (id ${env.id})`);
  await (opt.real ? real(env) : probe(env));
};

void main();
