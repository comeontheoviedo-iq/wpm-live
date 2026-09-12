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

1. Sign in as `chris@ronniedogmedia.com`.
2. Dashboard → **Enable U&R** (or `/show/<matchDayId>` → Enable).
3. One Show board per claimed MatchDay: `/show/[matchDayId]`.

On Enable (and board open / `PATCH action=refresh-from-match`): **full autofill from MatchDay**:

- home/away names + crest URLs
- competition, venue, KO **Europe/London**
- SEO YT title + description (never “CoComms U&R” in public titles)
- Default **thumbnail brief** / pack notes (not a fake Canva render)
- overlay: `{APP}/match-day/{matchId}/overlay?scorebug=0&flashes=lower`
- social cadence drafts `t_day` / `t_1h` / `were_live` / `ft`
- Board **Provisioning…** + stub tasks; webhook action `enable_provision` if `UR_HANDOFF_WEBHOOK_URL` set

Tenancy: `session.userId` only. Allowlist checked **before** tenancy.

## SEO autofill templates

### YT title (≤100 chars)

`{Home} vs {Away} Live Watchalong | Unofficial & Remote | {Competition}`

Front-load teams + Live Watchalong. **NEVER** “CoComms U&R” in public titles.

### YT description (2–3 short paras)

Voice + graphics watchalong (no match footage); KO London + venue; live score/events + reaction; CTA subscribe + `#TeamA #TeamB #Competition #Watchalong #UnofficialAndRemote`.

### Thumbnail brief (Enable pack notes — not a Canva render)

ONE idea only: **big home crest + big away crest + 3–4 words max** (`LIVE WATCHALONG` / `WE'RE LIVE`). No full title on thumb (title carries SEO). High contrast, mobile-first, safe zone. Optional later: Chris face cutout looking toward crests.

Exposed as `board.thumbnailBrief` / `creatives[].brief` / `enable_provision.thumbnailBrief`.

### Social cadence (platform-fit)

| Slot | Intent | Platform fit |
|------|--------|--------------|
| `t_day` | Anticipation + teams + KO + `{WATCH_LINK}` | YT community longer |
| `t_1h` | Reminder + `{WATCH_LINK}` | FB longer |
| `were_live` | **GO LIVE** fires — clear join CTA + link (gate must PASS) | IG shorter + visual |
| `ft` | Thanks + subscribe + next tease | YT longer |

## Enable → auto-provision stubs

Even days ahead of KO:

1. `provisioningStatus = "provisioning"` → **Provisioning…**
2. Stub tasks: Restream encoder + scheduled YT/FB create; creatives generate (use thumbnail brief); social drafts ready
3. Webhook / log action: **`enable_provision`**

U+R PATCHes both destination URLs → `provisioningStatus = "ready"`.

### Write-back fields

| Field | How |
|-------|-----|
| `youtubeWatchUrl` / `restreamExternalUrl` | `PATCH /api/show/{matchDayId}` (must match) |
| `restreamEventStubId` / `youtubeUpcomingStubId` | Optional real ids |
| `ytThumbUrl` / Canva / `fbCoverUrl` / `igStillUrl` / moments | `set-assets` or root shortcuts |

## Status spine

`Planned → Creatives → Bound → Soundcheck → Live → Done`

Auto-forward: Creatives (any match-specific asset) → Bound (URL gate PASS). **GO LIVE** → Live. Soundcheck/Done otherwise manual.

## Destinations / URL gate

YT watch URL must equal Restream externalUrl. FAIL until both present and equal.

## GO LIVE (separate from Enable / Ready for desk)

- Enabled when URL gate **PASS**; soft-warn if creatives/social incomplete.
- Action **`go_live`**: start Restream destinations path + We're live cadence; status → Live.
- **CoComms does NOT start streaming** — U+R/OBS owns encoder.

## Creatives + social (per-show only)

Never seed another fixture’s art. Empty slots show thumbnail brief / pack notes.

## Ready for desk

`action: ready_for_desk` packages AF fixture, overlay, approved creatives/social. Optional `UR_HANDOFF_WEBHOOK_URL`.

## Graphics (do not change)

- RFC Studio localhost:3001 — pitch OFF
- Overlay on cocomms.online with `scorebug=0&flashes=lower`

## Layout

One vertical spine: status → match → provision → sticky destinations → GO LIVE → graphics → creatives (crests) → social one-column → Ready for desk.

## API

| Method | Path | Notes |
|--------|------|--------|
| GET/PATCH | `/api/show/[matchDayId]` | Autofill; destinations clear provisioning |
| POST | `/api/show/[matchDayId]/claim` | Enable + Provisioning… + `enable_provision` |
| POST | `/api/show/[matchDayId]/status` | Advance / back / jump |
| POST | `/api/show/[matchDayId]/handoff` | `ready_for_desk` \| `go_live` |

## U+R consumer payload shapes

### `enable_provision`

```json
{
  "action": "enable_provision",
  "consumer": "Remote football comms desk",
  "matchDayId": "…",
  "matchId": "…",
  "afFixtureId": 123,
  "tasks": [
    { "key": "restream_yt_fb", "label": "Restream encoder + scheduled YT/FB create", "status": "pending" },
    { "key": "creatives_generate", "label": "Creatives generate request", "status": "pending" },
    { "key": "social_drafts", "label": "Social drafts ready", "status": "pending" }
  ],
  "ytTitle": "Home vs Away Live Watchalong | Unofficial & Remote | Comp",
  "ytDescription": "…",
  "thumbnailBrief": "ONE idea only: big home crest + big away crest + 3–4 words max (LIVE WATCHALONG / WE'RE LIVE). …",
  "creativeBriefs": { "thumb": "…", "cover": "…", "ig_live": "…" },
  "socialDrafts": [],
  "socialCadence": {
    "t_day": "anticipation + teams + KO + link (YT/FB longer)",
    "t_1h": "reminder + link (FB longer)",
    "were_live": "GO LIVE fires — clear join CTA + link; IG shorter + visual; gate must PASS",
    "ft": "thanks + subscribe + next tease (YT longer)"
  },
  "match": {},
  "overlayUrl": "https://www.cocomms.online/match-day/…/overlay?scorebug=0&flashes=lower",
  "writeBack": { "youtubeWatchUrl": "…", "restreamExternalUrl": "…", "note": "…" },
  "note": "Enable U&R auto-provision — … PATCH destination URLs back to clear Provisioning…"
}
```

### `go_live`

```json
{
  "action": "go_live",
  "consumer": "Remote football comms desk",
  "matchDayId": "…",
  "matchId": "…",
  "afFixtureId": 123,
  "signal": "start_restream_destinations",
  "cadence": "were_live",
  "wereLiveSlot": {},
  "youtubeWatchUrl": "https://…",
  "restreamExternalUrl": "https://…",
  "overlayUrl": "…",
  "ytTitle": "…",
  "status": "Live",
  "softWarn": null,
  "note": "GO LIVE is a signal only — CoComms does NOT start the encoder. U+R/OBS owns Restream destinations path + We're live cadence."
}
```

### `ready_for_desk`

`action: "ready_for_desk"` + approved creatives/social, destinations gate, overlay, match, `writeBack`, `thumbnailBrief`.

## Schema

`UrShow.provisioningStatus` (`idle` \| `provisioning` \| `ready`). Migration `20260912190000_ur_provision_golive` (+ Netlify SQL mirror).
