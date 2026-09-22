# Lineup Verify (FotMob / SofaScore)

Commentators compare CoComms XI to trusted public sources on the desk safeguards row.

## What Verify does

### Human Verify (unchanged)

- **Verify** opens **FotMob** and **SofaScore** search tabs for `Home vs Away YYYY-MM-DD` (Europe/London date).
- Shows **our side**: source badge (Official / Live / Predicted / Last XI), last sync time (Lon), starter counts, empty-slot warning.

### Silent FotMob auto-verify (prep/live only)

- CoComms **polls FotMob server-side** for matches on an **active commentary desk** (Assigned / Preparation / Ready / Live / Half Time). No commentator action.
- Poll cadence ~75s when kickoff is within ~3 hours (through shortly after KO). Soft-fail on 403/429 → badge `FotMob unavailable` (desk never crashes).
- Status badges:
  - `Matches FotMob`
  - `FotMob Official · ours Predicted`
  - `Mismatch`
  - `FotMob pending` (no sheet yet, or FotMob still `lastStarting11` / predicted)
  - `FotMob unavailable`
- Only desks that are prep/live are polled — **not** a global scrape.

### Apply FotMob XI (explicit click)

One-tap import of FotMob’s confirmed Official XI. The button appears **only** when **all** are true:

1. Desk is prep or live (active commentary desk)
2. Kickoff is within **T−30 … kickoff** (hidden after KO)
3. FotMob has **confirmed Official** XI (`lineupType=standard`, source often `enetpulse` — **not** `lastStarting11` / predicted)
4. Ours is missing Official **or** mismatches FotMob starters

Server re-checks the same gates on `POST /api/matches/:id/fotmob-apply`.

**AF remains the normal spine.** CoComms never auto-writes Official from FotMob — Apply is explicit user click only.

After Apply:

- Lineup stamped **Official** (`lineupStatus=confirmed`, `lineupSource=official`)
- `lineupSourceMeta` records `fotmobAppliedAt`, `fotmobMatchId`, `fotmobApplySource=fotmob`
- Feed freeze: `xiFeedFrozen=true` with reason `fotmob_apply` so the next pre-KO AF sync cannot `fallback_last_xi` wipe the board. **Unlock** / **Re-pull Official** clears freeze as usual.
- Player matching: fuzzy name (+ shirt when helpful) to existing AF-linked club players. Unmatched starters are returned in an **unmapped** list — we do **not** invent AF ids. Apply requires ≥9 mapped per side.

## APIs

- `GET /api/matches/:id/fotmob-verify` → `{ status, statusLabel, fotmobConfirmed, minutesToKickoff, canApply, diff, formations, fetchedAt, fotmobMatchId, error? }`
- `POST /api/matches/:id/fotmob-apply` → mapping report + freeze flags (or 400/422 if gates fail)

`Match.fotmobMatchId` caches the resolved FotMob id (date + home/away search when missing).

## Official vs Live

- **Official** = kickoff named XI (AF startXI, or explicit FotMob Apply).
- **Live** = current pitch after substitutions (kickoff was Official). Live sync resets to kickoff Official then replays subst chronologically so repeated polls do not scramble slots.

## Pitch colour (FotMob-style)

- **Official / Live** → green striped pitch (matchday grass).
- **Predicted / Last XI** → distinct slate-blue striped pitch (not grass), so commentators never mistake a predicted XI for Official.

## Policy (scrapers)

- **Silent FotMob JSON** (`/api/data/matchDetails`, `/api/data/matches?date=`) is used **server-side only**, cached ~90s, scoped to active desks. Soft-fail on blocks.
- SofaScore remains **human tabs only** (soft probes often 403).
- No Puppeteer / HTML scrape of FotMob or SofaScore pages.
