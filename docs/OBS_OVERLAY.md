# OBS / talent-cam overlay

## Visual Browser Source (shipped)

Transparent **1920×1080** scorebug + live intel / data-viz flashes:

```
http://localhost:3000/match-day/<matchDayId|matchId>/overlay
```

Example (Everton desk):

```
http://localhost:3000/match-day/cmtots5dq011ma69s89vv9ffe/overlay
```

### OBS setup

1. Sources → **Browser** → create
2. URL: the overlay URL above (logged-in session cookie required — use a profile that has signed into Pitchline, or Custom CSS/cookies as you prefer)
3. Width **1920**, Height **1080**
4. Check **Shutdown source when not visible** (optional)
5. Leave page CSS empty; page is already transparent (`html`/`body`/`root`)
6. No desk chrome, pitch, notes, dossiers, or scrollbars — only the scorebug + flash stack

Polls the same `/api/matches/:id/sync` feed as the live desk (18s while Live). Soft-fails empties.

CSS for this page is scoped under `.obs-overlay` / `html.obs-overlay-active` so league/desk styles stay untouched.

## JSON handoff (unchanged)

```
GET /api/matches/:matchId/overlay
```

Requires an authenticated Pitchline session (same cookie as the desk).

Payload: `scoreboard`, `xi`, `eventFlash`, `recentEvents`, `status`, `minute`, `competition`, `generatedAt`.
