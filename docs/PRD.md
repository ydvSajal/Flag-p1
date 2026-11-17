# PickLab: Product Requirements (PRD) v2

Version 2, 16 Nov 2026. Replaces v1 (`docs/archive/PRD-v1.md`). Aligned with `SCOPE.md` and the decisions in `DUE-DILIGENCE.md` (D1-D9).
Companions: `TRD.md` (how), `FRONTEND.md` (screens), `FLAGSMITH-SETUP.md` (Flagsmith), `HANDOVER.md` (who builds what), `TEST-CASES.md`.

Event: Toggle Wars, Flagsmith Experimentation Hackathon (WeMakeDevs), Track 01 "Test Something Real". Build 26-27 Nov 2026, real visitors 28 Nov, submit 29 Nov before 8 PM IST.

---

## 1. Problem

Creators guess which thumbnail or caption will work. Asking friends is slow and biased, and feedback tools lose people halfway through.

## 2. Product

A creator posts a **set** of 2-4 options (images or texts) for an upcoming post. Anyone with the link votes as a **guest**, in a short **session** of 5 sets from one module. The creator sees which option people prefer.

Flagsmith is the control panel. Nothing a visitor sees is hard-coded:

| Stream | Controlled live from Flagsmith, no deploy |
| --- | --- |
| A. The product | Which modules exist, who gets them (waves, creators), their copy, and an emergency off switch |
| B. The voting view | Which of four views a visitor gets and in what share; force a view for one person |
| C. The test | The views run as a real experiment; the winner is rolled out to everyone through the same flag |

## 3. Goals and non-goals

Goals
1. Working product with Thumbnails and Captions live by end of 27 Nov.
2. Release modules in 3 waves with zero deploys.
3. Change the voting view split live and force a view for one identity.
4. Run one real experiment on `voting_layout` and say honestly what the data shows.
5. Roll the winner (or `grid`) to 100% and submit a demo video of 3 min or less.

Non-goals: payments, marketplace, AI suggestions, bot or fraud detection, native app, notifications, i18n, multi-org, chasing statistical significance.

## 4. Users

| User | Who | Need |
| --- | --- | --- |
| Visitor (tester) | Anyone with the link, mostly on a phone, no account | Vote in seconds |
| Creator | YouTuber, reels maker, designer; signs in with Google | Post options, see what people prefer |
| Admin | Our team; Google account on an allow-list | Watch who is on the site and what they got; control everything in Flagsmith |

## 5. Definitions

| Term | Meaning |
| --- | --- |
| Module | A content type: `thumbnails`, `captions`, `reel_captions`, `visuals`. Each has a flag |
| Set | One question with 2-4 options, all image or all text, in one module |
| View (layout) | How a visitor votes: `grid`, `swipe`, `this_or_that`, `yes_no` |
| Session | One visitor, one module, up to `sets_per_session` sets (default 5), one fixed view |
| Response | One signal on one option: `pick`, `yes` or `no` |
| Wave | Release group 1, 2 or 3, assigned in rotation on first visit, never shown to the visitor |

## 6. Vote model

| View | What the visitor does | Responses recorded for the set |
| --- | --- | --- |
| `grid` (control) | Sees all options, taps one, confirms | One `pick` |
| `swipe` | One card per option, right = like, left = pass, every card | One `yes` or `no` per option |
| `this_or_that` | Two options at a time; 3-4 options run as a knockout | One `pick` (the final winner) |
| `yes_no` | One option at a time, Yes / No buttons | One `yes` or `no` per option |

- Option score shown to creators: **(picks + yes) / visitors who finished the set**, as a percentage.
- A visitor finishes each set at most once, ever.
- The view is fixed for the whole session. A weight change in Flagsmith applies from the visitor's next session.
- Card and round order is shuffled per visitor and set, and is the same on resume.
- Primary experiment metric: **`session_completed`** (visitor finished every set of a session). It is the only event sent to Flagsmith. Time per set and responses per visitor come from our database.
- Known limits, stated in the demo: a guest who clears cookies is a new visitor; scores from swipe and yes/no are not strictly comparable with grid and this-or-that.

## 7. User stories

| ID | As a | I want | So that |
| --- | --- | --- | --- |
| US1 | Visitor | start voting from the link with no account | I start in seconds |
| US2 | Visitor | know I am part of a test and what is recorded | I can trust it |
| US3 | Visitor | see only the modules open for me | nothing is broken or empty |
| US4 | Visitor | vote in the view the app gives me, with progress | I know how much is left |
| US5 | Visitor | leave and come back to the same place | I do not start over |
| US6 | Visitor | see a new module appear without reloading | the app feels alive |
| US7 | Creator | post 2-4 images or texts as a set | people can choose |
| US8 | Creator | see a score per option and the number of voters | I know what to use |
| US9 | Admin | open a module for one wave | we release step by step |
| US10 | Admin | change module copy and session length without a deploy | fixes are instant |
| US11 | Admin | hide one module or pause all voting with one switch | visitors never get stuck |
| US12 | Admin | change the view split and force a view for myself | I can show live control |
| US13 | Admin | see every recent visitor, their wave, view and progress | I can prove Flagsmith is deciding |
| US14 | Admin | see completion and time per view | I can explain the result |
| US15 | Admin | run the experiment and roll out the winner | the product improves without a release |

## 8. Functional requirements

| ID | Requirement | Pri | Flagsmith |
| --- | --- | --- | --- |
| FR1 | First visit creates a persistent guest (httpOnly cookie, 1 year). The guest id is the Flagsmith identity | Must | Identity |
| FR2 | A wave (1-3) is assigned in rotation when the profile is created | Must | Trait `wave` |
| FR3 | One consent screen before the first vote; consent is stored | Must | No |
| FR4 | The app identifies the visitor with traits `role` and `wave` before reading any flag | Must | Yes |
| FR5 | Home lists only modules whose flag is on for this visitor, with title, instructions and sets left | Must | Module flags, segments |
| FR6 | Module title, instructions and `sets_per_session` come from the flag's JSON value | Must | Remote config |
| FR7 | Starting a session reads `voting_layout` once, records the exposure, and fixes the view for that session | Must | Experiment flag |
| FR8 | The voting screen renders `grid`, `swipe`, `this_or_that` or `yes_no`; an unknown value falls back to `grid` | Must | Yes |
| FR9 | Finishing a set saves its responses in one atomic, idempotent write with the view and the time taken | Must | No |
| FR10 | The API rejects responses that do not match the session's view (section 6) | Must | No |
| FR11 | The API refuses sessions and responses for a module that is off for that visitor, or when voting is disabled | Must | Yes |
| FR12 | Finishing the last set marks the session complete and sends `session_completed` once | Must | Metric |
| FR13 | An unfinished session resumes at the next unanswered set with the same view and order | Must | No |
| FR14 | Flags refresh every 15 s and on tab focus; module cards appear and disappear without reload | Must | Yes |
| FR15 | `voting_enabled` off shows the paused screen, including mid-session | Must | Kill switch |
| FR16 | Creator signs in with Google | Must | Trait `role` = creator |
| FR17 | Creator posts a set: module, title, 2-4 options (png/jpg/webp up to 5 MB each, or text) | Must | Module list from flags |
| FR18 | Creator sees own sets and, per set, score per option and voter count | Must | No |
| FR19 | Live page: visitors of the last hour with short id, wave, view, module, progress, status, last seen; refresh every 5 s | Must | Shows Flagsmith's decisions |
| FR20 | Stats page: per view, visitors, sessions started and completed, completion %, average time per set, actual split; links to Flagsmith | Must | Links |
| FR21 | Admin pages are visible only to allow-listed emails; everyone else gets 404 | Must | No |
| FR22 | An identity override on `voting_layout` changes the presenter's next session view within 15 s | Must | Identity override |
| FR23 | Reel captions and Visuals modules use the same screens | Should | Module flags |
| FR24 | Creator can delete own set (soft delete) | Should | No |
| FR25 | Anyone can delete their own data from the account page | Should | No |
| FR26 | Image zoom, theme or copy variations through remote config | Could | Remote config |

## 9. Non-functional requirements

| ID | Requirement |
| --- | --- |
| NFR1 | First meaningful screen under 2 s on a mid-range phone on 4G |
| NFR2 | Tap feedback under 100 ms; no spinner between sets (next set preloaded) |
| NFR3 | A finished set is never lost or double counted: client retries, server is idempotent |
| NFR4 | If Flagsmith is slow or down: cached flags, then safe defaults (`grid`, modules hidden, voting on) |
| NFR5 | No layout flicker: the voting screen shows a skeleton until the session is loaded |
| NFR6 | Mobile first from 360 px; current Chrome, Safari, Firefox; AA contrast; all voting actions keyboard operable; reduced motion respected |
| NFR7 | All four views have the same visual weight, copy and timing |
| NFR8 | Sized for 100 visitors, 10 concurrent: one small API instance |
| NFR9 | No secrets in the repo; Flagsmith default secrets changed; guests store no personal data |

## 10. Success criteria (same as SCOPE section 8)

1. Changing `voting_layout` weights changes what new visitors get, no deploy, visible on the Live page.
2. An identity override forces a view for the presenter within 15 s.
3. Opening a module for `wave_2` makes it appear for wave-2 visitors without reload; turning it off hides it and the API refuses votes.
4. `voting_enabled` off shows the paused screen.
5. All four views record responses; creators see per-option results.
6. The experiment ran, exposures are visible in Flagsmith, the winner (or `grid`) is at 100% at the end.
7. No secrets in the repo.
8. Demo video of 3 min or less.

Numbers that are **not** goals: visitor count, statistical significance.

## 11. Release plan

| When | Deliverable |
| --- | --- |
| By 22 Nov | Gates G1-G3: Discord answer, Railway Flagsmith dry run with a result |
| By 25 Nov | Gates G4-G6, accounts, UI design, 20+ seed sets per live module, people lined up |
| 26 Nov | Repo, contract, API, guest flow, modules from flags, `grid` + `swipe`, Live page |
| 27 Nov | `this_or_that` + `yes_no`, creator flow, Stats page, seed, deploy, QA. Evening: record Stream B on Production |
| 28 Nov | Morning: fix the split, create the metric, start the experiment, share the link. Day: waves 1, 2, 3 |
| 29 Nov | End the experiment, roll the winner to 100%, record, submit before 8 PM IST |

Cut order if late: `yes_no`, reel captions and visuals, Stats charts (keep the table), creator delete. Never cut: `grid` + `swipe`, Live page, percentage rollout, waves, kill switch, experiment, winner rollout.

## 12. Open decisions for the owner

1. D2: two-arm experiment (`grid` vs `swipe`) instead of four arms. Recommended.
2. D4: no configured-split display on admin pages. Recommended.
3. Product name and public domain.
4. Owners for Flagsmith, backend, frontend, demo.
5. WeMakeDevs submission fields.
