# Shared intel opt-in (CoComms)

Account-level preference so commentators can **optionally** contribute anonymised note signals to a CoComms shared intelligence pool. Matches Privacy FAQ tone: co-pilot language, never forced.

## Defaults

| Rule | Behaviour |
|------|-----------|
| Default | **OFF** (`User.sharedIntelOptIn = false`) |
| Personal desks / notes | Always locked to `session.userId` (see `docs/TENANCY.md`) — opt-in does **not** open cross-tenant access |
| External send | **None in this pass** — preference + UI + stubs only |

## What is shared when ON (stub)

When opted in, a future background job may contribute **anonymised aggregates** only, for example:

- Coarse category / entity-type counts (no free text)
- Scrubbed signal tags that cannot identify the commentator or match prep wording

Exact schema TBD. Current code: `lib/shared-intel.ts` (`enqueueAnonymisedNoteSignal`, `runSharedIntelPoolTick`) — **TODO stubs that do not send data anywhere**.

## What never leaves

- Raw personal note **title** / **body**
- Desk contents, Scripts, Research paste, speaks
- Anything that identifies the signed-in account or a specific match desk

Unless and until an anonymisation pipeline ships **and** the user stays opted in, nothing from notes is exported.

## How to turn on / off

1. Sign in → **Settings → Profile**
2. Toggle **Shared CoComms intel** (off by default)
3. Saved via `PATCH /api/auth/me` `{ "sharedIntelOptIn": true | false }`
4. Read current value from `GET /api/auth/me` → `user.sharedIntelOptIn`

Turning **off** stops future contributions immediately (when a pipeline exists). Already-aggregated anonymised pool data is not reverse-linked to the account.

## API

| Method | Path | Fields |
|--------|------|--------|
| GET | `/api/auth/me` | `user.sharedIntelOptIn` (boolean) |
| PATCH | `/api/auth/me` | `{ sharedIntelOptIn?: boolean }` (also still accepts `preferredLocale`) |

## Schema

```prisma
sharedIntelOptIn Boolean @default(false)
```

Migrations: `prisma/migrations/20260912200000_user_shared_intel_opt_in` · Netlify mirror `netlify/database/migrations/20260912200000_user_shared_intel_opt_in.sql`.

## Related

- Public FAQ privacy answer (`/faq`)
- `docs/FAQ.md` · `docs/TENANCY.md`
