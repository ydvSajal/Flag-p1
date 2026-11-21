# Deploy

Web = Vercel. API = any Node host (Railway). The API is a long-running Hono server, not serverless.

## 1. API (Railway)
- New service from this repo. Root `/`, install `pnpm install`, start `pnpm --filter @picklab/api start`.
- Env: see `.env.example` "API" block. Set `DATABASE_URL` (Neon), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (= web origin),
  Google + R2 keys, `FLAGSMITH_*`, `ADMIN_EMAILS`. Do NOT set `ALLOW_DEV_LOGIN`.
- Run once: `pnpm db:migrate`.

## 2. Web (Vercel)
- Import repo. **Root Directory: `apps/web`**. Framework: Next.js. Node 22.
- Env: `API_ORIGIN` (Railway URL), `NEXT_PUBLIC_FLAGSMITH_ENV_KEY`, `NEXT_PUBLIC_FLAGSMITH_API`, `NEXT_PUBLIC_FLAGSMITH_EVENTS_URL`.
- Do NOT set `NEXT_PUBLIC_DEV_LOGIN`.
- `/api/*` is rewritten to `API_ORIGIN`, so the browser sees one origin.

## 3. After deploy
Google OAuth redirect: `https://<web-origin>/api/auth/callback/google`. R2 CORS: allow PUT from the web origin.
Full sequence: `docs/RUNBOOK.md`.
