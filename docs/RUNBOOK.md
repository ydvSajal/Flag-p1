# PickLab: Runbook for 27-29 Nov

Everything here was exercised locally unless marked **(unverified)**. Flagsmith details: `docs/FLAGSMITH-SETUP.md` section 7. Decisions: `docs/DUE-DILIGENCE.md` D1-D12.

## Before 27 Nov (needs you)

1. Ask in the Flagsmith Discord whether Track 01 accepts self-hosted (G1). If no, use Flagsmith Cloud: change `NEXT_PUBLIC_FLAGSMITH_API`, `NEXT_PUBLIC_FLAGSMITH_EVENTS_URL`, `FLAGSMITH_API_URL` and the keys, nothing else. **(unverified: the setup script and experiment script were only run against the local self-hosted build; Cloud endpoints may differ)**
2. Create accounts and fill the real values from `.env.example`: Neon (two databases), Railway, Vercel, Cloudflare R2 (bucket plus CORS allowing PUT from the web origin, public read domain), Google OAuth (redirect URI `https://<web-origin>/api/auth/callback/google`). Do not commit them.
3. Deploy Flagsmith on Railway (`FLAGSMITH-SETUP.md` section 3) and do a dry run of section 7.3 there (G2). Change `DJANGO_SECRET_KEY` and `WAREHOUSE_CREDENTIALS_SECRET`, set `DJANGO_ALLOWED_HOSTS`, close sign-up.
4. Set `ALLOW_DEV_LOGIN` unset and `NEXT_PUBLIC_DEV_LOGIN` unset in production. The API refuses to start in production without `BETTER_AUTH_SECRET`.

## 27 Nov: deploy, then record Stream B (D1)

1. Configure Flagsmith (idempotent, safe to re-run):
   `set -a; . flagsmith/flagsmith.env; set +a; pnpm flagsmith:setup` (needs `FLAGSMITH_API_TOKEN`, `FLAGSMITH_PROJECT_ID`, `FLAGSMITH_API_URL`; target environment via `FLAGSMITH_ENVIRONMENT`, default Development, use `Production` for the real run).
2. Migrate and seed: `pnpm db:migrate`, then `API_URL=<api origin> pnpm seed` (about 5 minutes: uploads are rate limited to 20 per minute; needs `ALLOW_DEV_LOGIN=1` on the API during seeding only, or seed against a private instance and copy the database).
3. Check on Production: wave release, kill switch, identity override, weights, as in `TEST-CASES.md` X-02..X-06.
4. **Record Stream B before any experiment exists.** Weights: edit `voting_layout` in the dashboard. To force a view for the presenter, create an identity override that also sets the variation weight to 100% on the wanted variation (a plain value override does nothing; see FLAGSMITH-SETUP 7.5). Remove the override afterwards.
5. Note: changing weights through the API needs `PUT`, not `PATCH` (7.2). The dashboard is fine.

## 28 Nov morning: start the experiment (D1, D2, D10)

1. Decide the final split now. Do not create the experiment earlier: **creating it changes the flag at once** (default weights go to 0 and 50/50 is served immediately) while exposures only count from start.
2. `pnpm flagsmith:experiment --real --yes` creates warehouse connection (type `postgres`, source `flagsmith_database`), metric `session_completed` (Occurrence, higher is better) and experiment `voting_layout_v1` (grid 50 / swipe 50, this_or_that and yes_no at 0). It does not start it.
3. Start it in the dashboard, or `POST /api/v1/environments/<client key>/experiments/<id>/start/`.
4. Share the public link only after it is running. Target at least 50 identities per arm, 130+ recruited (D10).
5. Open waves: add `wave_2` and `wave_3` segment overrides on the module flags as the day goes (the dashboard, or copy the pattern in `scripts/flagsmith-setup.ts`).

## 28 Nov evening: record the demo (D12)

Record Streams A and C from live data. The video is about a quarter of the score and cannot be recorded in the last hour before submitting. Show: the problem (15 s), the working product, the Flagsmith side (delete-Flagsmith test), Stats per view, the experiment with its credible interval, and say plainly if the interval still spans zero.

## 29 Nov: end, roll out, submit before 8 PM IST

1. Refresh results (once per 5 minutes), read the credible interval. Ship `swipe` at 100% only if Flagsmith shows it winning; otherwise keep `grid` and say inconclusive.
2. End the experiment (it unlocks the flag), set the winner to 100%.
3. Re-shoot only the last 20 seconds, then submit well before the deadline.

## If something breaks

- No exposures: the SDK only records one while the experiment is running and the flags came from the server; the identity must be set before the flag is read.
- Flat conversions: `session_completed` must use the same identity as the exposure and fire when the last set is saved.
- A flag change seems ignored: the API caches 10 s, the browser refreshes every 15 s.
- Weights change but nothing moves: you used `PATCH`; use `PUT` (script) or the dashboard.
- A probe or test left events behind in Flagsmith: there is no delete API; use a fresh Flagsmith database for the real run if you want clean numbers.
