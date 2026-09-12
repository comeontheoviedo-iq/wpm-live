# Visual forks — CoComms vs Sports Pro / SportsCom.pro

**Purpose:** Keep CoComms looking and feeling like a **broadcast commentary desk**, not a customizable Match Center SaaS. Differentiate on chrome and structure only — do not copy SportsCom assets, widgets, or copy. Do not contact Sports Pro creators.

**Research snapshot (public / LinkedIn, 2026):** SportsCom.pro positions a **Match Center** with:
- Customizable central workspace + **side widgets** (stats, team info, personal notes, timeline, weather, top scorers, other scores)
- Player cards with **inline notes under each player**
- Clean, “intuitive digital tool” chrome — widget-arrangement metaphor
- Prep + live data in one configurable dashboard

CoComms already steers the opposite metaphor: **FM-style left match nav**, fixed **LEAGUE / HOOKS / DATA VIZ** top actions, dark **broadcast bug** pitch tokens, call-queue notes with severity edges.

---

## Fork inventory

| # | Fork | Status | What SportsCom-ish chrome looks like | CoComms direction |
|---|------|--------|--------------------------------------|-------------------|
| 1 | **IA / nav shell** | **Done** | Horizontal / central Match Center + side widgets | **Left FM-style match rail** (`MatchSidebar`); hub `AppSidebar`; top desk bar keeps LEAGUE / HOOKS / DATA VIZ |
| 2 | **Desk metaphor** | **Done** | Widget arrangement / personalize workspace | **Fixed broadcast desk** — pitch primary, notes call-queue, Scan / On-air luminance weights |
| 3 | **Surface language** | **Done (baseline)** | Clean SaaS panels, soft cards | Near-black charcoal, 2px corners, scorebug / pitch-token craft, 4px severity edges (no candy fills) |
| 4 | **Typography** | **Shipped (this pass)** | Typical UI sans (Inter-class) | **IBM Plex Sans** UI + **IBM Plex Mono** tabular — engineering / broadcast tooling voice; condensed uppercase desk labels |
| 5 | **Chrome density & rail identity** | **Shipped (this pass)** | Soft widget chrome | Thinner sticky header, **2px brand hairline** under header, denser side rails, sharper radii tokens |
| 6 | **Accent & wordmark** | **Shipped (this pass)** | Neutral product accent | Teal **CoComms** wordmark (`Co` brand / `Comms` muted), mic mark on ink plate, teal inset active nav, poster-tool cluster styling |
| 7 | **Nav personality** | **Shipped (this pass)** | Flat icon lists / widget pickers | Match rail: **always-uppercase labels**, **PREP / INTEL / SQUAD** section kickers, 3px brand inset on active |
| 8 | **Poster / viz tools in chrome** | **Done (locked)** | Stats as side widgets | Top-bar **LEAGUE / HOOKS / DATA VIZ** as first-class desk tools (not widgets) |
| 9 | **Player notes placement** | **Parked** | Notes under every player card in Match Center | Keep notes in **right call-queue / Notes rail** + dossier; avoid under-token clutter on pitch |
| 10 | **Widget marketplace / rearrange** | **Parked** | Drag/add Match Center widgets | Stay fixed desk layout; optional density presets later if needed |
| 11 | **Light “SaaS default” skin** | **Parked** | Often light-first product UI | Dark broadcast remains default; light stays opt-in toggle only |

---

## Shipped in this pass (quick wins)

1. **Typography fork** — IBM Plex Sans / Mono via `next/font` (replaces Geist for UI voice).
2. **Chrome density** — header height + brand bottom hairline; tighter rail padding; radius tokens nudged toward craft TV (1–2px).
3. **Accent / wordmark** — Logo + header “COMMENTARY DESK” kicker; brand teal left-edge language reinforced on active nav.
4. **Nav personality** — Match sidebar sectioned (PREP / INTEL / SQUAD) with uppercase labels.

## Parked (do later, still differentiating)

- Under-player notes on pitch tokens (explicitly avoid SportsCom layout rhyme).
- User-rearrangeable widget grid.
- Alternate accent family (e.g. amber secondary system) — only if teal ever feels generic next to competitors.
- Marketing homepage visual fork pass (out of desk scope).

## Guardrails

- Keep CoComms brand (name, mic mark, teal).
- Do not break desk: LEAGUE / HOOKS / DATA VIZ, left match nav, Scan / On-air, dossiers, OBS overlay.
- No Stripe secrets in docs or commits.
- No outreach to Sports Pro / SportsCom creators.
