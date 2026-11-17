# PickLab: Due diligence (CTO review, 16 Nov 2026)

Reviewed: `SCOPE.md`, `PRD.md` v1, `TRD.md` v1, `FRONTEND.md`, `FLAGSMITH-SETUP.md`, `PickLab-Track1.md`.
Output of this review: `PRD.md` v2, `TRD.md` v2, `HANDOVER.md`, `TEST-CASES.md`. Old PRD/TRD are in `docs/archive/`.

**Verdict: GO, conditional on gates G1 and G2 passing by 22 Nov.** The product is small and well scoped. The risk is not the code, it is Flagsmith self-hosted experimentation (beta, unproven on our setup) and one contradiction in the plan about when the experiment starts.

Doc precedence from now on: decisions in section 3 below > `SCOPE.md` > `PRD.md` / `TRD.md` v2 > `FRONTEND.md` > everything else.

---

## 1. Gates (resolve before 26 Nov)

| ID | Gate | Why it matters | Action | Deadline | If it fails |
| --- | --- | --- | --- | --- | --- |
| G1 | Does Track 01 accept a **self-hosted** Flagsmith instance? | Whole hosting plan depends on it. Still unanswered | Ask in Flagsmith Discord | 18 Nov | Switch to Flagsmith Cloud. App code is unchanged (two env vars) |
| G2 | Does the self-hosted **Flagsmith-database warehouse** actually produce experiment results? | Docs call it "for evaluation"; nothing confirms the statistics work | Full dry run on the Railway deployment: 4 variations, 120+ simulated identities, read a result | 22 Nov | Switch to Cloud before Day 1 |
| G3 | Can variation weights be **0%** inside an experiment split? | Needed for decision D2 (two-arm experiment on a four-variation flag) | Check during the G2 dry run | 22 Nov | Run 4 arms, accept *Collecting data*, use our Stats page |
| G4 | Are we allowed to write product code before 26 Nov? | Handover assumes **no**: only infra, design, seed content, throwaway spikes | Read the rules / ask WeMakeDevs | 18 Nov | Nothing changes, plan already assumes no |
| G5 | Better Auth anonymous plugin + Hono + cookies through the Vercel rewrite | Guest identity is the Flagsmith identity. If this is flaky everything is | Throwaway spike (not product code), 1 hour | 24 Nov | Use the fallback: signed httpOnly guest cookie issued by the API (TRD 4.3) |
| G6 | Neon scale-to-zero on the Flagsmith database | Cold start = slow flag reads for every visitor | Check plan; disable scale-to-zero or add a 4-min keep-alive ping | 24 Nov | Keep-alive ping on `/health/liveness` |

## 2. Findings

Severity: **H** = would break the demo or the experiment, **M** = wasted build time or wrong data, **L** = cosmetic.

| # | Sev | Finding | Resolution |
| --- | --- | --- | --- |
| F1 | H | **Experiment start contradicts the live-control demo.** SCOPE section 7 starts the experiment on the evening of 27 Nov, and also says "play live with percentages" on 28 Nov. A running experiment locks the flag: weights and overrides on `voting_layout` cannot change | D1 |
| F2 | H | **Sample size.** 4 arms x 50 identities = 200 needed for any Flagsmith result. Audience is 50-100. The track is called "Test Something Real" and we would show *Collecting data* | D2 |
| F3 | H | **Creators cannot post into unreleased modules.** Module flags default off and only wave segments get overrides. Creators and the seed script see zero modules until a wave opens | D3 |
| F4 | M | "Configured split vs actual split" on the Live and Stats pages needs the Flagsmith **admin** key on the server. Security rule says that key never leaves the CLI | D4 |
| F5 | M | Session scope undefined. `sessions.module` is one column, `sets_per_session` lives per module, but the API text says "sets for enabled modules" | D5 |
| F6 | M | Who decides the layout stored on the session? TRD says "client-read flag, recorded" but does not say what happens on resume or tampering | D6 |
| F7 | M | TRD v1 references a `votes` table that no longer exists (indexes, section 6, section 9). Agents would build the wrong schema | Fixed in TRD v2 |
| F8 | M | Flag refresh interval: SCOPE says 15 s, TRD v1 and FRONTEND flow 4 say 60 s | 15 s everywhere. Server cache cut from 30 s to 10 s so the API refuses a killed module quickly |
| F9 | M | PRD v1 describes two layouts, old swipe rules (right swipe ends the set), a "pairs" layout, and single-pick votes. Only a banner says it is superseded | Rewritten as PRD v2 |
| F10 | M | "Dropped" status on the Live page is never defined | D7 |
| F11 | M | R2 read access undecided ("public or signed GET"). Signed GETs add an API call per image and break preloading caches | D8 |
| F12 | M | No test strategy that works without infrastructure. Agents need tests they can run locally with no Docker, no Neon, no Flagsmith | D9 |
| F13 | M | Results are not strictly comparable across views: grid and this-or-that give one pick per visitor, swipe and yes/no can give several yes. A set scored in swipe looks "more liked" | Accepted. Results page shows one score, admin sees the per-view split. Say it in the demo |
| F14 | L | Traits are sent from the browser, so a visitor can edit `wave` in devtools and see an unreleased module card | Accepted. The API evaluates flags with traits from our database and refuses the vote |
| F15 | L | `PickLab-Track1.md` is fully stale (Supabase, 3 layouts, `set_completed`, 90% rule) | Do not give it to agents. Move to `docs/archive/` when convenient |
| F16 | L | `FRONTEND.md` leftovers: P-01 "needs 100+ testers", P-13 "3 columns" per layout, flow 4 "60 s", P-07 swipe text is right but PRD v1 was not | Errata list in `HANDOVER.md` section 8 |
| F17 | L | Working folder is not a git repo and its name contains a space | `git init` in a clean folder named `picklab` on Day 1 (task T0) |
| F18 | L | Fewer unvoted sets than `sets_per_session` is unhandled | Session target = min(config, sets left). Zero left = no session, card shows "No sets left" |

## 3. Decisions

| ID | Decision | Needs owner sign-off? |
| --- | --- | --- |
| D1 | **Record Stream B (weights, identity override) before the experiment starts.** Timeline: 27 Nov evening, team devices on Production, record weight changes and the override. 28 Nov morning, set the final split, create the metric, start the experiment, **then** share the public link. Module waves and the kill switch use other flags and stay live all day | No, this only fixes an internal contradiction |
| D2 | **Run the experiment as two arms: `grid` vs `swipe`, 50/50, with `this_or_that` and `yes_no` at 0% in the experiment split.** All four views still ship and are shown in Stream B. With 100 visitors this can reach 50 per arm and give a real Flagsmith result. Depends on G3 | **Yes.** If you prefer four arms, change one line in `FLAGSMITH-SETUP.md` section 4, nothing in the code |
| D3 | Add a `creators` segment override = **on** for every module flag. Seed script runs as a creator | No |
| D4 | Live and Stats pages show the **actual** split only, plus a link to the flag in Flagsmith. No admin key on the server | Yes, minor. Alternative costs one secret in Railway |
| D5 | A session belongs to **one module**. The tester starts it from a module card. No queue table: the next set is computed (TRD 4.2) | No |
| D6 | The browser reads the experiment flag once when the tester taps Start (this records the exposure), and sends the layout with `POST /api/sessions`. The API validates it against the enum and stores it. Resume returns the stored layout. The server never evaluates the experiment flag | No |
| D7 | Live status: `finished` = `completed_at` set. `voting` = not finished and seen in the last 2 min. `dropped` = not finished and not seen for 2 min | No |
| D8 | R2 bucket is public-read behind one domain. Options are content meant for the public anyway. Uploads stay presigned | No |
| D9 | Tests run on in-memory Postgres (pglite) with Flagsmith and auth injected as fakes through an app factory. Details in `TEST-CASES.md` | No |

## 4. Feasibility of the 2-day build

Scope is 14 routes, 4 voting views, 1 API with 16 endpoints, 7 tables. With one lead and four parallel agents on a contract-first split this fits in two days, with these conditions:

1. The shared contract (zod schemas, DB schema, app factory) is written first, alone, and frozen. Everything else is parallel.
2. All Day 0 gates are green, so no agent time goes to infrastructure on build days.
3. The cut order from SCOPE section 7 is applied without discussion at 6 PM on 27 Nov: `yes_no`, then reel captions and visuals, then Stats charts, then creator delete.
4. Seed content (20+ sets per live module) is collected before 26 Nov. It is content work, not code.

## 5. Top risks after this review

| Risk | Likelihood | Impact | Owner action |
| --- | --- | --- | --- |
| Self-hosted experimentation fails on test day | Medium | High | G2 dry run; Cloud account created and tested as plan B |
| Fewer than 100 visitors, no Flagsmith result | High | Medium | D2; Stats page tells the story either way |
| Flagsmith or Neon cold start during the test | Medium | Medium | G6; cached flags and safe defaults in the app |
| Guest identity changes mid-test (cookie cleared) | Low | Low | Accepted, stated in the demo |
| Agents diverge from the contract | Medium | Medium | File ownership and stop-and-ask rules in `HANDOVER.md` |
