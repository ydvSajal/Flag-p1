# PickLab: Test cases

Spec under test: `PRD.md` v2, `TRD.md` v2. Task mapping: `HANDOVER.md` section 5.

## 1. Strategy

| Level | Prefix | How | Runs where | Count |
| --- | --- | --- | --- | --- |
| Unit | U | vitest on pure functions in `packages/shared/src/rules.ts` | `pnpm test`, no infrastructure | 12 |
| API | A | vitest against `createApp(deps)` with pglite, fake flags, fake auth, fake storage, fake clock | `pnpm test`, no infrastructure | 59 |
| Scripts | S | Run the script, check the database | Local stack | 4 |
| Web | E | Manual checklist, phone width and desktop | Local stack | 36 |
| Flagsmith | F | Manual, in the Flagsmith dashboard with the app open | Local, then Production | 15 |
| Acceptance | X | Manual end to end; X-02..X-08 equal SCOPE section 8 | Production | 11 |

No browser automation framework: 36 manual checks cost about 40 minutes per pass, and a framework costs more than that to set up in a two-day build.

Test harness (`apps/api/test/helpers.ts`, written in T0)
- `makeApp(overrides?)` returns `{ app, db, flags, clock, storage }` with a fresh pglite database and migrations applied.
- `flags.set(userId | '*', { modules: { thumbnails: { enabled, config } }, votingEnabled })`, and `flags.fail()` to simulate an outage.
- `as(user)` adds the header the fake `getUser` reads. `makeUser({ role, wave, consented, email })`, `makeSet({ module, kind, options, creator })`.
- `clock.advance(ms)`.

Rule: a test asserts behaviour through HTTP and, where the case says so, one database read. No test reaches into a route's internals.

## 2. Unit tests (`rules.test.ts`)

| ID | Function | Case | Expect |
| --- | --- | --- | --- |
| U-01 | `validateResponses` | `grid`, one `pick` on a variant of the set | ok |
| U-02 | `validateResponses` | `grid` with zero, or two responses, or signal `yes` | error |
| U-03 | `validateResponses` | `this_or_that`, one `pick` | ok |
| U-04 | `validateResponses` | `swipe`, one `yes`/`no` for every variant | ok; all `no` is also ok |
| U-05 | `validateResponses` | `swipe` or `yes_no` missing one variant, or a duplicate variant, or a `pick` | error |
| U-06 | `validateResponses` | Any layout, a `variantId` from another set | error |
| U-07 | `seededShuffle` | Same seed twice | Same order |
| U-08 | `seededShuffle` | 4 items, 200 different seeds | Every item appears in first position at least 20 times; output is always a permutation |
| U-09 | `knockoutRounds` | 2, 3 and 4 options | 1, 2 and 3 rounds; exactly one winner; every option appears at least once |
| U-10 | `optionScores` | 10 finishers, option A: 3 `pick` + 2 `yes`, option B: 5 `no` | A = 0.5, B = 0; zero finishers gives 0, not NaN |
| U-11 | `liveStatus` | completed; last seen 30 s ago; last seen 121 s ago | `finished`; `voting`; `dropped` |
| U-12 | `parseModuleConfig` | Valid JSON; invalid JSON; missing field; `sets_per_session` of 0 or 99 | Parsed; defaults; defaults for that field; clamped to 1..20 |

## 3. API tests

### Identity and consent (`me.test.ts`, task A1)

| ID | Case | Expect |
| --- | --- | --- |
| A-01 | `GET /me` with no session | 200, new anonymous user, `role` tester, `consented` false, cookie set |
| A-02 | `GET /me` again with that cookie | Same `id` and `wave`; still one user row |
| A-03 | Six new guests in sequence | Waves 1,2,3,1,2,3 |
| A-04 | `POST /me/consent` | `consented` true on the next `GET /me`; calling twice keeps the first timestamp |
| A-05 | Signed-in Google user, email in `ADMIN_EMAILS` | `isAdmin` true, `role` creator |
| A-06 | Signed-in Google user, email not in the list | `isAdmin` false |
| A-07 | Guest who then signs in with Google | Same user `id` and `wave` as before; `role` becomes creator |

### Modules (`modules.test.ts`, task A2)

| ID | Case | Expect |
| --- | --- | --- |
| A-08 | Thumbnails on, captions off for this user | Only thumbnails in `modules` |
| A-09 | Flag value JSON has title, instructions, `sets_per_session` 3 | Those values returned |
| A-10 | Flag value is invalid JSON | Module still listed with defaults (name, empty instructions, 5) |
| A-11 | Module has 4 active sets, user finished 1, 1 set is deleted, 1 set was created by the user | `setsLeft` = 2 |
| A-12 | `voting_enabled` off | 200 with `votingEnabled` false |
| A-13 | Flags queried twice within 10 s, then after 11 s | Fake Flagsmith called once, then a second time |
| A-14 | `flags.fail()` with nothing cached; then with a cached value | Empty `modules` and `votingEnabled` true; cached modules returned |

### Sessions (`sessions.test.ts`, task A3)

| ID | Case | Expect |
| --- | --- | --- |
| A-15 | Consented user, module on, 8 sets, config 5, layout `swipe` | 201, `targetCount` 5, `doneCount` 0, `layout` swipe, `resumed` false |
| A-16 | Only 3 sets left | `targetCount` 3 |
| A-17 | No sets left | 409 `no_sets_left` |
| A-18 | No consent | 403 `consent_required` |
| A-19 | Module off for this user | 403 `module_off` |
| A-20 | `voting_enabled` off | 503 `voting_paused` |
| A-21 | `layout` = `carousel` | 400 `invalid_body` |
| A-22 | Open session exists, second `POST` with a different layout | Same `id`, original layout, `resumed` true |
| A-23 | Previous session completed, new `POST` | New `id`, new layout accepted |
| A-24 | `GET /sessions/:id/next` | Up to 2 sets, each with 2-4 variants; no set the user finished; no deleted set; no set of another module |
| A-25 | `next` called twice without voting | Identical sets and identical variant order |
| A-26 | Two different users, same module | Variant order or set order differs for at least one set (fixed seeds) |
| A-27 | `next` or `GET /sessions/:id` by another user | 404 |
| A-28 | `next` | `sessions.last_seen_at` equals the fake clock |

### Set results (`set-results.test.ts`, task A3)

| ID | Case | Expect |
| --- | --- | --- |
| A-29 | Valid `grid` result | 200, `doneCount` 1, `sessionComplete` false; 1 `set_results` row, 1 `responses` row |
| A-30 | Valid `swipe` result for a 4-option set | 4 `responses` rows |
| A-31 | Same request sent twice (same `id`) | Both 200 with the same body; still 1 row |
| A-32 | Different `id`, same user and set | 200, no new rows, `doneCount` unchanged |
| A-33 | Responses do not fit the layout (`grid` with two picks; `yes_no` missing an option; variant from another set) | 400 `invalid_responses`, nothing written |
| A-34 | Last set of the session | `sessionComplete` true, `completed_at` set; a further result for that session is 409 `session_closed` |
| A-34a | Session of another user | 404 |
| A-34b | Module turned off after the session started (clock past the cache) | 403 `module_off`, nothing written |
| A-34c | `voting_enabled` turned off mid-session | 503 `voting_paused`, nothing written |
| A-34d | `durationMs` negative or above 600000 | 400 `invalid_body` |
| A-34e | Database error on the `responses` insert (inject) | No `set_results` row remains (transaction rolled back) |

### Uploads and sets (`uploads.test.ts`, `sets.test.ts`, task A5)

| ID | Case | Expect |
| --- | --- | --- |
| A-35 | Creator signs 3 png files of 1 MB | 3 keys starting with `u/<userId>/`, 3 URLs |
| A-36 | Guest calls sign | 403 `forbidden` |
| A-37 | `image/gif`; 6 MB file; 5 files | 415; 413; 400 |
| A-38 | Create image set with 3 uploaded keys | 201; 3 variants, positions 0-2 |
| A-39 | Create text set with 2 texts | 201 |
| A-40 | 1 option; 5 options; mixed image and text; empty title; text of 281 chars | 400 `invalid_body` each |
| A-41 | Image key that does not exist in storage, or with another user's prefix | 400, nothing written |
| A-42 | Module off for creators | 403 `module_off` |
| A-43 | `GET /sets/mine` | Only the caller's active sets, newest first, with voter counts |
| A-44 | `GET /sets/:id/results` after 4 finishers (2 grid picks on A, 1 swipe yes on A and no on B, 1 swipe yes on both) | `voters` 4; A `positive` 4, `score` 1.0; B `positive` 1, `score` 0.25. Another creator gets 404. Admin gets `byLayout` |

### Admin (`admin.test.ts`, tasks A4, A6)

| ID | Case | Expect |
| --- | --- | --- |
| A-45 | `GET /admin/live` as guest or non-admin creator | 404 |
| A-46 | Three visitors: one finished, one seen 30 s ago, one seen 5 min ago | Statuses `finished`, `voting`, `dropped`; newest first |
| A-47 | A visitor last seen 61 min ago | Not listed |
| A-48 | Live response | `shortId` is 6 chars; no email, no full id; `split` counts match the sessions |
| A-49 | `GET /admin/overview` with 2 grid sessions (1 completed) and 2 swipe (2 completed) | grid `completionRate` 0.5, swipe 1.0; `avgDurationMs` is the mean of `duration_ms` per layout |
| A-50 | Overview with no data | Zeros, no NaN, no 500 |
| A-51 | 61 set results from one user inside a minute | 61st is 429 `rate_limited`; allowed again after the clock advances 60 s |
| A-52 | `DELETE /sets/:id` by owner | 204; gone from `/sets/mine` and from visitors' `next`; results still readable by an admin |
| A-53 | `DELETE /sets/:id` by another creator | 404 |
| A-54 | `DELETE /me` | 204; no profile, sessions, set results or responses remain for that user; a creator's sets are soft-deleted |

## 4. Script tests

| ID | Task | Case | Expect |
| --- | --- | --- | --- |
| S-01 | O2 | `pnpm seed` on an empty database | 20+ active sets per live module, images reachable at their public URL |
| S-02 | O2 | `pnpm seed` again | No new rows |
| S-03 | O3 | `pnpm simulate --visitors 40 --dropoff 0.3` | About 40 identities in Flagsmith with exposures on `voting_layout`; sessions in the database across all configured views; roughly 30% not completed |
| S-04 | O3 | After S-03 | `session_completed` count in Flagsmith is within 5% of completed sessions in the database |

## 5. Web checklist (manual, 360 px and desktop)

### Visitor

| ID | Check |
| --- | --- |
| E-01 | Landing fits one screen; Start voting goes to consent; Post options goes to login |
| E-02 | Consent shows once per device; Got it lands on home; a returning visitor skips landing and consent |
| E-03 | Home shows only open modules, with title and instructions from Flagsmith and sets left |
| E-04 | No module open: "Your group opens soon". No sets left: "No sets left, come back soon" |
| E-05 | A module opened in Flagsmith appears within 15 s without reload, with a "New" badge; a module turned off disappears |
| E-06 | Start shows a skeleton, then the view; no flash of another view |
| E-07 | Progress shows "Set n of N"; N equals `sets_per_session` |
| E-08 | Image options keep their aspect ratio; text options are readable cards; tap targets are at least 44 px |
| E-09 | Grid: tap selects, tap another changes, Confirm is disabled until a selection |
| E-10 | Swipe: drag right and left work; buttons work; the set ends only after every card; order differs between two visitors |
| E-11 | This-or-that, 2 options: one round |
| E-12 | This-or-that, 3 and 4 options: knockout with "Round x of y"; the final winner is recorded |
| E-13 | Yes/No: buttons only, no card motion, auto-advance after each answer |
| E-14 | After the last set: done page with Another session (only if sets are left) and Back home |
| E-15 | Close (X) asks to confirm; leaving and returning shows Continue and resumes at the same set with the same view and order |
| E-16 | Reload in the middle of a set: same set, same view |
| E-17 | Two tabs on the same session: finishing a set in one does not double count in the other |
| E-18 | Reduced motion on: swipe has no slide animation and buttons work |
| E-19 | No spinner between sets on a throttled "Fast 4G" connection (next set preloaded) |
| E-20 | Offline for one vote, then online: the vote is saved once; the retry toast shows only if retries fail |
| E-21 | Double tap on Confirm or a fast double swipe: one result |
| E-22 | Keyboard: arrows and Enter (grid, this-or-that), left/right (swipe), Y/N (yes/no); focus ring visible |
| E-23 | Screen reader announces "Pick saved, set n of N"; option images have alt text |
| E-24 | `voting_enabled` off while on home or mid-session: paused page within 15 s; Retry returns when it is back on |
| E-25 | 404 and error pages render; `/admin` as a guest shows 404 |

### Creator and admin

| ID | Check |
| --- | --- |
| E-26 | Google sign-in works; cancel returns to login with a message |
| E-27 | Live page: a new visitor appears within 5 s with wave, view badge, module, progress, status; the pause toggle stops refresh; readable in a screen recording |
| E-28 | New set: only modules open to creators are offered |
| E-29 | Image set: add 2-4 files, preview, remove; Publish is disabled under 2 options |
| E-30 | A 30 MB file and a gif are rejected with a clear message; a 4000 px photo, including one over 5 MB, is resized to 1600 px before upload and accepted (the 5 MB limit applies to the resized file on the server, the original may be up to 25 MB) |
| E-31 | Text set: character count, limit enforced |
| E-32 | Publish goes to the results page; the set appears in My sets and in a visitor's session |
| E-33 | Results: bars ranked by score, winner highlighted, voter count, note under 10 voters |
| E-34 | No votes yet: waiting state; another creator's set URL: 404 |
| E-35 | Stats page: one row per view with visitors, started, completed, completion %, average time; numbers match a manual SQL count |
| E-36 | Links on the Stats page open the flag, the experiment and the identities pages in Flagsmith |

## 6. Flagsmith checks (manual)

| ID | Stream | Action in Flagsmith | Expect in the app |
| --- | --- | --- | --- |
| F-01 | A | Fresh project, run `scripts/flagsmith-setup.sh` | 6 flags, 3 keyed variations on `voting_layout`, 4 segments, `creators` override on every module flag |
| F-02 | A | Segment override `wave_1` on for `module_thumbnails` | Wave-1 visitor sees it within 15 s; wave-2 visitor does not |
| F-03 | A | Edit the module's JSON title | New title within 15 s, no deploy |
| F-04 | A | Turn `module_captions` off while a visitor is mid-session in it | Card disappears; next set result is refused within 10 s; the visitor lands on home with a message, not an error page |
| F-05 | A | `voting_enabled` off, then on | Paused page, then normal |
| F-06 | B | Weights: `swipe` 100% | Every new session is swipe |
| F-07 | B | Weights: 25% each, 40 simulated visitors | All four views appear on the Live page, roughly even |
| F-08 | B | Change weights while a visitor is mid-session | Their current session keeps its view; their next session may differ |
| F-09 | B | Identity override on the presenter's id to `this_or_that` | Presenter's next session is this-or-that within 15 s |
| F-10 | B | Add an unknown variation key | App renders `grid` |
| F-11 | C | Create metric `session_completed` (Occurrence), start experiment, 120 simulated visitors | Exposures per variation in Flagsmith; conversions counted; a result or *Collecting data* per the 50-identity rule |
| F-12 | C | End the experiment, set the winner to 100% | Every new session gets the winner; flag is unlocked |
| F-13 | C | Same visitor, cookies kept: reloads, closes and reopens the tab, and starts 3 sessions | Same Flagsmith identity every time (one row in Identities); same variation unless weights changed (D11a) |
| F-14 | C | Experiment running, 40 simulated visitors | Exposures on both arms, roughly per the 50/50 weights; none on `this_or_that` or `yes_no` (D11d) |
| F-15 | C | Same 40 visitors, 30% drop off | Conversions rise with completed sessions; `session_completed` identity equals the exposure identity; each completed session counts once (D11b) |

Also check once (failure list in `FLAGSMITH-SETUP.md` section 6): stop Flagsmith entirely, and the app still loads with cached flags, or with `grid` and no modules on a first visit.

## 7. Acceptance (Production)

| ID | Check | Source |
| --- | --- | --- |
| X-01 | Day 1 exit: guest consents, sees allowed modules, finishes a session in `grid` or `swipe` by flag, appears on the Live page | HANDOVER |
| X-02 | Weight change (swipe 10% to 50%) changes what new visitors get, no deploy, visible on the Live page | SCOPE 8.1 |
| X-03 | Identity override forces the presenter's view within 15 s | SCOPE 8.2 |
| X-04 | Opening a module for `wave_2` shows it to wave-2 visitors without reload; off hides it and the API refuses votes | SCOPE 8.3 |
| X-05 | `voting_enabled` off shows the paused screen | SCOPE 8.4 |
| X-06 | All four views record responses; a creator sees per-option results | SCOPE 8.5 |
| X-07 | Experiment ran, exposures visible, winner (or `grid`) at 100% | SCOPE 8.6 |
| X-08 | No secrets: `git grep` for key patterns is clean; `.env*` ignored; Flagsmith default secrets changed; Flagsmith sign-up closed | SCOPE 8.7 |
| X-09 | Database visitors per view are within 5% of Flagsmith exposures per variation; F-13..F-15 pass on Production before the experiment starts | PRD, D11 |
| X-10 | Experiment design written down before it starts: metric `session_completed`, guardrail average time per vote, traffic target 50+ per arm | D10 |
| X-11 | Demo video drafted by the night of 28 Nov; nothing recorded in the last hour before submit | D12 |

## 8. Performance and safety spot checks (once, before 28 Nov)

| Check | Pass |
| --- | --- |
| Lighthouse mobile on landing and home | First contentful paint under 2 s |
| `pnpm simulate --visitors 100` in 5 minutes against Production | No 5xx; API p95 under 300 ms in the logs |
| Tap to visual feedback on a mid-range phone | Feels instant (under 100 ms) |
| Text option containing `<script>alert(1)</script>` | Rendered as text |
| `curl` a set result with another visitor's session id | 404 |
| Browser devtools: change the `wave` trait, start a session in a closed module | UI may show the card; API returns 403 `module_off` |
