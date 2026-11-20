import { readFileSync } from 'node:fs';
import { MODULE_KIND, MODULES, type ModuleKey } from '@picklab/shared';
import { makeClient } from './lib/http';
import { renderPng, type ImageSpec } from './lib/png';

type SeedOption = { text: string } | { image: ImageSpec };
type SeedSet = { module: ModuleKey; title: string; options: SeedOption[] };

const API_URL = process.env.API_URL ?? 'http://localhost:3001';
const MIN_ACTIVE = 20; // S-01: 20+ active sets per live module
const sets: SeedSet[] = JSON.parse(readFileSync(new URL('./seed-data/sets.json', import.meta.url), 'utf8'));

const die = (msg: string): never => {
  console.error(`seed: ${msg}`);
  process.exit(1);
};

const api = makeClient(API_URL);

const main = async () => {
  const login = await api.post('/api/auth/dev-login', { email: 'seed@picklab.local', name: 'Seed Creator' }).catch((e) => die(`API not reachable at ${API_URL} (${e.cause?.code ?? e.message})`));
  if (login.status === 404) die('dev-login is off. Start the API with ALLOW_DEV_LOGIN=1 (and NODE_ENV not production).');
  if (!login.ok) die(`dev-login failed: ${login.status} ${JSON.stringify(login.json)}`);

  const mine = await api.get('/api/sets/mine');
  if (!mine.ok) die(`GET /api/sets/mine failed: ${mine.status} ${JSON.stringify(mine.json)}`);
  const have = new Set<string>(mine.json.sets.map((s: { module: string; title: string }) => `${s.module}|${s.title}`));
  const counts = Object.fromEntries(MODULES.map((m) => [m, { existing: 0, created: 0 }]));
  for (const s of mine.json.sets) counts[s.module as ModuleKey]!.existing++;

  for (const set of sets) {
    if (have.has(`${set.module}|${set.title}`)) continue;
    const kind = MODULE_KIND[set.module];
    let options: { kind: 'image' | 'text'; imageKey?: string; text?: string }[];
    if (kind === 'text') {
      options = set.options.map((o) => ({ kind: 'text', text: (o as { text: string }).text }));
    } else {
      const pngs = set.options.map((o) => renderPng((o as { image: ImageSpec }).image));
      const files = pngs.map((p) => ({ contentType: 'image/png', size: p.length }));
      let sign = await api.post('/api/uploads/sign', { files });
      // The API allows 20 uploads/min per creator: wait out the sliding window instead of failing.
      for (let tries = 0; sign.status === 429 && tries < 20; tries++) {
        console.log('  upload rate limit hit, waiting 10s...');
        await new Promise((r) => setTimeout(r, 10_000));
        sign = await api.post('/api/uploads/sign', { files });
      }
      if (!sign.ok) die(`sign failed for "${set.title}": ${sign.status} ${JSON.stringify(sign.json)}`);
      options = [];
      for (const [i, png] of pngs.entries()) {
        const { key, putUrl } = sign.json.uploads[i];
        const put = await api.put(putUrl, png, 'image/png'); // relative URLs resolve against API_URL
        if (!put.ok) die(`upload failed for "${set.title}": ${put.status} ${JSON.stringify(put.json)}`);
        options.push({ kind: 'image', imageKey: key });
      }
    }
    const created = await api.post('/api/sets', { module: set.module, title: set.title, options });
    if (created.status !== 201) die(`create "${set.title}" failed: ${created.status} ${JSON.stringify(created.json)}`);
    counts[set.module]!.created++;
  }

  let low = false;
  let total = 0;
  for (const m of MODULES) {
    const c = counts[m]!;
    total += c.created;
    const active = c.existing + c.created;
    console.log(`${m.padEnd(14)} active ${String(active).padStart(3)}  (created ${c.created}, already there ${c.existing})`);
    if (active < MIN_ACTIVE) {
      low = true;
      console.warn(`  WARNING: ${m} has ${active} active sets, below ${MIN_ACTIVE} (S-01)`);
    }
  }
  console.log(`seed done: ${total} new set(s) created${low ? ' (some modules below target)' : ''}`);
};

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
