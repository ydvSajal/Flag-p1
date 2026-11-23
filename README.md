# PickLab

Social testing for creators, driven end to end by [Flagsmith](https://www.flagsmith.com/).

A creator posts 2-4 options (thumbnails, captions) for an upcoming post. Anyone with the link votes. The creator sees which option people prefer. Flagsmith decides **what each visitor sees**, live, with no deploy.

Built for **Toggle Wars, Flagsmith Experimentation Hackathon, Track 01**.
Build 26-27 Nov 2026 · real users 28 Nov · submit 29 Nov before 8 PM IST.
Expected audience: 50-100 people. **The product and how Flagsmith drives it matter more than the numbers**, but the experiment must be wired correctly and its result stated honestly (decisions D10-D12 in `docs/DUE-DILIGENCE.md`). Judged on Use of Flagsmith, Impact, Creativity and the demo video (about 25%).

> Status: local build done and verified (see `docs/BUILD-STATUS.md`). Deploy steps: `docs/DEPLOY.md`.

---

## 1. Read this first

| Your role | Read, in order |
| --- | --- |
| Everyone | this README, then `docs/SCOPE.md` |
| Build agent / backend dev | `docs/HANDOVER.md` (your task + rules), `docs/TRD.md` (**your spec**), `docs/TEST-CASES.md` |
| Frontend dev | `docs/HANDOVER.md`, `docs/FRONTEND.md` (apply the errata in HANDOVER section 8), `docs/TRD.md` sections 2 and 6 |
| Flagsmith / ops | `docs/FLAGSMITH-SETUP.md`, `docs/TRD.md` sections 6-7 |
| Product / demo | `docs/PRD.md`, `docs/SCOPE.md` sections 8-9 |

**If docs disagree, higher wins:**
`docs/DUE-DILIGENCE.md` decisions (D1-D12) > `docs/SCOPE.md` > `docs/PRD.md` / `docs/TRD.md` > `docs/FRONTEND.md`.

**Ignore these, they are outdated:** `docs/archive/` (includes the old `PickLab-Track1.md`).

---

## 2. What we are building

**Visitor (guest, no sign-up):** open link, accept one consent screen, land on Home with the modules Flagsmith allows for them, start a 5-set voting session, finish.

**Creator (Google sign-in):** post a set of 2-4 images or texts, see results per option ("chosen by X% of people who saw it").

**Team (admin):** a Live page (who is on the site right now, which view they got, progress) and a Stats page (sessions, completion %, time per vote, per view).

### The four voting views

All behind one flag, `voting_layout`. Every view writes comparable responses.

| View | Behaviour | Signal recorded |
| --- | --- | --- |
| `grid` (control) | All options as tiles, tap one | `pick` |
| `swipe` | Card stack, right = like, left = pass | `yes` / `no` |
| `this_or_that` | Two side by side, pick one; 3-4 options run as a quick knockout | `pick` |
| `yes_no` | One option at a time, Yes / No buttons | `yes` / `no` |

### Modules

Thumbnails (image) and Captions (text) are Must. Reel captions and Visuals are Should (same screens, different content).

---

## 3. Where Flagsmith fits (the point of the project)

Nothing a visitor sees is hard-coded. Flagsmith is the control panel.

| Stream | Controlled live from Flagsmith | Flagsmith feature |
| --- | --- | --- |
| **A. Product** | Which modules exist, for whom (waves, creators), titles, instructions, emergency off | Boolean flags, segments, overrides, JSON remote config |
| **B. Voting view** | Which view each visitor gets and in what share (e.g. 10% swipe, or 50/50). Force a view for one person | Multivariate flag with % weights, identity and segment overrides |
| **C. The test** | Run views as a real A/B test, see exposures and results, end it, roll the winner out to everyone | Flagsmith Experimentation |

### Flags and segments

| Key | Type | Purpose |
| --- | --- | --- |
| `module_thumbnails`, `module_captions`, `module_reel_captions`, `module_visuals` | boolean + JSON config | Module on/off per segment, titles, set count |
| `voting_layout` | multivariate (4 variations) | Which view a visitor gets |
| `voting_enabled` | boolean | Kill switch, shows the paused screen |

Segments: `wave_1`, `wave_2`, `wave_3`, `creators` (creators always see every module).
Experiment: `voting_layout_v1` on `voting_layout`, metric `session_completed`.

### Who decides what

- **Flagsmith decides** module access, the view, whether voting is on.
- **The API enforces** module access and the kill switch (using traits from our own DB, never trusting the browser) and owns all response data.
- **The browser** renders, reads the experiment flag **once per session start** (that records the exposure), and sends `session_completed`.

Flags refresh every 15 s and on tab focus. A visitor keeps their view for the session in progress; a new view applies from the next session.

### Demo story (3 min)

1. Problem: creators guess which thumbnail works.
2. Product: visitor votes, creator sees results.
3. Stream B: change swipe 10% to 50% in Flagsmith, Live page shows new visitors on swipe. Identity override forces a view for the presenter.
4. Stream A: open captions for wave 2, it appears. Kill switch hides it.
5. Stream C: experiment, exposures, Stats per view, end experiment, roll the winner to 100%.
6. What we learned, including what the data could not say.

---

## 4. Architecture

```
Browser (Next.js on Vercel) ──/api/* rewrite──> API (Hono on Railway) ──> Neon Postgres (picklab-app)
   │  Flagsmith JS SDK                              │  @flagsmith/nodejs (module access, kill switch)
   │                                                v
   ├────── flags + events ─────────────────> Flagsmith (self-hosted on Railway) ──> Neon (picklab-flagsmith)
   └────── presigned PUT / public GET ─────> Cloudflare R2 (images)
```

| Layer | Choice |
| --- | --- |
| Web | Next.js App Router, React, Tailwind |
| API | Node 22, TypeScript, Hono |
| Contract | zod schemas in `packages/shared`, one source of types for web and API |
| DB | Neon Postgres, Drizzle ORM |
| Auth | Better Auth: Google (creators/admins), anonymous plugin (guests). Fallback: signed guest cookie, see TRD 4.3 |
| Images | Cloudflare R2, presigned upload, public read |
| Flags | Self-hosted Flagsmith (Docker locally, same image on Railway). Flagsmith Cloud is plan B, only two env vars change |
| Tests | vitest + pglite (in-memory Postgres), Flagsmith and auth injected as fakes |

Not used, on purpose: Supabase, Redis, queues, GraphQL, ClickHouse, Kafka, a state library, an E2E framework.

### Repo layout

```
apps/web          Next.js app. Never imports from apps/api
apps/api          Hono API. Never imports from apps/web
packages/shared   zod schemas, constants, pure rules (rules.ts). Only dependency: zod
scripts/          seed, simulate, flagsmith-setup.sh
flagsmith/        local docker-compose for Flagsmith
docs/             all specs
```

Full tree with every file: `docs/TRD.md` section 2.

---

## 5. Rules for every dev

These are from `docs/HANDOVER.md`. Short version:

1. **Stay in your files.** Each path has one owner (HANDOVER section 4). Need a change elsewhere? Ask, do not edit.
2. **The contract is frozen.** `packages/shared/src/schemas.ts`, `constants.ts`, `apps/api/src/db/schema.ts` change only through the lead.
3. **No new dependencies.** Allowed list is `docs/TRD.md` section 1. Need another: ask.
4. **Smallest thing that meets the acceptance criteria.** No abstractions for later, no extra endpoints, no placeholder files.
5. **Verify library APIs from installed `.d.ts`**, not from memory or these docs (especially `@flagsmith/flagsmith`, `@flagsmith/nodejs`, `better-auth`). If a name differs from the TRD, use the installed one and report it.
6. **Secrets:** never in code, tests, logs or commits. The Flagsmith **server** key never goes in `apps/web`. `getExperimentFlag` is called **only** in `apps/web/lib/session.ts`, never in the API.
7. **Tests:** write the test ids your task names, nothing more. Before reporting: `pnpm typecheck && pnpm lint && pnpm test` must pass.
8. **Git:** one task, one branch `t/<task-id>`, small commits `T<id>: what changed`. No push to `main`, no force-push.
9. **Stop and ask the lead** if the spec is unclear or contradicts itself, you need a file you do not own, a library misbehaves after 20 min, a test looks wrong, or you will exceed the time box by 50%.
10. **Report** when done: task, status, files changed, tests passing/failing, deviations from TRD, needs from others.

### Code conventions

- TypeScript strict. Named exports. `type` over `interface`. No `any`, no `@ts-ignore`, no leftover `console.log`.
- API: parse with the shared zod schema, check auth, query, return the shared response type. Throw `HttpError(status, code, message)`.
- API time comes from `deps.now()`, never `Date.now()`.
- Web data fetching only through `lib/api.ts`. No `fetch` in components.
- Ids are UUID v4 from `crypto.randomUUID()`.
- Web work is checked at 360 px and desktop, keyboard works, loading / empty / error states exist.
- Copy: short, friendly, honest. Never promise rewards.

---

## 6. Who builds what

| Stream | Scope |
| --- | --- |
| LEAD | T0 contract (shared schemas, DB schema, app factory), reviews, merges, integration, deploy |
| API | `apps/api` routes and tests |
| WEB-V | Visitor flow: flags provider, home, the four voting views |
| WEB-C | Creator flow and admin pages (Live, Stats) |
| OPS | Seed, simulate, Flagsmith setup script, `.env.example`, this README |

Task list with time boxes and acceptance tests: `docs/HANDOVER.md` section 5.

### Timeline

| Day | Goal | Exit check |
| --- | --- | --- |
| Prep, to 25 Nov | Flagsmith running locally + Railway, dry-run experiment, accounts, UI design, 20+ seed sets per module, 50-100 people lined up | Gates G1-G6 green |
| 26 Nov | Monorepo, API, DB, guest id, modules from flags, sessions, `grid` + `swipe`, Live page | Guest finishes a session in `grid` or `swipe` per the flag and shows on Live (test X-01) |
| 27 Nov | `this_or_that`, `yes_no`, creator post + results, Stats, waves, kill switch, deploy | Changing weights in Flagsmith changes what new visitors get; X-01..X-08 pass on Production. Record Stream B |
| 28 Nov | Set final split, create metric, start experiment, share public link | Visitors on views, responses flowing |
| 28 Nov evening | Record Streams A and C of the demo from live data (D12) | Video drafted |
| 29 Nov | End experiment, roll out winner (or `grid`), re-shoot the last 20 s, submit early. Never record in the last hour | Video submitted |

**Cut order if late (6 PM, 27 Nov, no discussion):** `yes_no`, reel captions + visuals, Stats bars (keep table), creator delete + account page.
**Never cut:** `grid`, `swipe`, Live page, percentage rollout, waves, kill switch, experiment, winner rollout.

### Key decisions to know

- **Experiment is two arms, `grid` vs `swipe`, 50/50** (`this_or_that` and `yes_no` at 0% in the experiment split). All four views still ship. Four arms would need 200 identities for a Flagsmith result; we expect 50-100. (D2)
- **Record the weight-change demo before the experiment starts.** A running experiment locks `voting_layout`. (D1)
- **A session belongs to one module.** Started from a module card. (D5)
- **Live/Stats pages show the actual split only**, plus a link to the flag in Flagsmith. No Flagsmith admin key on the server. (D4)
- Live status: `finished` = completed, `voting` = seen in last 2 min, `dropped` = not finished and unseen for 2 min. (D7)
- **Experiment design is locked before data** (D10): metric `session_completed`, guardrail average time per vote (from our DB), target 50+ identities per arm. Say on camera if the interval still spans zero.
- **Wiring rules** (D11): one stable guest id, `session_completed` tracked with that same id at completion, `voting_layout` multivariate from day one, client created once, default flag handlers on both SDKs, server key only in server env vars.
- **Video is recorded by 28 Nov night** (D12).
- If Flagsmith shows *Collecting data* instead of a verdict, we say so honestly and show the experiment, exposures and our own Stats page.

---

## 7. Run locally

### Quickest start: no accounts needed (local mode)

With the Flagsmith, Google, Neon and R2 variables empty, everything runs on stand-ins (`docs/LOCAL-DEV.md`): PGlite database, flags from `apps/api/local-flags.json`, dev login, local image uploads.

```bash
cp .env.example .env        # defaults are fine; ALLOW_DEV_LOGIN=1, ADMIN_EMAILS=admin@picklab.local
pnpm install
pnpm dev                    # API on :3001, web on :3000 (web proxies /api to the API)
pnpm seed                   # in another terminal; idempotent, needs the API running
```

Open http://localhost:3000. Creator: `/login` (dev login, any email). Admin pages: sign in as `admin@picklab.local`, then `/admin` and `/admin/live`. Change `local-flags.json` (re-read every 10 s) to try waves, module off and the kill switch. In local mode the voting view comes from `?layout=swipe` (grid, swipe, this_or_that, yes_no).

Checks: `pnpm typecheck && pnpm lint && pnpm test` (13 shared + 66 API tests, no infrastructure).

### With real Flagsmith

```bash
# 1. Flagsmith (local)
cd flagsmith && docker compose up -d        # dashboard on http://localhost:8000

# 2. Configure it (flags, variations, segments, overrides)
./scripts/flagsmith-setup.sh

# 3. App
cp .env.example .env                         # fill in values, never commit
pnpm install
pnpm db:migrate
pnpm seed                                    # idempotent
pnpm dev                                     # web + API

# Checks
pnpm typecheck && pnpm lint && pnpm test
pnpm simulate                                # N fake visitors through the real API + SDK
```

### Environment variables (names only, values never in the repo)

| Variable | Used by | Secret |
| --- | --- | --- |
| `NEXT_PUBLIC_FLAGSMITH_ENV_KEY`, `NEXT_PUBLIC_FLAGSMITH_API`, `NEXT_PUBLIC_FLAGSMITH_EVENTS_URL` | web | No (client-side key) |
| `API_ORIGIN` | web | No |
| `DATABASE_URL` | api | Yes |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | api | Yes / no |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | api | Yes |
| `FLAGSMITH_SERVER_KEY`, `FLAGSMITH_API_URL`, `FLAGSMITH_DASHBOARD_URL` | api | Key is secret |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` | api | Keys are secret |
| `ADMIN_EMAILS` | api | No |

The Flagsmith **admin/organisation** key lives only in the Flagsmith owner's CLI. Never in the repo, Vercel or Railway. Change Flagsmith's default secrets before deploy.

---

## 8. Out of scope

Payments, marketplace, AI suggestions, bot/fraud detection, native app, notifications, i18n, ClickHouse/Kafka, chasing statistical significance.

## 9. Definition of done (project)

1. Changing `voting_layout` weights in Flagsmith changes what new visitors get, no deploy, Live page shows it.
2. An identity override forces a chosen view for the presenter within 15 s.
3. Opening a module for `wave_2` makes it appear for those visitors without reload; turning it off hides it and the API refuses votes for it.
4. `voting_enabled` off shows the paused screen.
5. All four views record comparable responses; creators see per-option results.
6. Experiment ran, exposures visible in Flagsmith, winner (or `grid`) served at 100% at the end.
7. No secrets in the repo.
8. Demo video of 3 min or less.

## 10. Open items

Product name and domain · who owns which stream · Flagsmith Discord answer on self-hosted for Track 01 (G1; if no, switch to Cloud, nothing else changes) · WeMakeDevs submission fields.
