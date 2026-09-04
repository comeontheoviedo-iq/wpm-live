# Pitchline

Prep plus live desk for football commentators.

## Quick start

Copy env example, install dependencies, reset the database, start the dev server.

Demo login credentials are on the login page.

## Env

See the env example file for database URL, auth secret, and optional integration keys.
Exact key names matter. Restart the server after env edits.
Check GET /api/integrations for configured flags.

## Troubleshooting fixture search

Root cause on Free plans: league plus season queries for current seasons are rejected
with a message about Free plans not having access to this season (often try 2022 to 2024).
Date-only fixture search still works. Pitchline defaults to date-only then filters by league.
Upgrade to Pro for current season league plus season queries.
Use Add Match Desk Test connection to see plan name and Free-plan season hint.
Settings Integrations tab also shows badges and a Test connection button.

## DB

Reset the database once after pull.

## Fixture link

Add Match Desk import, or Prep paste fixture id then sync. Live polls while on air.

## Packs

Generate Research, Intro, Profiles, Referee, Lineup, Hooks.

## Routes

Desk, Scripts, Packs, Prep, Notes, Live, /match-day/new.
