/**
 * Configures one Flagsmith environment for PickLab through the admin REST API
 * (docs/FLAGSMITH-SETUP.md section 4, DUE-DILIGENCE D3). Verified against self-hosted Flagsmith.
 * Idempotent: creates what is missing, leaves existing objects alone, and only converges the
 * voting_layout weights below. A second run prints "no changes".
 *
 * Env: FLAGSMITH_API_TOKEN (admin token, required), FLAGSMITH_PROJECT_ID (required),
 *      FLAGSMITH_API_URL (default http://localhost:8100/api/v1), FLAGSMITH_ENVIRONMENT (default Development).
 * Run: pnpm flagsmith:setup
 */
import { readFileSync } from 'node:fs';
import { FLAG_VOTING_ENABLED, FLAG_VOTING_LAYOUT, MODULE_FLAG, MODULES, type ModuleKey } from '@picklab/shared';

// ---- Editable pre-experiment split for voting_layout (percent). Control (grid) gets the remainder.
// Locked while an experiment runs on the flag: then the script only warns.
const WEIGHTS: Record<string, number> = { swipe: 10, this_or_that: 0, yes_no: 0 };

const MODULE_VALUE: Record<ModuleKey, { title: string; instructions: string; sets_per_session: number }> = {
  thumbnails: { title: 'Thumbnails', instructions: 'Pick the thumbnail you would click.', sets_per_session: 5 },
  captions: { title: 'Captions', instructions: 'Pick the caption you would post.', sets_per_session: 5 },
  reel_captions: { title: 'Reel captions', instructions: 'Pick the caption that fits this reel best.', sets_per_session: 5 },
  visuals: { title: 'Visuals', instructions: 'Pick the visual you would use for this post.', sets_per_session: 5 },
};

/** Segment name -> rules file (same files the CLI draft uses). */
const SEGMENTS = { wave_1: 'segment-wave-1.json', wave_2: 'segment-wave-2.json', wave_3: 'segment-wave-3.json', creators: 'segment-creators.json' } as const;
type SegmentName = keyof typeof SEGMENTS;

/** Segment overrides, all ON with the module value: creators on every module (D3), wave_1 on the first two. */
const OVERRIDES: [SegmentName, ModuleKey][] = [
  ...MODULES.map((m): [SegmentName, ModuleKey] => ['creators', m]),
  ['wave_1', 'thumbnails'],
  ['wave_1', 'captions'],
];

const die = (msg: string): never => {
  console.error(`flagsmith-setup: ${msg}`);
  process.exit(1);
};

const API = (process.env.FLAGSMITH_API_URL || 'http://localhost:8100/api/v1').replace(/\/+$/, '');
const TOKEN = process.env.FLAGSMITH_API_TOKEN || die('set FLAGSMITH_API_TOKEN (admin API token, see flagsmith/flagsmith.env)');
const PROJECT = process.env.FLAGSMITH_PROJECT_ID || die('set FLAGSMITH_PROJECT_ID');
const ENV_NAME = process.env.FLAGSMITH_ENVIRONMENT || 'Development';

type Page<T> = { results: T[] };
type Environment = { id: number; name: string; api_key: string };
type Segment = { id: number; name: string };
type MvOption = { id: number; key: string | null; string_value: string | null };
type Feature = { id: number; name: string; type: string; multivariate_options: MvOption[] };
type FeatureState = {
  id: number;
  identity: number | null;
  feature_segment: number | null;
  multivariate_feature_state_values: { id: number; multivariate_feature_option: number; percentage_allocation: number }[];
};
type FeatureSegment = { id: number; segment: number };

const call = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Token ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch((e: Error) => die(`${API} not reachable (${e.message})`));
  const text = await res.text();
  if (!res.ok) die(`${method} ${path} -> ${res.status} ${text.slice(0, 500)}`);
  return (text ? JSON.parse(text) : null) as T;
};
const list = async <T>(path: string): Promise<T[]> =>
  (await call<Page<T>>('GET', `${path}${path.includes('?') ? '&' : '?'}page_size=999`)).results;

let changes = 0;
const did = (msg: string) => {
  changes++;
  console.log(`+ ${msg}`);
};

const main = async () => {
  const env = (await list<Environment>(`/environments/?project=${PROJECT}`)).find((e) => e.name === ENV_NAME);
  if (!env) return die(`environment "${ENV_NAME}" not found in project ${PROJECT}`);
  console.log(`environment ${env.name} (id ${env.id}, client key ${env.api_key})`);

  // 1. Segments (project-wide).
  const segments = await list<Segment>(`/projects/${PROJECT}/segments/`);
  const segId = {} as Record<SegmentName, number>;
  for (const [name, file] of Object.entries(SEGMENTS) as [SegmentName, string][]) {
    let seg = segments.find((s) => s.name === name);
    if (!seg) {
      const rules: unknown = JSON.parse(readFileSync(new URL(`./flagsmith/${file}`, import.meta.url), 'utf8'));
      seg = await call<Segment>('POST', `/projects/${PROJECT}/segments/`, { name, project: Number(PROJECT), rules });
      did(`segment ${name} (id ${seg.id})`);
    }
    segId[name] = seg.id;
  }

  // 2. Flags (project-wide; default_enabled/initial_value seed every environment on create).
  const existing = await list<Feature>(`/projects/${PROJECT}/features/`);
  const ensureFeature = async (name: string, body: Record<string, unknown>): Promise<Feature> => {
    const hit = existing.find((f) => f.name === name);
    if (hit) return hit;
    const created = await call<Feature>('POST', `/projects/${PROJECT}/features/`, { name, ...body });
    did(`flag ${name} (id ${created.id})`);
    return created;
  };
  const moduleFeature = {} as Record<ModuleKey, Feature>;
  for (const m of MODULES) {
    moduleFeature[m] = await ensureFeature(MODULE_FLAG[m], {
      type: 'STANDARD',
      default_enabled: false,
      initial_value: JSON.stringify(MODULE_VALUE[m]),
    });
  }
  await ensureFeature(FLAG_VOTING_ENABLED, { type: 'STANDARD', default_enabled: true });
  const layout = await ensureFeature(FLAG_VOTING_LAYOUT, { type: 'MULTIVARIATE', default_enabled: true, initial_value: 'grid' });
  if (layout.type !== 'MULTIVARIATE') console.warn(`! ${FLAG_VOTING_LAYOUT} is ${layout.type}, expected MULTIVARIATE (D11c)`);

  // 3. voting_layout variations: key == value, so the app can branch on flag.variant.
  const options = await list<MvOption>(`/projects/${PROJECT}/features/${layout.id}/mv-options/`);
  const optionId: Record<string, number> = {};
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    let opt = options.find((o) => o.key === key || o.string_value === key);
    if (!opt) {
      opt = await call<MvOption>('POST', `/projects/${PROJECT}/features/${layout.id}/mv-options/`, {
        feature: layout.id,
        type: 'unicode',
        string_value: key,
        key,
        default_percentage_allocation: weight,
      });
      did(`variation ${key} on ${FLAG_VOTING_LAYOUT}`);
    } else if (opt.key !== key) {
      console.warn(`! variation ${opt.string_value} has key ${String(opt.key)}, expected ${key}: fix it in the dashboard`);
    }
    optionId[key] = opt.id;
  }

  // 4. Weights in this environment (environment default feature state).
  const states = await list<FeatureState>(`/environments/${env.api_key}/featurestates/?feature=${layout.id}`);
  const envState = states.find((s) => s.identity === null && s.feature_segment === null);
  if (!envState) return die(`no environment feature state for ${FLAG_VOTING_LAYOUT}`);
  const current = new Map(envState.multivariate_feature_state_values.map((v) => [v.multivariate_feature_option, v.percentage_allocation]));
  const drift = Object.entries(WEIGHTS).some(([key, w]) => current.get(optionId[key] ?? -1) !== w);
  if (drift) {
    const experiments = await list<{ feature: number; status: string }>(`/environments/${env.api_key}/experiments/`).catch(() => []);
    if (experiments.some((x) => x.feature === layout.id && (x.status === 'running' || x.status === 'paused'))) {
      console.warn(`! ${FLAG_VOTING_LAYOUT} weights differ but an experiment locks the flag: left as is`);
    } else {
      // PUT with the full state: a PATCH with nested weights returns 200 but is silently ignored (verified 2026-11-21).
      await call('PUT', `/environments/${env.api_key}/featurestates/${envState.id}/`, {
        ...envState,
        multivariate_feature_state_values: Object.entries(WEIGHTS).map(([key, w]) => ({
          ...(envState.multivariate_feature_state_values.find((v) => v.multivariate_feature_option === optionId[key]) ?? {}),
          multivariate_feature_option: optionId[key],
          percentage_allocation: w,
        })),
      });
      did(`weights ${JSON.stringify(WEIGHTS)} in ${env.name}`);
    }
  }

  // 5. Segment overrides in this environment.
  for (const [seg, m] of OVERRIDES) {
    const feature = moduleFeature[m];
    const fsegs = await list<FeatureSegment>(`/features/feature-segments/?environment=${env.id}&feature=${feature.id}`);
    if (fsegs.some((f) => f.segment === segId[seg])) continue;
    await call('POST', `/environments/${env.api_key}/features/${feature.id}/create-segment-override/`, {
      enabled: true,
      feature_state_value: { type: 'unicode', string_value: JSON.stringify(MODULE_VALUE[m]) },
      feature_segment: { segment: segId[seg] },
    });
    did(`override ${seg} ON for ${feature.name}`);
  }

  console.log(changes ? `done: ${changes} change(s) in ${env.name}` : `no changes: ${env.name} already configured`);
  console.log('Experiment voting_layout_v1 is not created here (D10: create it once every layout works).');
};

void main();
