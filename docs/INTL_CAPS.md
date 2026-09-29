# International desks — career caps

## Product rule (locked)

On an **international** desk (Nations League, World Cup, Euro, NT friendlies, etc.):

- Pitch **Season Appearances** → **total career international caps** (all comps **including friendlies**).
- Pitch **Season Goals / Assists** → **total career international** G/A including friendlies.
- Career card for **national-team stints** includes friendlies in apps/G/A.
- **Club desks unchanged** (season apps, friendlies excluded from season totals).

## Detection

`isInternationalCompetition({ name, country })` in `lib/season-tally.ts`:

- Named NT tournaments (World Cup, Nations League, Euro, AFCON, Copa América, …).
- Pure `Friendlies` (not `Friendlies Clubs`).
- Explicitly **excludes** club-world comps (UCL / UEL / UECL / Club World Cup / Libertadores…).

## Live +1 (same spirit as locked club APP rule)

- Prematch: show career caps **so far** (this match not counted). Official XI ≠ appearance.
- Once **LIVE** (or HT/FT path via `liveAdjustedSeasonStat`) **and** the player is/was **on** for this match (`matchApps > 0`): show **caps+1**.
- Implemented with existing `liveAdjustedSeasonStat(..., { forceExcludeToday: true })` on pitch cards.

## UI labels (intl desks)

| Field | Club desk | International desk |
|-------|-----------|--------------------|
| APP   | APP (season apps) | **CAPS** (career caps) |
| S GOL | S GOL | **CAPS G** |
| S AST | S AST | **CAPS A** |

Dossier: Apps → **Caps**; season total hint → `international · incl. friendlies`.


## Sync failure modes (and fixes)

1. **Team-page pagination** — AF returns 20 players/page. Intl desks must
   walk all pages (`teamStatPageLimit`). A page≤4 cap missed **Rayan**
   (Brazil 2026 page 5 → 7 caps / 2 goals) and prior-only page≤2 missed
   **Irankunda** 2025 friendlies (Australia page 3).
2. **Wrong AF player id / name collision** — profile search can hit a
   empty shell id (e.g. 404754) while lineups use the real id (407806).
   Prefer lineup / `/players?team=` ids; career tallies filter by NT
   `teamAfId`.
3. **Friendlies filtered** — club desks exclude friendlies; intl career
   uses `includeFriendlies: true`.
4. **AF incomplete** — some players have lineup entries but no
   `/players?id=&season=` NT rows. Sync cannot invent caps.

## Manual override (when AF is incomplete)

On the desk, PATCH match overrides with career totals and lock sync:

```http
PATCH /api/matches/{matchId}/overrides
Content-Type: application/json

{
  "playerId": "<prisma Player id>",
  "careerApps": 7,
  "careerGoals": 2,
  "careerAssists": 0,
  "lockFromFeed": true
}
```

That writes `Player.appearances` / `goals` / `assists` and sets
`lockFromFeed` so the next fixture sync will not overwrite those stats.
Clear with `"lockFromFeed": false` (and omit career* fields) when AF
catches up and you want feed totals again.
