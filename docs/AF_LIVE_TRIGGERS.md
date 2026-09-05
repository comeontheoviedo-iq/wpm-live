# AF live data → LIVE commentary triggers

Honest inventory of what sync/poll already gets from API-Football, and what
Pitchline flashes from it. Never name third-party advanced feeds in the UI.

## Already synced on poll (`lib/sync-fixture.ts`)

### MatchEvent types (from AF `/fixtures/events`)

Mapped via `mapEventType`:

| AF type/detail | Desk type |
| --- | --- |
| Goal | `goal` |
| Goal + penalty | `penalty_goal` |
| Goal + own | `own_goal` |
| Missed penalty | `penalty_miss` |
| Card yellow | `yellow` |
| Card red | `red` |
| subst | `sub` |
| VAR | `var` |
| other | raw lowercased type |

Fields stored: minute, description, teamSide, playerId (local), apiFootballEventId.

### Team Statistic labels (from AF `/fixtures/statistics`)

Persisted as `Statistic` rows (label / homeValue / awayValue). Typical Premier League set:

- Ball Possession
- Total Shots / Shots on Goal / Shots off Goal / Blocked Shots
- Shots insidebox / Shots outsidebox
- Corner Kicks, Offsides, Fouls, Free Kicks
- Goalkeeper Saves
- Total passes / Passes accurate
- Yellow Cards / Red Cards

**Not present on free-plan NUFC–Bournemouth FT sample:** `expected_goals`, any
“momentum” / “pressure” label.

### Per-player live stats (from AF `/fixtures/players`)

Fetched on sync when fixture is linked (ephemeral `livePlayerStats` on sync JSON —
not a Prisma model). Fields we use:

| AF path | Trigger use |
| --- | --- |
| `passes.key` | “Key passes ≥ 3” (chances-created **proxy** — AF does not label “chances created”) |
| `shots.on` | Shots on target ≥ 3 |
| `duels.won` | Duels won ≥ 6 (configurable) |
| `tackles.total` | Tackles ≥ 4 |
| `dribbles.success` | Successful dribbles ≥ 3 |
| `goals.saves` | Saves ≥ 3 |
| `fouls.committed` | Fouls ≥ 4 |
| `goals.total` / `assists` | Context lines only |

Also available but not threshold-flashed yet: blocks, interceptions, rating,
cards, penalty won/scored.

## Triggers implemented

See `lib/live-stat-triggers.ts` + `lib/game-state-notes.ts`.

1. Player threshold flashes (popup once per crossing per player/match)
2. Momentum proxy (possession swing / shot differential) — not AF momentum
3. Game-state → desk note surfacing (early/late goal/concede, cards, HT/FT, etc.)

## AF does **not** provide live (on this plan / sample)

- Named “momentum” / “pressure” index
- Per-player or team xG on `/fixtures/statistics` (often Pro-only `expected_goals`)
- Literal “chances created” (use key passes)
- Live shot coordinates (advanced feed only — UI never names the source)
- Guaranteed real-time player stats mid-match (AF updates lag; FT is reliable)

## How Chris sees them on desk

- Stacked **live intel popups** (goal / sub / fact) top-right on Match desk
- Threshold + momentum → `fact` popups; optional data-viz when shots/poss/xG exist
- Matching prep notes → **Relevant now** filter + `Note:` lines inside popups via `enrichFlashLines`
