# CoComms (Pitchline) — product brief

Affordable commentary prep & live desk for football commentators.
Brand: CoComms (Pitchline rebrand). Demo login: demo@pitchline.app / demo1234

## Plans (business model)

**Unlimited (Basic) £22/mo** — single commercial plan at launch. BYO Notebook is the product core.
- BYO Notebook / Research paste (local organise — no Gemini required)
- News RSS
- Live-feed sync
- Notes buckets, relevance heuristics
- OBS overlay, dossiers, Stats, Speaks, Print
- Unlimited match desks on your account

**Intel is not a separate paid tier at launch.** Gemini brief / Auto Gen / note-draft remain behind an internal AI lab gate (`PITCHLINE_PLAN=base|intel` + Settings testing toggle) for Chris — not sold as Intel+.

Stripe: Checkout/portal for Unlimited when `STRIPE_SECRET_KEY` + `STRIPE_PRICE_UNLIMITED` exist; otherwise app-side plan model + Pricing copy + TODO for keys.

## Tenancy

Personal accounts: match desks and notes are locked to `session.userId`. See `docs/TENANCY.md`.

## Goals
Core commentary workflows with strong UX, live desk, mobile and automation.

## Stack
Next.js App Router, TypeScript, Tailwind, Prisma + Postgres (Netlify), seed data.

## Screens
Auth, Dashboard, Match Day (pitch + widgets), Speaks, Prep, Injuries, Scorers/Keepers,
Penalties, Venue, Clubs, Weather, Fans, Live event composer, Print/Export, Settings,
Pricing, Feedback.

## Product principles
Clear Go Live, always-available event composer, mobile pitchside mode, no overflow
modals, export that works, AI-assist templates, data freshness labels.
BYO research is the default; Gemini is lab-gated, not a separate SKU.
