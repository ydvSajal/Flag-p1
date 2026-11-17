# PickLab: Project scope (source of truth)

If another doc disagrees with this one, this one wins.

Event: Toggle Wars, Flagsmith Experimentation Hackathon, Track 01. Build in 2 days (26-27 Nov), let real people use it (28 Nov), ship and submit 29 Nov before 8 PM IST. Expected audience: 50-100 people. **Focus is the product and how Flagsmith drives it, not the numbers.**

---

## 1. What PickLab is

A social testing platform for creators. A creator posts creatives for an upcoming social post (thumbnails, images, captions, reel captions) as a set of 2-4 options. Anyone with the link opens the site and picks what they like. The creator sees which option people prefer.

## 2. What Flagsmith does (the point of the project)

Flagsmith is the control panel of the product. Nothing about *what a visitor sees* is hard-coded:

| Stream | What we control from Flagsmith, live, no deploy | Flagsmith feature |
| --- | --- | --- |
| **A. The product** | Which content modules exist (thumbnails, captions, reel captions, visuals), who gets them (waves, creators), their titles and instructions, and an emergency off switch | Boolean flags, segments, segment overrides, remote config (JSON), kill switch |
| **B. The voting view** | Which voting view each visitor gets (**grid, swipe, this-or-that (left/right), yes/no**) and in what share: 100% grid, or 10% swipe, or 50/50, or 25% each. Force a view for one person (for demos) | Multivariate flag with percentage weights, identity overrides, segment overrides |
| **C. The test** | Run the views as a real A/B test, see exposures and results, end it, roll the winner out to everyone | Flagsmith Experimentation: experiment, metric, exposures, results, rollout |

Demo story: "I open Flagsmith, change swipe from 10% to 50%, and new visitors start getting swipe. I open the captions module for wave 2 and it appears on their screens. I kill a module and it disappears. Then the same flag runs as an experiment, and I ship the winning view to 100%."

## 3. In scope

**Product (Must)**
- Guest visitors: open link -> one consent screen -> voting. No sign-up. Persistent guest id (also the Flagsmith identity).
- Home with the modules Flagsmith allows for that visitor.
- Voting session of 5 sets (count from remote config).
- **Four voting views** behind one flag `voting_layout`:
  - `grid` (control): all options as tiles, tap one.
  - `swipe`: card stack, swipe right = like, left = pass, one card per option.
  - `this_or_that`: two options side by side, pick left or right; 3-4 options run as a quick knockout.
  - `yes_no`: one option at a time with Yes / No buttons.
- Session complete screen, paused screen.
- Creator: Google sign-in, post a set (2-4 images or texts), my sets, results per option.
- Modules: Thumbnails (image) and Captions (text). Reel captions and Visuals are Should (same screen).

**Flagsmith control (Must)**
- 6 flags: `module_thumbnails`, `module_captions`, `module_reel_captions`, `module_visuals` (boolean + JSON config), `voting_layout` (multivariate, 4 views), `voting_enabled` (kill switch).
- Segments: `wave_1`, `wave_2`, `wave_3`, `creators`. Wave release by segment overrides.
- Live updates: the app re-checks flags every 15 s (`startListening`) and on tab focus, so changes show without reload. A visitor keeps the view for the session they are in; the new view applies from their next session.
- Identity override to force a view for yourself during the demo.
- Experiment `voting_layout_v1` on `voting_layout`, metric `session_completed` (Occurrence), end + roll out winner.

**Visibility (Must): "who is opening the site and what did they get"**
- **Live page** (`/admin/live`, team only): every visitor in the last hour with short id, wave, assigned view, module, progress (e.g. 3/5), finished or dropped, time. Updates every 5 s.
- **Stats page** (`/admin`): visitors and sessions per view, completion % per view, average time per vote per view, the current split vs the split set in Flagsmith, links to the Flagsmith flag, experiment and identities pages.
- Flagsmith's own Identities page and Exposures panel show the same people from Flagsmith's side.

**Infra (Must)**
- Next.js on Vercel, Hono API on Railway, Neon Postgres, R2 images, self-hosted Flagsmith (Docker locally, same image on Railway with its own Neon DB). Details: `TRD.md`, `FLAGSMITH-SETUP.md`.

**Could**
- Theme or copy variations via remote config, image zoom, set deletion, account page.

## 4. Out of scope

Payments, marketplace, AI suggestions, bot/fraud detection, native app, notifications, i18n, ClickHouse/Kafka, Flagsmith Cloud (plan B only), chasing statistical significance.

## 5. About the numbers (kept honest, not the focus)

- Flagsmith shows an experiment result only after **50 identities per view**. With 50-100 visitors over 4 views it will most likely show *Collecting data*. That is fine: the demo shows the experiment set up, exposures arriving, and our own Stats page per view.
- If you want a real Flagsmith verdict anyway: on the last day, run the experiment with only `grid` vs the best-looking view. Optional.
- Changing view weights while the experiment runs moves some people between views (Flagsmith quarantines them). So: play with percentages **before** starting the experiment, then keep the split fixed while it runs.

## 6. Data captured per vote

One `responses` row per signal: visitor, set, option, view, signal (`pick` for grid/this-or-that winner, `yes`/`no` for swipe and yes/no), time taken. Creator results show for each option "chosen by X% of people who saw it", which works the same across all four views.

## 7. Two-day build plan

Prep (now to 25 Nov): Flagsmith running locally and on Railway with a dry-run experiment; accounts (Railway, Neon, Vercel, R2, Google OAuth); UI design from `FRONTEND.md`; 20+ seed sets per module; 50-100 people lined up.

| Day | Build | Done when |
| --- | --- | --- |
| 26 Nov | Monorepo, API, DB, guest id, modules from flags, sessions + responses, `grid` + `swipe`, Live page | A guest finishes a session in grid or swipe depending on the flag, and appears on the Live page |
| 27 Nov | `this_or_that` + `yes_no`, creator post + results, Stats page, waves + kill switch, seed data, deploy, QA all 4 views, create metric + start experiment in the evening | Changing weights in Flagsmith changes what new visitors get; all 4 views record responses |
| 28 Nov | People use it; open waves; play live with percentages early, then lock the split for the experiment | Visitors on all views, responses flowing |
| 29 Nov | End experiment, roll winner (or grid) to 100%, record demo, submit | Video submitted |

Cut order if late: `yes_no` view, reel captions/visuals, Stats page charts (keep the table), creator delete. Never cut: grid + swipe, Live page, percentage rollout, waves, kill switch, experiment, winner rollout.

## 8. Done when

1. Changing `voting_layout` weights in Flagsmith (e.g. swipe 10% -> 50%) changes what new visitors get, with no deploy, and the Live page shows it.
2. An identity override forces a chosen view for the presenter within 15 s.
3. Opening a module for `wave_2` makes it appear for wave-2 visitors without reload; turning it off hides it and the API refuses votes for it.
4. `voting_enabled` off shows the paused screen.
5. All four views record comparable responses; creators see per-option results.
6. The experiment ran, exposures are visible in Flagsmith, the winner (or grid) is served at 100% at the end.
7. No secrets in the repo; Flagsmith default secrets changed.
8. Demo video of 3 min or less: problem, product, Stream A, Stream B, Stream C, what we learned.

## 9. Demo video outline (about 3 min)

1. Problem (15 s): creators guess which thumbnail or caption works.
2. Product (30 s): visitor opens the link, votes in a view; creator sees results.
3. Stream B (45 s): Flagsmith, change view split 10% -> 50% swipe, Live page shows new visitors on swipe; identity override forces this-or-that for the presenter.
4. Stream A (30 s): open captions for wave 2, it appears; kill switch.
5. Stream C (45 s): experiment, exposures, Stats page completion per view, end experiment, roll winner to 100%.
6. Learnings (15 s): what the data could and could not say.

## 10. Open items

- Product name and domain.
- Who owns which part (Flagsmith, backend, frontend, design/demo).
- Flagsmith Discord: does Track 01 accept a self-hosted Flagsmith instance? (If not, switch to Cloud, nothing else changes.)
- WeMakeDevs submission fields.
