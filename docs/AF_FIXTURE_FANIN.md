# AF fixture fan-in (live sync)

## Goal

One live upstream pull per **API-Football fixture id**, shared across every
CoComms desk (and OBS overlay) watching that fixture — do **not** burn daily
quota with duplicate polls per desk / tab.

## Where it lives

| Layer | Behaviour |
| --- | --- |
| HTTP (`lib/api-football.ts`) | In-process GET cache + in-flight dedupe keyed by URL (`AF_LIVE_TTL_MS` ≈ 25s) for fixture / events / statistics / players. |
| Sync writer (`lib/sync-fixture.ts` → `syncMatchFromApiFootball`) | **Live** mode coalesces on `af:{fixtureId}`. Concurrent polls await the leader. After the leader finishes, **sibling** Match rows with the same `apiFootballFixtureId` get a cache-warm apply (`fromFanIn`). |
| Freshness gate | If *this* match’s `lastFeedSyncAt` is within `AF_LIVE_TTL_MS`, live sync returns `skipped: true` / `skipReason: "fixture-fan-in-fresh"` (multi-tab safe). |
| Full Sync | Still keyed per `match:{matchId}` so enrich (squads, injuries, predictions, last XI) is not fan-in’d. |

## Call path

Desk / overlay / prep banner → `POST /api/matches/:id/sync` `{ mode: "live" }` →
`syncMatchFromApiFootball` → shared AF GETs → Prisma writes for that Match
(+ async sibling applies).

Pre-kickoff cron (`lib/pre-kickoff-hard-sync.ts`) uses **full** mode and is
unchanged (per match, once).

## What fan-in is **not**

- Not a cross-region distributed lock (Netlify serverless instances do not share
  memory). Cross-instance protection is the HTTP TTL cache when warm, plus
  `lastFeedSyncAt` freshness when the same instance handles follow-up polls.
- Not a substitute for raising the AF plan limit — see usage alert
  (`lib/af-usage.ts`, Settings → Integrations).

## Desk impact

Live desk polling intervals stay as-is (≈45s Live/HT). Responses may include
`fanIn: true` or a fresh skip; score / events still come from `match` when
present. Do not slow or break the desk to wait on siblings.
