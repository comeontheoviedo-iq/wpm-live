# LIVE data-viz flash catalogue

Popups can attach a soft-fail chart card (`DataVizFlashCard`). Never invent numbers.
UI labels say **Advanced stats** — never name Understat / SportsPro / provider brands.

Builders: `lib/viz-build.ts`. Components: `components/match/data-viz-flash.tsx`.
Picker rotates kinds via `pickViz` + recent-kind dedupe so the same chart is not
always shown.

## Catalogue

| Kind | Needs | Typical trigger |
| --- | --- | --- |
| `shot_map` | Advanced stats shot points (x,y,xG,result) | Goal |
| `xg_race` | home/away xG totals | HT / goal fallback |
| `xg_timeline` | Shots **with minutes** + xG | HT / goal |
| `shot_outcome` | Shots with result labels (≥2 buckets) | HT |
| `xg_vs_goals` | xG + current score | Goal / HT |
| `possession` | ≥2 home-poss samples **or** Ball Possession row | Moment / momentum |
| `shots_compare` | AF Total Shots / Shots on Goal | Shot pressure / moment |
| `corners_fouls` | Corner Kicks + Fouls | Moment / fouls threshold |
| `pass_pct` | Total passes + Passes accurate | Moment |
| `match_dna` | ≥3 of poss / shots / SOT / corners / fouls | HT / FT preview |
| `leaderboard` | `livePlayerStats` from AF `/fixtures/players` | Threshold flashes |
| `gk_saves` | Player saves **or** Goalkeeper Saves team row | Saves threshold |
| `goal_timeline` | MatchEvent goals (minute + side) | Goal |
| `card_timeline` | Yellow/red events | Card popup |
| `momentum_proxy` | Sampled score+shots over polls (not AF “momentum”) | Moment / swing |

## How Chris sees them

1. Open Newcastle desk (`Full Time` OK).
2. Hit **Sync** — threshold facts fire from `livePlayerStats` + FT preview popup
   attaches `match_dna` (or next available) once per session.
3. Live: goals / HT / moments / cards / thresholds attach charts top-right in the
   intel popup stack. Pin to keep; auto-hide otherwise.
4. Variety: `recentVizKindsRef` skips recently shown kinds when another builds.

## Honest gaps

- **No invented xG.** Süper Lig / Scotland / UEFA often have no free advanced shot
  feed → shot map / xG race / timeline / outcome / xG-vs-goals soft-fail; AF team
  bars and event timelines still work.
- **AF free plan** usually has no `expected_goals` on `/fixtures/statistics` and no
  live momentum/pressure field — momentum chart is a **proxy** from possession /
  shot differential samples.
- **`livePlayerStats`** is ephemeral on sync JSON (not Prisma). Mid-match AF player
  stats can lag; FT is reliable. Leaderboard / GK bars need a successful players
  poll.
- **Possession sparkline** needs multiple distinct samples across polls; a single
  Sync on FT falls back to a dual possession bar when the Ball Possession row exists.
- **xG timeline** requires shot `minute` from the advanced feed; totals-only xG
  cannot draw a cumulative curve.
- Card/goal timelines need `teamSide` on events (synced from AF).
- Provider names never appear in UI copy.
