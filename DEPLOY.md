# Deploy Pitchline to Netlify (pitchline-app)

Site id: 3e40a3db-dedb-46d2-b8aa-00db29153dad
Admin: https://app.netlify.com/projects/pitchline-app
URL: https://pitchline-app.netlify.app

## Why Postgres

Netlify runs Next.js on serverless functions. A SQLite file (file:./dev.db) is not durable or writable there. Prisma provider is postgresql; migrations live under prisma/migrations/.

A backup of the old SQLite schema is kept at prisma/schema.sqlite.prisma for reference only (not used by the app).

## One-time: database

1. Create a Postgres instance (pick one):
   - Neon free: https://neon.tech — create project — copy connection string
   - Netlify Database / Prisma Postgres extension from the site Extensions panel
2. Copy the URL (must start with postgresql:// or postgres://). Prefer the pooled / serverless URL if Neon offers one.

## One-time: Netlify env vars

In Site settings, Environment variables (Production), set:

- DATABASE_URL — Postgres connection string
- AUTH_SECRET — long random string
- API_FOOTBALL_KEY — optional
- GEMINI_API_KEY — optional
- PITCHLINE_PLAN — base or intel

Do not commit .env. See .env.example.

## Build

See netlify.toml build.command: prisma generate, migrate deploy, then Next build. Node 20.

## Deploy after env is set

Confirm with netlify status that the linked project is pitchline-app.
Then ship via Git continuous deploy or Netlify UI Trigger deploy.
Parent agent sets env before first prod deploy.

## Local Air after the Postgres switch

1. Set DATABASE_URL in .env to a Postgres URL (Neon works for local).
2. Apply committed migrations against that URL (see Prisma migrate deploy docs).
3. Optional: seed the database with the project db:seed script.
4. Start the Next.js dev server as usual.

Until local .env uses Postgres, Prisma CLI and app DB calls reject file:./dev.db.

## Link check

If status is wrong, link site id 3e40a3db-dedb-46d2-b8aa-00db29153dad.
