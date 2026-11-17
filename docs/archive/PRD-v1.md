# PickLab: Product Requirements (PRD)

> **Scope update (12 Nov):** `SCOPE.md` is the source of truth. Changes vs this PRD: four voting views (`grid`, `swipe`, `this_or_that`, `yes_no`) behind `voting_layout` with live percentage control; tester numbers are not a goal (50-100 people expected); a Live page shows every visitor and the view they got; responses replace single picks (section 6 of SCOPE). Sections below on 130+ testers and two arms are superseded.

Hackathon: Toggle Wars, Flagsmith Experimentation Hackathon (WeMakeDevs), Track 01 "Test Something Real". Online 26-29 Nov 2026. Submission closes 8 PM IST, 29 Nov.
Companion docs: `TRD.md` (architecture), `FLAGSMITH-SETUP.md` (hosting and Flagsmith config), `FRONTEND.md` (pages for UI design).

---

## 1. Problem

Creators guess which thumbnail or caption will work. Feedback tools lose testers halfway through. PickLab collects quick picks from real testers, and runs a real experiment to find which voting layout gets the most feedback finished.

## 2. Product in one paragraph

A creator uploads a **set** of 2-4 options (images or text). Testers open the link and vote **as guests, no sign-up**, in a short **session** of 5 sets, picking a favourite in each. Which modules a tester sees is controlled by Flagsmith in release **waves**. How the tester votes (grid or swipe) is controlled by the `voting_layout` experiment. Creators sign in with Google and see how many picks each option got.

**Why guests:** sign-up loses people, so testers get a persistent anonymous id (the Flagsmith docs recommend this for logged-out visitors). Four views (grid, swipe, this-or-that, yes/no) are controlled from Flagsmith with live percentage weights; see `SCOPE.md`.

## 3. Goals and non-goals

Goals
1. Working app with thumbnails and captions modules live by end of 27 Nov.
2. Release modules to testers in 3 waves using only Flagsmith, zero deploys.
3. Control the voting view live from Flagsmith (percentages, overrides), run one real `voting_layout` experiment with the 50-100 people available, and explain what the data can and cannot say.
4. Ship the winning layout to 100% through the same flag; record a 3-minute demo.

Non-goals: payments or payouts, creator marketplace, AI suggestions, bot/fraud detection, native mobile app, multi-org dashboards, public sharing of results.

## 4. Users

| User | Who | Need |
| --- | --- | --- |
| Creator | YouTuber, reels maker, designer | Post options, see which wins |
| Tester | Anyone with a link, mostly on a phone | Vote fast, feel it is worth the time |
| Admin | Our team | Release waves, kill a module, run and read the experiment |

## 5. User stories

| ID | As a | I want | So that |
| --- | --- | --- | --- |
| US1 | Creator | upload 2-4 images or texts as one set | testers can pick |
| US2 | Creator | see picks per option and total voters | I know what to use |
| US3 | Tester | start voting from the link with no account | I start in seconds |
| US4 | Tester | vote on a set using the layout the app gives me | feedback takes seconds |
| US5 | Tester | finish a short session and see progress | I know how much is left |
| US6 | Tester | see new modules appear when they open for me | the app feels alive |
| US7 | Tester | know I am part of a test and what is recorded | I can trust it |
| US8 | Admin | open a module for one wave | we release step by step |
| US9 | Admin | change module title/instructions without deploy | copy fixes are instant |
| US10 | Admin | hide a broken module or pause all voting with one switch | testers never get stuck |
| US11 | Admin | see layout counts and who is in which wave | I can sanity-check the experiment |
| US12 | Admin | see which layout wins and how sure we are | we decide with data |
| US13 | Admin | roll the winner out to everyone | the product improves without a release |

## 6. Vote model (decision, please confirm)

The old plan said "finish a set = vote on every option". A one-tap set would nearly always complete, so there would be nothing to measure. New model:

- A **vote** = the tester picks **one favourite** option in a set.
- A **session** = a queue of **5 sets** (value comes from Flagsmith remote config `sets_per_session`, default 5).
- Primary metric: `session_completed` (tester finished all 5 sets), the only event sent to Flagsmith. Votes per tester and time per vote are reported from our own database.
- A layout that is slow or confusing makes testers quit before set 5 and loses.
- Layout behaviour: **Grid** (control) shows all options as tiles, tap one, confirm. **Swipe** shows one card at a time: swipe right to pick (ends the set), swipe left to drop; the last remaining card is auto-picked. **Pairs** (stretch, see section 2) shows two options at a time in a knockout.
- The tester keeps the same layout for every set (deterministic bucketing on identity).
- Known limits to state in the demo: a guest who clears cookies or switches device counts as a new tester; swipe shows options in sequence, so its picks can favour early cards (randomise card order per tester).

This needs at least **20 seeded sets** per live module so every tester can get 5 unvoted sets.

## 7. Functional requirements

| ID | Requirement | Priority | Flagsmith |
| --- | --- | --- | --- |
| FR1 | Tester gets a persistent guest id on first visit (no account). Creators and admins sign in with Google | Must | Identity = user id (guest or account) |
| FR2 | Send traits `role` and `wave` to Flagsmith when identifying | Must | Yes |
| FR3 | Creator uploads a set of 2-4 images or texts for a module | Must | No |
| FR4 | Home lists only modules whose flag is on for this tester | Must | Module flags |
| FR5 | Module title, instructions and `sets_per_session` come from remote config | Must | Remote config |
| FR6 | Voting screen renders layout from `voting_layout` | Must | Experiment |
| FR7 | Vote is saved by the API (idempotent), with layout and time taken | Must | No |
| FR8 | Finishing the 5th set tracks `session_completed` | Must | Primary metric |
| FR9 | Creator sees picks per option and voter count | Must | No |
| FR10 | API refuses votes/queues for modules that are off for that tester (server-side check) | Must | Yes |
| FR11 | `voting_enabled` off shows a "voting paused" screen within one page load | Should | Kill switch |
| FR12 | Reel captions and visuals reuse the same set model | Should | Module flags |
| FR13 | Admin page: layout counts, wave counts, link to Flagsmith experiment | Should | Link |
| FR14 | Consent screen explaining the test before first vote | Must | No |
| FR15 | Creator can delete their own set | Should | No |

## 8. Non-functional requirements ("smooth")

- First meaningful screen under 2 s on a mid phone on 4G; voting interaction feedback under 100 ms.
- Next set's images preloaded while the tester votes on the current one; no spinner between sets.
- A vote never gets lost or double-counted: client retries, server is idempotent.
- Flag read failure must not break the app: cached flags, safe defaults (`grid`, modules hidden, voting paused only if explicitly off).
- No layout flicker: voting screen waits for flags before rendering any layout.
- Mobile-first, works on current Chrome, Safari, Firefox; keyboard and screen-reader basics.
- Capacity: designed for about 100 testers and 5 concurrent; a single small API instance is enough.

## 9. Success metrics

| Metric | Target |
| --- | --- |
| Visitors | 50-100 (not a goal in itself) |
| Views live and switchable from Flagsmith | 4 |
| Weight change visible to new visitors | without deploy, within 15 s |
| Module waves released via Flagsmith | 3, with 0 deploys |
| Experiment result | chance to beat control + 95% credible interval, explained; ship above 95% |
| Winner shipped | Winner at 100% before the video |
| Data match | Neon vote counts per layout match Flagsmith exposure counts within a few % |

## 10. Release plan

| When | Deliverable |
| --- | --- |
| Before 26 Nov | Flagsmith running locally and on Railway, dry-run experiment done, testers lined up, Discord questions asked |
| 26 Nov | Monorepo, guest id + creator sign-in, sets/variants, grid layout, flags + segments + waves |
| 27 Nov | Swipe layout, events, metric + experiment started, creator upload + results, seeded sets, deploy |
| 28 Nov | Wave 1 -> 2 -> 3 with testers, watch results |
| 29 Nov | End experiment, ship winner, record demo, submit before 8 PM IST |

## 11. Risks

| Risk | Mitigation |
| --- | --- |
| Under 50 people per view: Flagsmith experiment stays on "Collecting data" | Expected and accepted; show exposures plus our own Stats page per view; optional final grid-vs-one-view run |
| Experimentation beta / self-host behaviour unknown | Day 0 full dry run on Railway; Cloud account as plan B |
| Flag locks on start | Finish and test all 3 layouts before creating the experiment |
| Results refresh every 5 min | Record the results page for the demo |
| Neon/Railway cold start during test | Pin versions, keep Flagsmith DB awake if plan allows, health checks, cached flags |
| Too few sets so testers run out | Seed 20+ sets per live module |
| Everyone completes (no difference) | 5-set session makes quitting possible; also report Count of votes |

## 12. Open decisions

1. Confirm the vote model in section 6, the two-layout experiment and guest voting (section 2).
2. Can one team enter two tracks? (Flagsmith Discord)
3. Is recruiting testers before 26 Nov allowed?
4. What does the WeMakeDevs submission ask for (repo, video, write-up)?
5. Product name/domain for the public link.
