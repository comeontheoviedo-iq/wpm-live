# Pitchline

Prep + live desk.

Quick start: copy env example, install, db reset, dev.

Demo login on login page.

## Env

See .env.example for DATABASE_URL, AUTH_SECRET, and optional integration vars.
Empty optional vars degrade gracefully with clear UI banners.
Never commit .env or *.db.

## DB

npm run db:reset once after pull (Note/Pack/feed schema).

## Fixture link

Add Match Desk import, or Prep paste fixture id then sync. Live polls while on air.

## Packs

Generate Research, Intro, Profiles, Referee, Lineup, Hooks. Saves to Scripts/Notes.
Unofficial broadcast house rules; country top-flight labels.

## Routes

Desk, Scripts, Packs, Prep, Notes, Live, /match-day/new. Speaks redirects to Scripts.
