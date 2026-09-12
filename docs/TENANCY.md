# Tenancy — match desks & notes

## Rule

Authenticated users only **list / open / create / mutate** match desks and notes owned by `session.userId`.

| Surface | Behaviour |
|--------|-----------|
| `GET /api/match-days` | `where: { userId: session.id }` |
| `POST /api/match-days` | Always sets `userId` to the signed-in user |
| `DELETE /api/match-days/[id]` | Owner only (403 if another user's desk) |
| Dashboard | Same owner filter |
| `/match-day/[id]/*` layout | `notFound` if `matchDay.userId !== session.id` |
| Notes API | Match must be owned; note mutate via ownership |
| Speaks mutate | Match / speak ownership checked |

OBS overlay routes stay session-light (Browser Source).

## Demo accounts

Seed login: `demo@pitchline.app` / `demo1234`.

Demo is a **normal owner userId** — not a cross-tenant ACL. Shared demo desks mean **shared demo login** (same `userId`). Personal accounts never see demo desks unless they are that user.

Prefer filtering by owner `userId` for everyone (including demo). Do not invent a shared-desk mode.

## Legacy `userId: null`

Old desks without an owner are **hidden** from lists and **inaccessible** via UI. Reassign in DB if recovery is needed:

```sql
UPDATE "MatchDay" SET "userId" = '<user-cuid>' WHERE id = '<match-day-id>';
```

## Helpers

See `lib/tenancy.ts` (`assertMatchOwned`, `findOwnedNote`, `matchDayOwnerWhere`, …).
