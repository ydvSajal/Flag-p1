# PickLab: Agent handover

For the build agents working 26-27 Nov 2026. Read this file fully before touching anything. You have no other context: everything you need is in `docs/`.

## 1. What you are building

PickLab: creators post 2-4 options, guests vote, Flagsmith controls which modules a guest sees and which of four voting views they get. Read in this order:

1. `HANDOVER.md` (this file): your tasks and rules.
2. `TRD.md`: folder structure (section 2), data and rules (4), API (5), Flagsmith code (6). **This is your spec.**
3. `PRD.md`: why, and the vote model (section 6).
4. `FRONTEND.md`: screens, only if you own web tasks. Apply the errata in section 8 below.
5. `TEST-CASES.md`: the tests your task must make pass.

Do not read `docs/archive/`. They are outdated.

If documents disagree: `DUE-DILIGENCE.md` decisions > `SCOPE.md` > `PRD.md` / `TRD.md` > `FRONTEND.md`.

## 2. Rules

1. **Stay in your files.** Section 4 lists who owns which paths. Do not edit a path you do not own. If you need a change there, report it (rule 9).
2. **The contract is frozen.** `packages/shared/src/schemas.ts`, `constants.ts` and `apps/api/src/db/schema.ts` are written in T0 and changed only by the lead. Build against them exactly.
3. **No new dependencies.** The allowed list is in `TRD.md` section 1. Need another one: stop and ask.
4. **Smallest thing that meets the acceptance criteria.** No abstractions for later, no extra endpoints, no config for values that never change, no placeholder files. Reuse what is in `packages/shared` and `components/ui` before writing anything new.
5. **Verify library APIs from the installed package**, not from memory and not from these docs: read the `.d.ts` in `node_modules`. This applies most to `@flagsmith/flagsmith`, `@flagsmith/nodejs`, `better-auth`. If a name differs from `TRD.md`, use the installed one and say so in your report.
6. **Never** put a secret in code, tests, logs or a commit. Never use the Flagsmith server key in `apps/web`. Never call `getExperimentFlag` in `apps/api`. Read the experiment flag only in `apps/web/lib/session.ts`.
7. **Tests.** Each task names the test ids it must satisfy. Write those tests, nothing more. Before you report: `pnpm typecheck && pnpm lint && pnpm test` all pass.
8. **Commits.** One task, one branch `t/<task-id>`, small commits, message `T<id>: what changed`. Do not push to `main`, do not force-push, do not rewrite history.
9. **Stop and ask the lead** when: the spec is ambiguous or contradicts itself; a task needs a file you do not own; a library does not behave as documented after 20 minutes; a test in `TEST-CASES.md` seems wrong; you would exceed the task's time box by more than 50%.
10. **Report format** when done (and nothing else):
    ```
    Task: T<id>
    Status: done | blocked | partial
    Files changed: <list>
    Tests: <ids passing> / <ids failing with one-line reason>
    Deviations from TRD: <none | list with reason>
    Needs from others: <none | list>
    ```
    Report failures plainly. A failing test with a clear reason is more useful than a passing test that was weakened.

## 3. Workstreams

| Stream | Agent | Scope |
| --- | --- | --- |
| LEAD | lead (stronger model or human) | T0 contract, reviews, merges, integration, deploy |
| API | agent A | `apps/api` routes and tests |
| WEB-V | agent B | Visitor flow: flags provider, home, voting views |
| WEB-C | agent C | Creator flow and admin pages |
| OPS | agent D | Seed, simulate, Flagsmith setup script, README |

WEB-V and WEB-C start against the frozen schemas with a local mock of `lib/api.ts` responses if the API task they need is not merged yet. Remove the mock when it is.

## 4. File ownership

| Path | Owner |
| --- | --- |
| root config, `packages/shared/**`, `apps/api/src/app.ts`, `apps/api/src/db/**`, `apps/api/src/env.ts`, `apps/api/test/helpers.ts` | LEAD |
| `apps/api/src/auth.ts`, `flags.ts`, `storage.ts`, `middleware.ts`, `routes/**`, `apps/api/test/*.test.ts` | API |
| `apps/web/app/layout.tsx`, `apps/web/components/ui/**`, `apps/web/lib/api.ts` | LEAD writes in T0, then WEB-V may extend `ui/` (WEB-C asks WEB-V) |
| `apps/web/lib/flags.tsx`, `lib/session.ts`, `app/page.tsx`, `app/start/**`, `app/app/**`, `app/about-test/**`, `app/privacy/**`, `not-found.tsx`, `error.tsx`, `components/voting/**`, `components/home/**` | WEB-V |
| `apps/web/lib/image.ts`, `app/login/**`, `app/creator/**`, `app/admin/**`, `app/account/**`, `components/creator/**`, `components/admin/**` | WEB-C |
| `scripts/**`, `README.md`, `.env.example`, `flagsmith/**` | OPS |

## 5. Tasks

Time boxes are for an agent working without interruption. "Tests" refers to ids in `TEST-CASES.md`.

### Day 1, 26 Nov

| ID | Stream | Task | Depends on | Box | Acceptance |
| --- | --- | --- | --- | --- | --- |
| T0 | LEAD | `git init`, pnpm workspace, tsconfig, lint. `packages/shared`: constants, all zod schemas, `rules.ts` with tests. `apps/api`: `db/schema.ts`, first migration, `client.ts` (pg and pglite), `app.ts` with `createApp(deps)` and `/healthz`, `test/helpers.ts`. `apps/web`: Next app, Tailwind, rewrite, shell, `components/ui`, typed `lib/api.ts` | gates G1-G6 | 3 h | U-01..U-12 pass. `pnpm dev` serves web and API. `GET /healthz` returns ok. Contract announced as frozen |
| A1 | API | `auth.ts` (Better Auth, Google, anonymous; or the fallback in TRD 4.3), `middleware.ts`, `routes/me.ts` | T0 | 2 h | A-01..A-07 |
| A2 | API | `flags.ts` (server client, 10 s cache, defaults), `routes/modules.ts` | A1 | 1.5 h | A-08..A-14 |
| A3 | API | `routes/sessions.ts`, `routes/set-results.ts` | A2 | 3 h | A-15..A-34e |
| A4 | API | `routes/admin.ts`: `GET /admin/live` | A3 | 1 h | A-45..A-48 |
| V1 | WEB-V | `lib/flags.tsx`, landing P-01, consent P-05, home P-06 with module cards, live refresh, "New" badge, empty states | T0 | 3 h | E-01..E-05, F-01..F-03 on local Flagsmith |
| V2 | WEB-V | `lib/session.ts`, `VotingFrame`, `OptionMedia`, `GridView`, done page P-08, paused page P-09, resume | V1, A3 | 3 h | E-06..E-09, E-14..E-17 with `grid` |
| V3 | WEB-V | `SwipeView` (drag, buttons, keyboard, reduced motion) | V2 | 2 h | E-10, E-18 |
| C1 | WEB-C | Login P-02, `LiveTable`, `SplitBars`, live page P-17 with 5 s polling and pause toggle | T0, A4 | 2.5 h | E-26, E-27 |
| O1 | OPS | `.env.example`, `README.md`, `scripts/flagsmith-setup.sh` (flags, variations with keys, segments, overrides including `creators`, per TRD 6 and FLAGSMITH-SETUP 4), run against local Flagsmith | T0 | 2 h | F-01 setup reproducible from an empty Flagsmith project in one command |
| O2 | OPS | `scripts/seed.ts` and `seed-data/sets.json` format; idempotent (re-run creates nothing new) | A1, T0 | 1.5 h | S-01, S-02 |

**Day 1 exit (lead checks at end of day):** a guest opens the local site, consents, sees modules allowed by Flagsmith, finishes a session in `grid` or `swipe` depending on the flag, and appears on the Live page. This is test **X-01**.

### Day 2, 27 Nov

| ID | Stream | Task | Depends on | Box | Acceptance |
| --- | --- | --- | --- | --- | --- |
| A5 | API | `storage.ts`, `routes/uploads.ts`, `routes/sets.ts` (create, mine, results) | A1 | 2.5 h | A-35..A-44 |
| A6 | API | `GET /admin/overview`; rate limit; `DELETE /me`, `DELETE /sets/:id` (Should) | A4, A5 | 1.5 h | A-49..A-54 |
| V4 | WEB-V | `ThisOrThatView` with knockout | V2 | 2 h | E-11, E-12 |
| V5 | WEB-V | `YesNoView` | V2 | 1 h | E-13 |
| V6 | WEB-V | Polish: preload, optimistic advance, retry toast, a11y pass, mid-session pause, static and error pages | V3-V5 | 2 h | E-19..E-25 |
| C2 | WEB-C | `lib/image.ts`, new set P-11, my sets P-10 | A5 | 3 h | E-28..E-32 |
| C3 | WEB-C | Set results P-12 | A5 | 1 h | E-33, E-34 |
| C4 | WEB-C | Stats page P-13 (table first, bars if time); account page P-14 (Should) | A6 | 1.5 h | E-35, E-36 |
| O3 | OPS | `scripts/simulate.ts`: N visitors through the real API and SDK, option for drop-off rate | A3 | 2 h | S-03, S-04 |
| O4 | OPS + LEAD | Deploy: Vercel, Railway API, env vars, migrations, seed Production, run setup script on Production Flagsmith | all Must tasks | 2 h | X-02..X-08 on Production |

**Cut line, 6 PM on 27 Nov, in this order, no discussion:** V5 (`yes_no`), reel captions and visuals content, C4 bars, `DELETE` endpoints and account page. Never cut: `grid`, `swipe`, Live page, waves, kill switch, percentage control.

**Day 2 exit:** X-01..X-08 pass on Production. Then the humans record Stream B (decision D1).

### Not agent work (humans)

Gates G1-G6, UI design, seed content collection, creating the metric and the experiment in the Flagsmith dashboard, opening waves, ending the experiment, rolling out the winner, the video.

## 6. Definition of done for any task

- Acceptance tests listed for the task pass; nothing else broke (`pnpm typecheck && pnpm lint && pnpm test`).
- Only files you own changed.
- No `any`, no `@ts-ignore`, no `console.log` left, no commented-out code, no TODO without a task id.
- Web tasks: checked at 360 px width and on desktop, keyboard works, loading / empty / error states exist.
- Report sent in the format of rule 10.

## 7. Conventions

- TypeScript strict. Named exports. `type` over `interface`. No default exports except where Next.js requires them.
- API handlers: parse with the shared zod schema, check auth, run the query, return the shared response type. Throw `HttpError(status, code, message)`; `app.ts` formats it.
- Time comes from `deps.now()` in the API, never `Date.now()`, so tests can control it.
- Ids are UUID v4 from `crypto.randomUUID()`.
- Web data fetching: `lib/api.ts` only. No fetch calls in components.
- Colours for the four views are defined once in `components/ui/badge` and reused on the Live and Stats pages.
- Copy: short, friendly, honest. Never promise rewards.
- Flagsmith wiring (D11): use the persisted guest id as the identity on every call; create each Flagsmith client once at module scope; give both SDKs a default flag handler (browser `grid`, API cached flags then none); call `trackEvent('session_completed')` only when the last set is saved, with the identity used for the exposure.

## 8. FRONTEND.md errata

| Where | Says | Use instead |
| --- | --- | --- |
| P-01 | "the experiment needs 100+ of them" | Ignore; visitor count is not a goal |
| P-06 | One primary "Start session" button plus module cards | Each module card has its own Start / Continue button (a session belongs to one module) |
| P-06, flow 4 | Flag refresh on focus / 60 s | Focus and every 15 s |
| P-12 | "picks and %" | Score % = (picks + yes) / voters, and the voter count |
| P-13 | "3 columns" per layout, sample-ratio check expected vs actual | 4 views; show the actual split and a link to the flag in Flagsmith |
| P-17 | "split as set in Flagsmith vs actual" | Actual split of the last hour only, plus the link |
| Section 5 | "pair option" | The this-or-that option |
