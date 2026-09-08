# Deploy Pitchline to Netlify (pitchline-app)

Site id: 3e40a3db-dedb-46d2-b8aa-00db29153dad
Admin: https://app.netlify.com/projects/pitchline-app
URL: https://pitchline-app.netlify.app

## Why Postgres

Netlify runs Next.js on serverless. SQLite is not durable. Prisma provider is postgresql; migrations under prisma/migrations/.

## Database: @netlify/database

Depends on @netlify/database. Deploy auto-provisions Postgres and injects NETLIFY_DB_URL.
Prisma reads DATABASE_URL. Build and lib/prisma.ts fall back: prefer DATABASE_URL else NETLIFY_DB_URL.
Keep Prisma migrations under prisma/migrations/. Do not switch ORM to Drizzle.
If first build fails missing NETLIFY_DB_URL, redeploy after provision or set DATABASE_URL manually.

## One-time: Netlify env vars

Set AUTH_SECRET (long random). Optional API_FOOTBALL_KEY, GEMINI_API_KEY. PITCHLINE_PLAN=base or intel.
DATABASE_URL optional if using Netlify Database. Never commit .env. See .env.example.

## Build

netlify.toml exports DATABASE_URL from NETLIFY_DB_URL fallback, then prisma generate, migrate deploy, Next build. Node 22.

## Deploy after env is set

Confirm with netlify status that the linked project is pitchline-app.
Then: npx netlify deploy --build --prod

## Local Air after the Postgres switch

1. Set DATABASE_URL in .env to a Postgres URL (Neon works for local).
2. Apply migrations: npx prisma migrate deploy
3. Optional: npm run db:seed
4. Start Next.js as usual.

## Link check

If status is wrong, link site id 3e40a3db-dedb-46d2-b8aa-00db29153dad.

## Netlify-applied SQL migrations

Netlify Database applies SQL under netlify/database/migrations/ with privileges that allow CREATE on public (Prisma migrate deploy against NETLIFY_DB_URL hits permission denied on PG15+).
Initial schema is mirrored from prisma/migrations into that folder. Keep editing Prisma schema/migrations as source of truth, then copy new SQL into netlify/database/migrations for deploys. Build runs prisma generate only.
