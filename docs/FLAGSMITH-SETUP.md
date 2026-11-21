# PickLab: Flagsmith setup and hosting decision

Source: Flagsmith docs pages read on 2026-11-12 (set-up-with-a-coding-agent, experimentation overview, self-hosting, connect-a-warehouse, run-locally-with-a-coding-agent, run-an-experiment, create-metrics, create-an-experiment, analyse-an-experiment, and the official `docker-compose.yml`). Experimentation is **beta**. Two pages I could not read (`deployment-self-hosting/overview` and a Railway guide returned 404), so the Railway section is built from the compose file and env vars, not from an official Railway guide.

---

## 1. Decision

**Self-host Flagsmith with Docker. Run it locally while building, then run the same image on Railway for the real test, backed by its own Neon database.** Keep a Flagsmith Cloud account as plan B only.

| Option | Warehouse | Reachable by 50-100 testers? | Cost / ops | Verdict |
| --- | --- | --- | --- | --- |
| Flagsmith Cloud | Managed warehouse (Cloud only) or BYO (needs Scale-Up plan) | Yes | Zero ops | Plan B. Docs do not say if the managed warehouse is on the free plan: check the dashboard on Day 0 |
| Local Docker only | Flagsmith's own Postgres | **No**, `localhost:8000` is not visible to testers | Free | Dev and rehearsal only |
| **Self-host on Railway + Neon** | Flagsmith database (Postgres) | Yes, public Railway domain | Railway compute + Neon | **Chosen for the test** |
| Self-host + ClickHouse/Kafka/ingestion | ClickHouse | Yes | Heavy | Overkill for 100 testers |

Why this fits what the docs say:
- Experimentation works on open source and Enterprise self-host with no edition limit. Set `EXPERIMENTATION_ENABLED=true` on the API, otherwise the **Warehouse** tab never appears.
- The managed warehouse is **Flagsmith Cloud only**. Self-hosted uses the **Flagsmith database** option (events stored in Postgres) or your own ClickHouse/Databricks/Postgres. The Postgres option needs no Kafka and no ingestion service.
- The docs mark the Flagsmith-database option as "for evaluation". That is acceptable for about 100 testers and a few hundred events, as long as it is **not the same database as the app**. Events share the DB that serves flags and can slow it down.
- The official compose file already sets `EXPERIMENTATION_ENABLED: 'true'`, so the local and Railway setups behave the same.
- Self-hosting avoids the Day 0 unknowns about the managed warehouse and plan limits, and it matches the Docker idea you wanted.

Trade-offs you accept:
- You run and watch it yourselves (3 Railway services). A Neon cold start or a Railway restart during the test hurts flag reads. Mitigation is in section 4.
- The statistics (win probability) are computed by Flagsmith on demand. I did not find a doc saying the self-hosted Postgres option behaves differently, but nothing confirms it either. **Day 0 gate: run a full fake experiment end to end on the Railway deployment and read a win probability. If it does not work, switch to Cloud (plan B) before Day 1.**

---

## 2. What the docs require (checklist)

SDKs and runtime
- Browser: `@flagsmith/flagsmith` **12.4.0+** (docs name the package `@flagsmith/flagsmith`; the old project doc said `flagsmith`: use the scoped name). Server: `@flagsmith/nodejs` **9.1.0+**. Old `flagsmith-nodejs` cannot send events.
- Experiments need **remote evaluation**. Local evaluation is not supported.
- Users must be **identified**; exposures and conversions join on the same identity. Anonymous exposures are skipped.
- Init with `enableEvents: true`. Setting `eventProcessorConfig` without it makes JS `init` throw.
- Use `getExperimentFlag(name)` (or the React hook `useExperiment(name)` from `@flagsmith/flagsmith/react`, `null` until flags load) where the user actually *sees* the variation. It evaluates and records the exposure in one call. Exposures are de-duplicated per identity; only the earliest is kept.
- **Branch on `flag.variant` (the variation key), not on `flag.value`.** The docs example does `flag?.enabled && flag?.variant === 'show-paypal'`. Control has no variation key, so "not a known variant" = control.
- Next.js App Router: client `FlagsmithProvider` from `@flagsmith/flagsmith/react`, instance from `createFlagsmithInstance()` in `@flagsmith/flagsmith/isomorphic`.
- People without an account can be in the experiment: the docs say to identify logged-out visitors with a **persistent anonymous GUID**.
- `trackEvent(name, { value })`. Name is case-sensitive and must equal the metric's event name; mismatches are silently ignored. Conversions count only **after** the identity's first exposure.
- Events batch every 10 s. Call `flushEvents()` before navigation/unload. In Node call `await flagsmith.close()` before exit.
- Self-host: set `api: 'https://<flagsmith-host>/api/v1/'` (Node: `apiUrl`) and `eventProcessorConfig: { eventsApiUrl: 'https://<flagsmith-host>/api/' }` (SDKs append `v1/events`). Otherwise events go to Flagsmith Cloud.
- Event limits: timestamps not older than 10 days or more than 24 h ahead; batch under 2 MiB.

Flag, metric, experiment
- Multivariate flag: control = the flag's own value. `control` is a reserved key. **Every variation needs a `key`**; variations without keys record no exposures.
- Metric types are **Occurrence, Count, Sum, Mean** (the old doc said "conversion"; that type does not exist). Direction: higher better / lower better / informational. Metrics are per environment.
- Experiment: name + hypothesis, flag, **rollout %** (share of identities that enter), **variation split** (weights total 100, control gets the remainder), primary metric + expected direction. Starts immediately on create. Bucketing is deterministic per identity. One flag can be in only one active experiment.
- While running, flag config and variations are **locked**; only the rollout % can change. A metric on an active experiment cannot be deleted. **End Experiment** freezes results and unlocks the flag. An ended experiment cannot be restarted.
- Results: **Refresh results** at most once per 5 minutes ("As of" timestamp).
- **Minimum sample (statistics glossary): a metric shows *Collecting data* until EVERY arm has at least 50 identities, and for occurrence metrics at least 5 conversions per arm.** This sets the tester target, see section 4.
- Win probability = chance to **beat control** (each variation vs control, no best-of-all comparison, no multiple-comparison adjustment documented). Above 95% = winning, below 5% = losing, between = inconclusive. Credible interval is 95%; crossing zero = inconclusive. Lift = (variant - control) / control. Peeking does not inflate error the way p-values do.
- Sample-ratio-mismatch warning appears only from 100 identities; if shown, do not trust the result. Identities seen in more than one variation are quarantined.
- Secondary metrics on an experiment are not described in the pages I read. Plan on one primary metric; take secondary numbers from our own database.
- The Flagsmith **MCP server cannot start experiments**. Use the dashboard, CLI and API.
- CLI v2: Windows install `irm https://raw.githubusercontent.com/Flagsmith/flagsmith-cli/main/install.ps1 | iex`. `flagsmith login`, `flagsmith init` (writes `flagsmith.json`, safe to commit). Self-hosted: `FLAGSMITH_API_URL` plus a host-scoped key variable: append host and port, dots and colons become `_`, each hyphen is doubled (`https://flagsmith-staging.com:8000` -> `FLAGSMITH_API_KEY_flagsmith__staging_com_8000`). The README documents flag, variant, segment and override commands (`flagsmith feature create`, `feature variant add`, `segment create --rules @rule.json`, `flag update <feature> --segment <id>`), but **no metric or experiment commands**: create those in the dashboard or with `flagsmith api <path>`.

---

## 3. Build-time setup (step by step)

**Day 0, local Docker (about 30 min)**
1. Need Docker with Compose v2 and at least 4 GB memory for Docker; ports 8000 and 8001 free.
2. Paste the *Run Flagsmith locally* prompt from `docs.flagsmith.com/getting-started/run-locally-with-a-coding-agent` into Claude Code. It: downloads the compose file into `flagsmith/`, runs `docker compose up -d`, waits for liveness and for `migrate-db` to exit 0, creates the superuser/org/project and Development + Production environments through the API, connects each environment to the warehouse (`postgres` type, `flagsmith_database` source), installs Flagsmith CLI v2+, creates an org API key (**shown once, save it**) and writes `flagsmith/flagsmith.env` (mode 600; add to `.gitignore`).
3. Paste the *Set up an experiment* prompt from `docs.flagsmith.com/experimentation/set-up-with-a-coding-agent` in the app repo to create a throwaway flag, metric and experiment and push simulated users. This proves events -> results works. (I only have the page summary, not the exact prompt text: copy it from the page.)
4. Services: dashboard + API `http://localhost:8000`, task processor `http://localhost:8001`, SDK events URL `http://localhost:8000/api/`.
5. Clean up with `docker compose down` (keeps data) or `down -v` (wipes).

**Day 0-1, Railway deployment (the real test instance)**

Railway project `picklab-flagsmith` with three services from image `docker.flagsmith.com/flagsmith/flagsmith:<pinned version>` (do not use `latest` on test day):

| Service | Start command | Notes |
| --- | --- | --- |
| `flagsmith` | `serve` | Public domain. Health check `/health/liveness` (path from Flagsmith monitoring docs via search, confirm on first deploy) |
| `flagsmith-task-processor` | `run-task-processor` | Private. Starts after migrations |
| `migrate` | `migrate` | One-off / pre-deploy step. Must exit 0 before the other two start |

Shared env vars (same as the compose `x-flagsmith-env` block):

| Var | Value |
| --- | --- |
| `DATABASE_URL` | Neon connection string of the **dedicated Flagsmith database** (Postgres required) |
| `DJANGO_SECRET_KEY` | long random string (not `secret`) |
| `WAREHOUSE_CREDENTIALS_SECRET` | long random string (not `secret`) |
| `DJANGO_ALLOWED_HOSTS` | the Railway domain (not `*`) |
| `FLAGSMITH_DOMAIN` | the Railway domain, no scheme |
| `ENVIRONMENT` | `production` |
| `EXPERIMENTATION_ENABLED` | `true` |
| `TASK_RUN_METHOD` | `TASK_PROCESSOR` |
| `USE_POSTGRES_FOR_ANALYTICS` | `true` (as in compose) |
| `PREVENT_SIGNUP` / registration | lock sign-up after your admin account exists (see compose comments) |

Third-party Railway templates for Flagsmith exist (one adds Redis); treat them as a starting point only, and read their start scripts before trusting them.

Then repeat the Day 0 local steps against the Railway URL: create the admin user, org, project, two environments, connect each environment to the **Flagsmith database** warehouse (Environment Settings -> Warehouse -> Flagsmith database -> Enable), and run the throwaway experiment. Use `flagsmith login`-style host-scoped credentials as the setup prompt writes them to `flagsmith.env`.

**Neon notes**: one Neon project/DB per concern: `picklab-app` (app data) and `picklab-flagsmith` (Flagsmith + events). Use the *pooled* connection string for the app API, a direct connection for Flagsmith migrations if the pooled one errors. Free-tier compute scales to zero, which adds cold-start latency to flag reads; the task processor polling the database may keep it awake. Check current Neon plan limits before test day and disable scale-to-zero on the Flagsmith DB if the plan allows.

---

## 4. Flagsmith objects for PickLab

One project, two environments (Development, Production).

Flags

| Key | Type | Control / values | Purpose |
| --- | --- | --- | --- |
| `module_thumbnails` | boolean + JSON remote config | `{"title","instructions","sets_per_session"}` | Module release + copy |
| `module_captions` | same | same | Module release |
| `module_reel_captions` | same | same | Should-have module |
| `module_visuals` | same | same | Should-have module |
| `voting_enabled` | boolean | on | Global kill switch |
| `voting_layout` | multivariate | control = `grid`; variation keys `swipe`, `this_or_that`, `yes_no`, each with a percentage weight | Live view control + the experiment |

Live control before the experiment: change the weights (e.g. swipe 10%, then 50%), add an **identity override** on your own guest id to force a view during the demo, or a segment override to give one wave a fixed view. Bucketing is per identity, so a visitor keeps their view unless weights change; our API also fixes the view per session. App polls flags every 15 s with `startListening`.

Segments: `wave_1`, `wave_2`, `wave_3` (trait `wave` equals 1/2/3), `creators` (trait `role` = creator).

Waves and the experiment: a tester only enters the experiment when they open the voting screen, so later waves join later. That is fine (bucketing is per identity, both layouts get every wave), but open wave 1 early on 28 Nov and wave 3 by midday so everyone has time to finish.

Wave release: module flags default **off** in Production. Add segment overrides: `wave_1` on at test start, then `wave_2`, then `wave_3`. That is the "no deploy" release you demo.

Experiment `voting_layout_v1`
- Hypothesis: "The swipe layout raises the share of testers who finish a 5-set session from the grid baseline within 24 h."
- Rollout 100%, two arms per decision D2 in `DUE-DILIGENCE.md`: `grid` vs `swipe` 50/50, `this_or_that` and `yes_no` at 0% (control gets the remainder). The four-arm plan is superseded. Weights cannot be changed while it runs, only the rollout %, so finish playing with percentages first.
- The sample-size table below still applies: two arms need 50 identities each to leave *Collecting data*. Target 130+ recruited (D10). If the interval still spans zero, say so on camera.
- Primary metric: `session_completed`, **Occurrence**, higher is better. Locked before any data is collected (D10).
- Guardrail (not expected to move): average time per vote per view, from our own database. Flagsmith takes one primary metric.
- Votes per tester and time per vote come from our own `responses` and `set_results` tables, not from Flagsmith.
- `voting_layout` is created multivariate from the start, never converted from boolean (D11c).
- Create the experiment only after every layout in it works (flag locks; variations cannot be added later).
- Decision rule: use Flagsmith's own thresholds. Ship `swipe` above **95%** chance to beat control; keep `grid` below 5%; otherwise keep `grid` and report inconclusive with the credible interval.

**Sample size is the main constraint.** Results stay on *Collecting data* until every arm has 50 identities. So:

| Arms | Exposed testers needed just to see any result | Recruit target (allowing drop-off and uneven split) |
| --- | --- | --- |
| 2 views | 100 | 130+ |
| 4 views (our plan) | 200 | 260+ |

With 50-100 visitors over 4 views, expect *Collecting data* in Flagsmith; the per-view story comes from our Stats page. Optional: a final grid-vs-one-view experiment if you want a Flagsmith verdict. Say this on camera.

---

## 5. Corrections to `PickLab-Track1.md`

1. Hosting: managed warehouse is Cloud only. Self-host uses the Flagsmith database. Day 0 step "connect the managed warehouse" becomes "connect `flagsmith_database` warehouse".
2. Package name is `@flagsmith/flagsmith` 12.4.0+.
3. There is no "conversion" metric type. Primary metric is **Occurrence**.
4. The 90% rule is dropped: use Flagsmith's 95% / 5% thresholds (chance to beat control).
4a. 50-100 people over 4 views will not produce a Flagsmith verdict (50 identities per view required). Accepted: the focus is live control of views; numbers come from our Stats page.
4b. Code branches on `flag.variant`, and the events URL option is `eventProcessorConfig.eventsApiUrl`.
5. Metric changed from `set_completed` to `session_completed` (see PRD section 6) because a one-tap set would nearly always complete and show no difference.
6. Open questions now answered: managed warehouse on free plan = not stated in docs (Cloud only, verify); one team in two tracks and early tester recruiting are still unanswered (Discord).
7. Supabase is dropped (Neon + own API). Update the stack table.

## 6. Failure checklist (from docs)

No exposures: variation without `key`; flag requested before `identify`; page closed before `flushEvents`; SDK still pointing at Cloud events URL.
No conversions: event name differs by case/spelling; different identity id than the exposure; conversion happened before the first exposure.
Exposures on one arm only: the flag is read in one place and rendered from another; read it once in `apps/web/lib/session.ts` and render that value. Flat conversions with rising exposures: `trackEvent` not firing, or called with a different identity than the exposure (call it when the last set is saved, never on page load). Reassigned visitors: identity regenerated per request instead of the persisted guest id. No fallback when Flagsmith is down: add the default flag handler on both SDKs (D11f).
Nothing in results: no warehouse connected on that environment; identity outside rollout; timestamps outside window; batch over 2 MiB; enable SDK debug logging.

## 7. Verified against self-hosted Flagsmith (local, 2026-11-21)

Instance: official compose, project `picklab-flagsmith`, mapped to port 8100 (8000 was taken), `EXPERIMENTATION_ENABLED=true`. JS SDK 12.5.0, Node SDK 9.4.0.

Worked
- `pnpm flagsmith:setup` (`scripts/flagsmith-setup.ts`, admin REST API) on Development: 4 segments, 6 flags, 3 keyed variations, 6 segment overrides (19 changes). Second run: "no changes".
- Client API `POST /api/v1/identities/` with traits: wave 1 tester gets thumbnails+captions only; wave 2 tester gets no module; creator gets all four (D3). `voting_layout` reports `variant: "swipe"` for a swipe bucket and `variant: "control"` for control (the app maps unknown/`control` to `grid`).

REST paths used: `GET /environments/?project=<id>`, `GET|POST /projects/<id>/segments/`, `GET|POST /projects/<id>/features/` (`type: MULTIVARIATE`, `initial_value`), `POST /projects/<id>/features/<f>/mv-options/` (`key` is settable here, read-only in the nested create), `GET /environments/<key>/featurestates/?feature=<f>`, `PATCH /features/featurestates/<id>/` (weights), `GET /features/feature-segments/?environment=<id>&feature=<f>`, `POST /environments/<key>/features/<f>/create-segment-override/`. Schema: `/api/v1/swagger.json`.

The experiment API exists in this build: `/environments/<key>/experiment-metrics/` (aggregation `occurrence`, direction `up`), `/environments/<key>/experiments/` (+ `start`, `exposures`, `results`, `complete`), `/environments/<key>/warehouse-connections/` (type `flagsmith`). Nothing is created yet; no warehouse connection exists on either environment.

SDK note (JS 12.5.0 source): `getExperimentFlag` records an exposure only when the flag carries `experiment.inExperiment` (a running experiment) and flags came from the server, so there are no exposures before the experiment starts.

Not verified yet: API server path with `FLAGSMITH_SERVER_KEY` (cache, kill switch, 503/403, outage fallback), browser path in Next, weights to swipe=100 and identity override, `trackEvent` reaching `/api/v1/events/`, metric/experiment creation and exposures, the Production environment.

### 7.1 API server path, verified (local, 2026-11-21)

API run with `FLAGSMITH_SERVER_KEY` (Development) against the local Flagsmith, on a fresh database, using curl:

| Check | Result |
| --- | --- |
| Wave 1 guest `GET /api/modules` | `thumbnails`, `captions` only |
| Wave 2 and wave 3 guests | no modules (no segment override yet) |
| Creator (dev login) | all four modules (D3) |
| `voting_enabled` off in Flagsmith | within 12 s `votingEnabled=false`, `POST /api/sessions` returns 503 |
| `voting_enabled` back on | restored within 12 s |
| Flagsmith unreachable, no cache (API pointed at a dead URL) | `{"votingEnabled":true,"modules":[]}`, session start refused with 403 (TRD 6) |

Still not verified: module-off mid-session 403 on set results through a real flag change, a `wave_2` override appearing live, and the whole browser SDK path (identity override, weight change, `trackEvent` reaching the events endpoint, experiment and exposures). The experiment endpoints exist (`/environments/<key>/experiment-metrics/`, `/experiments/`, `/warehouse-connections/`) but no warehouse connection, metric or experiment was created.

Toggle helper used for the kill switch test: PATCH `/environments/<client key>/featurestates/<id>/` with `{"enabled": false}` using the admin token.

### 7.2 Changing `voting_layout` weights through the API (verified, local, 2026-11-21)

- `PATCH` on `/environments/<key>/featurestates/<id>/` with nested `multivariate_feature_state_values` returns 200 but **does nothing**. Use `PUT` with the full feature state object (`scripts/flagsmith-setup.ts` does).
- With weights swipe 100: 20 of 20 new identities received `swipe`. Restored to swipe 10 / others 0. This is the Stream B demo (change the split in Flagsmith, new visitors get the new view, no deploy) at API level. Existing assignment for an identity changes when weights change, as the docs warn.
- In the dashboard the same change is a normal edit; this note only matters for scripts.
