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
