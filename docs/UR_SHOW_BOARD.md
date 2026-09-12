# U&R Show board — runbook

Personal-account enable for Up & Running match-days. **Not** a separate portal or producer role — Chris enables on his own CoComms account (`chris@ronniedogmedia.com`). Remote football comms desk owns Restream / creatives / OBS after handoff.

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

Tenancy: `session.userId` only (`docs/TENANCY.md`). Claim sets `UrShow.claimedByUserId` to the signed-in user; MatchDay must already be owned. Allowlist is checked **before** tenancy for all U&R routes.

## Status spine

`Planned → Creatives → Bound → Soundcheck → Live → Done`  
Advance / back / jump on the board. Persisted on `UrShow.status`.

## Destinations / URL gate

Scheduled **YouTube watch URL** must equal **Restream destination externalUrl**. Board shows **PASS / FAIL**. Critical U&R runbook gate.

## Creatives + social

Approve/reject queue with Canva hooks. Direction: **British soccer only** — club crests + match line + KO time (London). No WPM gold; palette `#0B0F14 / #1A2332 / #F4F7FA / #7EB6FF`.

| Asset | Canva | Preview |
|-------|-------|---------|
| YT thumb | `DAHU_BOLwbc` (provisional — may be replaced) · https://www.canva.com/d/zni2rAcLhanH8gL | `/ur-creatives/thumb.jpg` |
| FB cover | `DAHU_GnpDU8` · https://www.canva.com/d/89dPLgBu5vHYsQ6 | `/ur-creatives/cover.jpg` |
| IG We're Live | **placeholder** — awaiting confirmed British soccer Canva id | empty |

Do **not** lock We're Live or a new YT thumb until Remote sends confirmed Canva ids. Chris still picking crest+KO candidates.

**Rejected:** `DAHU_M_olhE` / `live2.jpg` (American-football look) — do not use.

Approve creative → matching social slots schedule (`t_day`, `t_1h`, `were_live`, `ft`).

Board JSON shape: `ytThumbUrl`, `ytTitle`, `ytDescription`, `fbCoverUrl`, `igStillUrl`, `socialDrafts[{ slot, platform, copy, assetUrl, approved }]`.

## Restream / YouTube

On claim: placeholder `restreamEventStubId` + `youtubeUpcomingStubId`. **No real Restream/YT API** until keys exist — stub + TODO. Social API wiring is Remote desk’s after handoff.

## Ready for desk handoff

Button packages: AF fixture id, match-day id, overlay URL (`/match-day/<matchId>/overlay?scorebug=0&flashes=lower`), approved creatives/social, destination gate. Writes in-app `UrHandoffLog`. Optional `UR_HANDOFF_WEBHOOK_URL`.

**Consumer:** Remote football comms desk.

## Graphics checklist

- RFC Studio — Chris Pro local `:3001`; pitch OFF for U&R talent-cam stack.
- Overlay with `scorebug=0&flashes=lower`.

## API

| Method | Path |
|--------|------|
| GET/PATCH | `/api/show/[matchDayId]` |
| POST | `/api/show/[matchDayId]/claim` |
| POST | `/api/show/[matchDayId]/status` |
| POST | `/api/show/[matchDayId]/handoff` |

## Schema

`UrShow`, `UrCreative`, `UrSocialSlot`, `UrHandoffLog` (1:1 MatchDay). Migration `20260912160000_ur_show_board` (+ Netlify SQL mirror).
