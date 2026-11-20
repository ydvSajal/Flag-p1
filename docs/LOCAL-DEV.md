# PickLab: Local dev mode (assumptions for the 21 Nov build)

Written by the lead during the unattended build. Goal: the whole product runs on one laptop with **no external accounts**: no Neon, no Flagsmith, no Google, no R2. Every external service has a local stand-in, chosen **only when its env vars are empty**. With the env vars set, the real service is used and nothing else changes.

| Concern | Real (env set) | Local stand-in (env empty) |
| --- | --- | --- |
| Database | `DATABASE_URL` -> `pg` pool (Neon) | PGlite persisted in `apps/api/.data/pglite`. Migrations run on API start |
| Server flags | `FLAGSMITH_SERVER_KEY` -> `@flagsmith/nodejs` remote evaluation | `apps/api/local-flags.json`: every module on with JSON config, `voting_enabled` on. Re-read on each cache miss (10 s), so editing the file acts like a dashboard change |
| Browser flags | `NEXT_PUBLIC_FLAGSMITH_ENV_KEY` -> `@flagsmith/flagsmith` | No SDK. Layout = `?layout=<view>` query param on Home (stored in localStorage), else `NEXT_PUBLIC_DEV_LAYOUT`, else `grid`. `trackEvent` is a no-op that logs nothing |
| Guests | Signed cookie `pl_guest=<uuid>.<hmac>` (TRD 4.3 fallback, used in both modes because gate G5 is untested) | Same |
| Creators / admins | Google via Better Auth when `GOOGLE_CLIENT_ID` is set | `POST /api/auth/dev-login { email }`, enabled only when `NODE_ENV !== 'production'` and `ALLOW_DEV_LOGIN=1`. Upgrades the current guest to creator, keeps the same id (A-07). Admin = email in `ADMIN_EMAILS` |
| Images | R2 presigned PUT + public read | `PUT /api/uploads/local/<key>` writes to `apps/api/.data/uploads`, `GET` serves it. Enabled only when R2 vars are empty |
| Secrets | `BETTER_AUTH_SECRET` | Dev default secret, only when `NODE_ENV !== 'production'`; the API refuses to start in production without it |

Ports: web `http://localhost:3000`, API `http://localhost:3001`. Web rewrites `/api/*` to `API_ORIGIN` (default `http://localhost:3001`).

Run: `pnpm install && pnpm dev`, then `pnpm seed` once. Open `http://localhost:3000`.

Deviation note: TRD 4.3 says the signed-cookie guest is a fallback for G5. We use it from the start because nobody could run the G5 spike unattended, and every route depends only on `getUser`, so switching to the Better Auth anonymous plugin later touches `auth.ts` only.
