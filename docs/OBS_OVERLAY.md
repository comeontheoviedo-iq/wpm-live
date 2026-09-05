# OBS / talent-cam overlay handoff

Lightweight JSON for scoreboard / XI / event flash — not a full OBS UI.

## Endpoint

```
GET /api/matches/:matchId/overlay
```

Requires an authenticated Pitchline session (same cookie as the desk).

Example (Fener desk):

```
GET http://localhost:3000/api/matches/cmtol75ys0crk1bhyhj7aikkx/overlay
```

## Payload shape

- `scoreboard.home|away` — name, score, logo
- `xi.home|away` — starters / on-pitch players (shirt, slot, name)
- `eventFlash` — latest event (type, minute, description)
- `recentEvents` — last 8 events
- `status`, `minute`, `competition`, `generatedAt`

Poll every few seconds from your overlay browser source or a small proxy.
