# CoComms Cloudflare cutover E2E scorecard — 2026-09-30

**Hosts**
- `www.cocomms.online` → Cloudflare OpenNext (`server: cloudflare`, `x-opennext: 1`) — **production DNS**
- `wpm-live.comeontheoviedo.workers.dev` → same Worker preview
- `pitchline-app.netlify.app` → previous Netlify deploy (still healthy)

**Method:** curl + Playwright; Netlify session JWT minted via register. Times Europe/London.

## Blockers (www FAIL until fixed)

| ID | Issue | Evidence |
|----|--------|----------|
| B1 | **AUTH_SECRET mismatch** — Netlify session cookie rejected on www/workers | `GET /api/auth/me` + Netlify `pitchline_session` → Netlify **200** user; www/workers **401** `{"user":null}`. JWT signed with Netlify secret (`pitchline-demo-secret-change-in-prod`) also rejected on www → CF has a **different** AUTH_SECRET (or broken verify path). |
| B2 | **Auth POSTs crash Worker (CF 1101)** | `POST /api/auth/login`, `/register`, `/forgot-password` on www + workers → `500 error code: 1101`. Same routes on Netlify return proper JSON (401/200). |
| B3 | **No way to mint a www session** without B1+B2 | Cannot E2E authenticated flows on www until secrets synced **and** Worker stops throwing 1101. |

**Required ops (Cloudflare dashboard / Migrate — not available to this agent):**
1. Set Worker secrets to **match Netlify production**: `AUTH_SECRET`, `DATABASE_URL` (or Hyperdrive), `API_FOOTBALL_KEY`, `POLAR_*`, `RESEND_API_KEY`, `GEMINI_API_KEY`, etc.
2. Prefer copying **exact** Netlify `AUTH_SECRET` so existing cookies keep working.
3. Redeploy Worker after app fix below (lazy Netlify Blobs / fs imports).
4. Do **not** change DNS (per Chris).

## App-side fix shipped in repo (pending CF redeploy)

- Lazy-load `@netlify/blobs` + `fs/promises` + `path` via `lib/netlify-blobs-lazy.ts` (desk-poster, user-avatar, player-alias-photo) — avoids top-level Node imports poisoning OpenNext Workers (classic CF 1101).
- Client-safe `lib/support-ping-types.ts` for Ask/Report UI.
- `app/match-day/[id]/error.tsx` — clearer desk error + digest.

## Scorecard

| # | Area | Netlify | www CF | Notes |
|---|------|---------|--------|-------|
| 1 | Home / login page HTML | **PASS** 200 | **PASS** 200 | Static/marketing OK on both |
| 1b | Login / register / forgot-password API | **PASS** | **FAIL** 1101 | B2 |
| 1c | Session cookie continuity | **PASS** | **FAIL** 401 | B1 — Netlify JWT invalid on CF |
| 2 | Boards list (`/api/match-days`) | **PASS** | **FAIL** 401 | Needs session |
| 2b | Open existing desk (HTML) | **PASS** Playwright: Arsenal vs Leeds desk loads, **0** console errors, no Application error | **FAIL** | Cookie → login page; Chris screenshot = Application error when session somehow present / RSC crash |
| 3 | Team search `GET /api/football/teams?q=` | **PASS** (Arsenal → 5+ hits) | **FAIL** 401 | Param is `q` not `search` (UI already uses `q`) |
| 3b | Fixture search `GET /api/football/fixtures?team=&next=` | **PASS** | **FAIL** 401 | |
| 3c | Create desk `POST /api/match-days` | **PASS** created `cmuo6vbnb0007siwtorl24prv` Arsenal–Leeds | **FAIL** | Auth |
| 4 | Sync `POST /api/matches/:id/sync` | **PASS** 200 | blocked | |
| 4b | Pitch/XI UI on desk | **PASS** (Assigned, LAST XI, formations visible) | blocked | Lineup route returned 405 on bare GET/POST `{}` — UI uses other verbs/bodies; not a www-only issue |
| 5 | Clubs dossier / form-h2h | **PASS** 200 | blocked | Overview career not separately hit; clubs-dossier OK |
| 6 | Research packs list | **PASS** 200 templates | blocked | |
| 6b | Ask/Report | **PASS** emailSent true | blocked | |
| 7 | Live stats / Full toolbar | **PASS** UI chrome present (Assigned desk) | blocked | Live strip N/A until Live status |
| 8 | Billing region | **PASS** USD founding pricing | blocked on www auth; `/pricing` HTML **PASS** both |
| 8b | Polar checkout | **PASS** returns polar.sh checkout URL | blocked | |
| 9 | Ask/Report (see 6b) | **PASS** | blocked | |
| 10 | AF key | **PASS** Mega plan status OK on Netlify | unknown on CF (auth blocked) | |
| 10b | DB | **PASS** Netlify Prisma | CF likely Hyperdrive/DB env wrong or Prisma engine 1101 on writes | |
| 10c | Webhooks | not live-fired | `/api/billing/polar/webhook` exists in code | Must point Polar to **www** URL with CF env secrets |

## Netlify baseline desk

- Match: Arsenal vs Leeds · Premier League · `cmuo6vbnb0007siwtorl24prv`
- URL: https://pitchline-app.netlify.app/match-day/cmuo6vbnb0007siwtorl24prv
- Probe user: `agent-probe2-*@cocomms.online` (trial)

## Conclusion

Chris is right that **www feels “so much wrong”**: after the Cloudflare cut, **auth is broken end-to-end** (secret mismatch + Worker 1101 on login). Team search and desk open fail as consequences. Product code on Netlify still works.

**Next:** sync CF Worker env to Netlify → redeploy OpenNext Worker with lazy-blobs commit → re-run this scorecard on www.
