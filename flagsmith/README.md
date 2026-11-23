# Flagsmith (local dev)

Local Flagsmith for building PickLab. Not reachable by testers; Railway runs the real instance.

Start (from this folder, needs Docker with Compose v2):

    docker compose up -d

- Dashboard and API: http://localhost:8000 (create the admin user on first visit)
- Task processor: http://localhost:8001

Keys (in the dashboard, per environment):
- Client-side environment key (shown in the environment settings): copy to `NEXT_PUBLIC_FLAGSMITH_ENV_KEY`.
- Server-side key (create one in the environment's server-side keys section): copy to `FLAGSMITH_SERVER_KEY`.
- The CLI setup prompt in `docs/FLAGSMITH-SETUP.md` section 3 writes the org API key to `flagsmith/flagsmith.env` (keep it out of git).

Put both in the repo-root `.env` (never commit it). Also set `NEXT_PUBLIC_FLAGSMITH_API=http://localhost:8000/api/v1/` and `NEXT_PUBLIC_FLAGSMITH_EVENTS_URL=http://localhost:8000/api/`.

Stop (keeps data):

    docker compose down

Wipe everything (deletes the Postgres volume, all flags and events):

    docker compose down -v

Before any deploy: change `DJANGO_SECRET_KEY`, `WAREHOUSE_CREDENTIALS_SECRET` and the Postgres password in `docker-compose.yml`. The compose file currently uses placeholder values.
