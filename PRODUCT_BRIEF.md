# Pitchline — product brief

Affordable commentary prep & live desk for football commentators.
Brand: Pitchline. Demo login: demo@pitchline.app / demo1234

## Plans (business model)

**Base (Matchday) ~£12–15/mo** — default. BYO research is the product core.
- BYO Notebook / Research paste (local organise — no Gemini)
- News **RSS only**
- Diet AF live sync
- Notes buckets, relevance heuristics (no Gemini re-rank)
- OBS overlay, dossiers, Stats, Speaks, Print, etc.

**Intel add-on ~£6–8/mo** (+£7 shown on Pricing; ~£22 total)
- News Gemini web brief
- Auto Gen pack (`pack-generate`)
- Player note-draft
- Optional Gemini relevant re-rank
- Soft caps later: ~20 briefs / 10 pack gens per month (copy only until metering)

Env: `PITCHLINE_PLAN=base|intel` (default **base**). Settings → Plan has a Chris testing
toggle (`data/plan-override.json`). A `GEMINI_API_KEY` alone does **not** unlock Intel
features on Base. Stripe scaffold only — not live yet.

## Goals
Core commentary workflows with strong UX, live desk, mobile and automation.

## Stack
Next.js App Router, TypeScript, Tailwind, shadcn-style UI, Prisma + SQLite, seed data.

## Screens
Auth, Dashboard, Match Day (pitch + widgets), Speaks, Prep, Injuries, Scorers/Keepers,
Penalties, Venue, Clubs, Weather, Fans, Live event composer, Print/Export, Settings,
Pricing, Feedback.

## Product principles
Clear Go Live, always-available event composer, mobile pitchside mode, no overflow
modals, export that works, AI-assist templates, data freshness labels.
BYO research is the default; Gemini is Intel.

## Demo data
Fictional league/teams/players only for demos. No third-party commentary-desk assets.
