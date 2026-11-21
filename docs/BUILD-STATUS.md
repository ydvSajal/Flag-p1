# PickLab: Build status (unattended build, 21 Nov 2026)

Branch `t/T0` holds everything merged. `main` is untouched. Nothing is pushed.

## What exists and works (verified locally)

| Part | State | Evidence |
| --- | --- | --- |
| `packages/shared` | Contract: constants, zod schemas, rules | U-01..U-12 pass (13 tests) |
| `apps/api` | All TRD 5 endpoints, local-mode stand-ins | A-01..A-54 pass (66 tests); live smoke test through the web `/api` proxy: guest, consent, creator set, session, set result, results, admin live/overview |
| `apps/web` visitor | Landing, consent, home, 4 voting views, done, paused | typecheck, lint, build; all pages 200 |
| `apps/web` creator/admin | Login, my sets, new set, results, Stats, Live, account | typecheck, lint, build; all pages 200 |
| `scripts` | `seed` (idempotent, PNG renderer), `simulate`, `flagsmith-setup.sh` (draft) | seed twice = 0 new sets; simulate 40 visitors, no 5xx |
| `flagsmith/` | Official docker-compose with dev header | Not started (no Docker run) |

Run it: see README section 7 ("Quickest start"). No external accounts needed.

## Verified in a real browser (21 Nov, DOM-driven, no screenshots)

Consent, home with live module counts, and full 5-set sessions in **all four views** (swipe buttons, grid radios + Confirm, this-or-that knockout with 2/3/4 options, yes/no), seeded PNGs load at 1280x720, done page. Dev login through the form, creator publish (captions), results page, admin Stats and Live with correct per-view numbers, and no horizontal overflow at 360 px on all 11 pages. One bug found and fixed: Next ignored the root .env (dev-login form was missing); `next.config.ts` now loads it.

## Design audit (measured in the browser, no screenshots)

Found and fixed one real bug: the home progress card had 1.1:1 text contrast in dark mode (`Card` could not be re-coloured because `cn()` does not resolve Tailwind conflicts; `Card` now drops its default background when the caller sets one). Now 16:1. Remaining minor item: footer links ("About this test", "Privacy") are 20 px tall; WCAG 2.5.8 minimum is 24 px. Other audited pages (voting views, home) had 44 px targets. Not audited: creator and admin pages in dark mode.

## NOT verified (do these first)

1. **Pixel-level look.** Screenshots time out in this browser session, so nobody has looked at the design. Check visual polish, swipe drag by finger/mouse, and the image upload flow from the creator form (file picker + browser resize). The API side of uploads is tested by the seed run.
2. **Real Flagsmith: mostly verified on a local self-hosted instance** (FLAGSMITH-SETUP 7.1-7.4): module access by wave and creator, kill switch 503, outage fallback, weight change reaching new visitors, SDK layout mapping, `pnpm flagsmith:setup` (REST, idempotent), and the **whole experiment pipeline** (warehouse, metric, experiment, SDK exposures and conversions, results with a verdict on a throwaway flag; weight 0 inside the split is accepted, so gate G3 passes). **Also verified in a real Chrome against real Flagsmith (FLAGSMITH-SETUP 7.5):** wave release appearing live in 13 s, live-flag layout, identity override. **Still untested:** the real `voting_layout_v1` experiment (deliberately not created). Gates G1 (does Track 01 allow self-hosted) and G2 (dry run on Railway) are still open.
3. **Google sign-in is untested** (no credentials). Dev login is what was exercised.
4. **R2 uploads are untested.** Local-disk uploads only.
5. Flagsmith dashboard link paths on the Stats page are guesses (`/features?search=`, `/experiments`, `/users`).

Local DB note: `apps/api/.data` (PGlite) was deleted during the Flagsmith checks, so the DB starts empty: run `pnpm seed` (about 5 minutes because of the upload rate limit).

## Deviations from the docs (all intentional, all small)

- **No Better Auth.** Guests use a signed cookie `pl_guest` (the TRD 4.3 fallback), Google is a manual OAuth code flow with `fetch`. Same guest id is kept on sign-in (A-07). Reason: fewer moving parts and no gate G5 spike. Added `POST /api/auth/logout`.
- `@electric-sql/pglite` is a runtime dependency (local mode). `variant_sets.creator_id` is nullable, `on delete set null`, so `DELETE /me` can keep soft-deleted sets (A-54).
- Web admin and creator pages compute percentages client-side from counts.
- Seed data: reel captions and visuals have 10 sets each (target was 20+, S-01 warning). Thumbnails and captions have 24.
- Seeding takes about 5 minutes because uploads are rate-limited to 20 files per minute.
- TypeScript is pinned to 5.x, vitest to 3.x, eslint to 9.x.

## Experiment runbook gotchas (found while testing, matter on 28 Nov)

- **Creating the experiment changes the flag immediately**, before it starts: the default weights go to 0 and the 50/50 split is served at once, but exposures count only from start. So create `voting_layout_v1` only when you are ready to start (D1), then start it right away. `pnpm flagsmith:experiment --real --yes` creates it (not started).
- **Self-hosted warehouse type must be `postgres` with source `flagsmith_database`**; type `flagsmith` cannot receive events here (events return 404).
- **Change weights through the API with PUT, not PATCH** (PATCH is silently ignored). In the dashboard it is a normal edit.
- The sample-ratio-mismatch warning did not appear at 120 identities; don't rely on it. The 50-identities-per-arm and 5-conversions rule is enforced server-side.
- A probe run left test events in the local Flagsmith DB (no delete API). Use a fresh instance (`docker compose ... down -v`) for the real run if you want clean numbers.

## Open decisions for you

- Guardrail metric is "avg time per vote" (D10). Change it if you prefer another.
- Product name and domain, who owns Flagsmith, the Discord answer on self-hosting (README section 10).
- The experiment itself (metric, rollout) is created in the Flagsmith dashboard by a human.

## Suggested next steps

1. `pnpm install && pnpm dev && pnpm seed`, then click through every page at 360 px and desktop (TEST-CASES section 5).
2. Start local Flagsmith (`flagsmith/README.md`), run `scripts/flagsmith-setup.sh`, resolve the `# verify:` lines, then test F-01..F-15.
3. Copy `.env.example` values for real services, deploy (Vercel, Railway, Neon, R2) per TRD section 7.
4. Merge `t/T0` into `main` through a PR.
