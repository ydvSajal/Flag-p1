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

## NOT verified (do these first)

1. **Nobody clicked through the UI in a browser.** The screenshot tool timed out twice. Pages return 200 and server-render correctly, and the API flow works over HTTP, but swipe drag, knockout, uploads from the browser, and mobile layout at 360 px are untested. Test cases E-01..E-36 are all still manual.
2. **Real Flagsmith is untested.** Browser SDK path (`FlagsProvider`, `getExperimentFlag`, `trackEvent`) and `@flagsmith/nodejs` were written against the installed `.d.ts` but never ran against a server. `scripts/flagsmith-setup.sh` has 9 `# verify:` lines (CLI flags unconfirmed). Gates G1, G2, G3 are still open.
3. **Google sign-in is untested** (no credentials). Dev login is what was exercised.
4. **R2 uploads are untested.** Local-disk uploads only.
5. Flagsmith dashboard link paths on the Stats page are guesses (`/features?search=`, `/experiments`, `/users`).

## Deviations from the docs (all intentional, all small)

- **No Better Auth.** Guests use a signed cookie `pl_guest` (the TRD 4.3 fallback), Google is a manual OAuth code flow with `fetch`. Same guest id is kept on sign-in (A-07). Reason: fewer moving parts and no gate G5 spike. Added `POST /api/auth/logout`.
- `@electric-sql/pglite` is a runtime dependency (local mode). `variant_sets.creator_id` is nullable, `on delete set null`, so `DELETE /me` can keep soft-deleted sets (A-54).
- Web admin and creator pages compute percentages client-side from counts.
- Seed data: reel captions and visuals have 10 sets each (target was 20+, S-01 warning). Thumbnails and captions have 24.
- Seeding takes about 5 minutes because uploads are rate-limited to 20 files per minute.
- TypeScript is pinned to 5.x, vitest to 3.x, eslint to 9.x.

## Open decisions for you

- Guardrail metric is "avg time per vote" (D10). Change it if you prefer another.
- Product name and domain, who owns Flagsmith, the Discord answer on self-hosting (README section 10).
- The experiment itself (metric, rollout) is created in the Flagsmith dashboard by a human.

## Suggested next steps

1. `pnpm install && pnpm dev && pnpm seed`, then click through every page at 360 px and desktop (TEST-CASES section 5).
2. Start local Flagsmith (`flagsmith/README.md`), run `scripts/flagsmith-setup.sh`, resolve the `# verify:` lines, then test F-01..F-15.
3. Copy `.env.example` values for real services, deploy (Vercel, Railway, Neon, R2) per TRD section 7.
4. Merge `t/T0` into `main` through a PR.
