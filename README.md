# Pitchline

Football commentary **prep + live desk** web app. Teal/green branded, mobile-first matchday workspace with speaks, pitch board, injuries, scorers, keepers, penalties, venue, weather, fans, live event composer, and print/export.

## Quick start

```bash
cd /workspace/pitchline
bun install
bun run db:push
bun run db:seed
bun run dev
```

Package manager alternatives work the same via the scripts in package.json (`install`, `db:push`, `db:seed`, `dev`).

Open http://localhost:3000

### Demo login

- **Email:** demo@pitchline.app
- **Password:** demo1234

## Scripts

| Script | Purpose |
|--------|---------|
| `dev` | Next.js dev server (Turbopack) |
| `build` / `start` | Production build and serve |
| `db:push` | Sync Prisma schema to SQLite |
| `db:seed` | Seed Northern Premier Demo League |
| `db:reset` | Wipe DB, push schema, re-seed |
| `postinstall` | prisma generate |

## Stack

- Next.js 15 App Router + TypeScript + Tailwind CSS 4
- Prisma + SQLite
- Cookie session auth (JWT via jose + bcryptjs)
- Local AI commentary templates (no external sports/LLM APIs)

## Main routes

- `/login` — credentials auth
- `/dashboard` — match days and upcoming fixtures
- `/match-day/[id]` — pitch overview + widgets
- Subroutes: speaks, prep, injuries, scorers, keepers, penalties, venue, clubs, weather, fans, live, print
- `/settings` — profile, appearance, templates
- `/pricing` — mock plans

## Prep to Live flow

Status pipeline: **Assigned → Preparation → Ready → Live → Full Time**

Use **Go Live** when Ready. Live event composer shortcuts: G/Y/R/S/C/V/H/F plus template commentary suggestions.

## Notes

- All league/club/player data is fictional.
- No third-party sports APIs.
- SQLite file: `prisma/dev.db` (via `DATABASE_URL` in `.env`).
