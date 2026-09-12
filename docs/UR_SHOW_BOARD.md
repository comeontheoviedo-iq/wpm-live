# U&R Show board — runbook

Personal-account enable for Up & Running match-days. **Not** a separate portal or producer role — Chris enables on his own CoComms account (`chris@ronniedogmedia.com`). Remote football comms desk (U+R) owns Restream / creatives / OBS / Postiz after handoff.

## Privacy allowlist (hard lock)

U&R chrome (Enable U&R, `/show/*`, `/api/show/*`) is visible **only** to emails on the allowlist.

- Helper: `lib/ur-access.ts` → `canUseUrShow(email|user)`
- Env: `UR_SHOW_ALLOWLIST` = comma-separated emails (case-insensitive)
- **Floor:** `chris@ronniedogmedia.com` is always allowed — empty/misconfigured env cannot open U&R to everyone
- Default allowlist: **only** `chris@ronniedogmedia.com`
- **Never** shown to `demo@pitchline.app`, `tester@cocomms.online`, or any other account

## How Chris enables a match

1. Sign in as `chris@ronniedogmedia.com` (his real CoComms U&R account).
2. Dashboard → **Enable U&R** on a desk (or open `/show/<matchDayId>` → Enable).
3. One Show board per claimed MatchDay: `/show/[matchDayId]`.

On Enable (and on board open / `PATCH action=refresh-from-match`): **full autofill from MatchDay**:

- home/away names + crest URLs (AF team logos)
- competition, venue
- KO time labelled **Europe/London**
- YT title + description derived from match
- overlay URL: `{APP}/match-day/{matchId}/overlay?scorebug=0&flashes=lower`
- socialDrafts `t_day` / `t_1h` / `were_live` / `ft` with match-specific copy

Tenancy: `session.userId` only (`docs/TENANCY.md`). Claim sets `UrShow.claimedByUserId` to the signed-in user; MatchDay must already be owned. Allowlist is checked **before** tenancy for all U&R routes.

## Status spine

`Planned → Creatives → Bound → Soundcheck → Live → Done`

- Manual advance / back / jump still work.
- **Auto-forward from completeness** (never invents APIs):
  - → **Creatives** when any match-specific creative asset/Canva id is present
  - → **Bound** when destinations URL gate PASSes
- Soundcheck / Live / Done stay manual.

## Destinations / URL gate

Scheduled **YouTube watch URL** must equal **Restream destination externalUrl**. Board shows **PASS / FAIL**.

URLs stay stub/empty until U+R wires Restream+YT on handoff — **FAIL until both present and equal**. Do not fake create APIs here.

## Creatives + social (per-show only)

**Never** seed another fixture’s Canva ids or preview art (no Everton / United / Nice / Lille / shared `/ur-creatives/thumb.jpg` defaults).

Placeholder copy when empty: **“Awaiting match-specific creatives pack”**.

| Slot | Hook fields (PATCH) |
|------|---------------------|
| YT thumb | `ytThumbUrl`, `ytThumbCanvaId`, `ytThumbCanvaUrl` |
| FB cover | `fbCoverUrl`, `fbCoverCanvaId`, `fbCoverCanvaUrl` |
| IG We're Live | `igStillUrl`, `igStillCanvaId`, `igStillCanvaUrl` |
| Open / HT / FT | `openUrl`/`openCanvaId`/`openCanvaUrl`, `ht*`, `ft*` |

Also: `PATCH { action: "set-assets", ... }` or `action: "creative"` with `assetUrl`/`canvaId`/`canvaUrl`.

Known pack (code): `UR_MATCH_CREATIVE_PACKS` in `lib/ur-show.ts` — applied only when home/away match.

### Strasbourg vs Monaco (current pack)

| Asset | Canva | Preview |
|-------|-------|---------|
| YT thumb | `DAHU_c69KLc` · https://www.canva.com/d/Jl4_OpWSo6paZs0 | `/ur-creatives/strasbourg-monaco/yt1.jpg` |
| FB cover | `DAHU_QxBX5U` · https://www.canva.com/d/8g_Ybqm87ydLA0s | `/ur-creatives/strasbourg-monaco/fb1.jpg` |
| IG We're Live | `DAHU_X1BZwI` · https://www.canva.com/d/PGb7QLCk9z7WaH- | `/ur-creatives/strasbourg-monaco/ig1.jpg` |
| Open / HT / FT | empty TBD — U+R pushes later | — |

Approve creative → matching social slots schedule (`t_day`, `t_1h`, `were_live`, `ft`). Postiz posting is U+R after approve — stub only here.

Board JSON: `ytThumbUrl`, `ytTitle`, `ytDescription`, `fbCoverUrl`, `igStillUrl`, `socialDrafts[{ slot, platform, copy, assetUrl, approved }]`, `matchDay{ home, away, crests, venue, kickoffLondon, … }`.

## Restream / YouTube

On claim: placeholder `restreamEventStubId` + `youtubeUpcomingStubId`. **No real Restream/YT API** — U+R creates on handoff. Social/Postiz wiring is Remote desk’s after handoff.

## Ready for desk handoff

Button packages complete JSON for Remote football comms desk:

- AF fixture id, matchDayId, matchId
- overlay URL + params (`scorebug=0&flashes=lower`)
- destinations + gate
- approved creatives + approved social drafts
- YT title/desc, thumb/cover/IG urls, canva metadata
- match autofill block

Writes in-app `UrHandoffLog`. Optional `UR_HANDOFF_WEBHOOK_URL` POSTs the same payload when set.

## Graphics checklist

- RFC Studio — Chris Pro local `:3001`; pitch OFF for U&R talent-cam stack.
- Overlay with `scorebug=0&flashes=lower`.

## API

| Method | Path | Notes |
|--------|------|--------|
| GET/PATCH | `/api/show/[matchDayId]` | GET refreshes autofill; PATCH destinations / creatives / `set-assets` / `refresh-from-match` |
| POST | `/api/show/[matchDayId]/claim` | Enable U&R + autofill (+ known pack if any) |
| POST | `/api/show/[matchDayId]/status` | Advance / back / jump |
| POST | `/api/show/[matchDayId]/handoff` | Package JSON + optional webhook |

## Schema

`UrShow`, `UrCreative`, `UrSocialSlot`, `UrHandoffLog` (1:1 MatchDay). Migration `20260912160000_ur_show_board` (+ Netlify SQL mirror).
