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
| 4 | **Typography** | **Shipped** | Typical UI sans (Inter-class) | **IBM Plex Sans** UI + **IBM Plex Mono** tabular — engineering / broadcast tooling voice; condensed uppercase desk labels |
| 5 | **Chrome density & rail identity** | **Shipped** | Soft widget chrome | Thinner sticky header, **2px brand hairline** under header, denser side rails, sharper radii tokens |
| 6 | **Accent & wordmark** | **Shipped** | Neutral product accent | Teal **CoComms** wordmark (`Co` brand / `Comms` muted), mic mark on ink plate, teal inset active nav, poster-tool cluster styling |
| 7 | **Nav personality** | **Shipped** | Flat icon lists / widget pickers | Match rail: **always-uppercase labels**, **PREP / INTEL / SQUAD** section kickers, 3px brand inset on active |
| 8 | **Poster / viz tools in chrome** | **Done (locked)** | Stats as side widgets | Top-bar **LEAGUE / HOOKS / DATA VIZ** as first-class desk tools (not widgets) |
| 9 | **Player notes placement** | **Shipped (this pass)** | Notes under every player card in Match Center | **No under-token note text.** Notes stay in **call-queue / Notes pages + player dossier**. Amber **note pip** on tokens + squad `Nn` chip cue dossier; Notes → **Open dossier** CTA; shirt hotkeys open notes tab when notes exist |
| 10 | **Widget marketplace / rearrange** | **Shipped as density only** | Drag/add Match Center widgets | **Stay fixed desk layout.** Optional **Compact / Comfortable** density preset (`data-desk-density`, localStorage) — spacing only, no rearrange |
| 11 | **Light “SaaS default” skin** | **Parked** | Often light-first product UI | Dark broadcast remains default; light stays opt-in toggle only |
| 12 | **Amber secondary accent** | **Shipped (this pass)** | Single product accent / rebrand | Teal stays brand. **Amber secondary** (`--accent-secondary`) for pins, warning edges, note pip, dossier chips — severity / moment language only |
| 13 | **Marketing homepage visual fork** | **Shipped (this pass)** | Generic SaaS hero / soft cards | Darker ink base, pitch-grid wash, sharper 2–3px craft radii, **scorebug trailer frame** around Matchday Cut (asset unchanged), Plex Mono kickers — co-pilot copy retained |

---

## Shipped previously

1. **Typography fork** — IBM Plex Sans / Mono via `next/font`.
2. **Chrome density** — header height + brand bottom hairline; tighter rail padding; radius tokens nudged toward craft TV (1–2px).
3. **Accent / wordmark** — Logo + header “COMMENTARY DESK” kicker; brand teal left-edge language on active nav.
4. **Nav personality** — Match sidebar sectioned (PREP / INTEL / SQUAD) with uppercase labels.

## Shipped in this pass

1. **Player notes / dossier access** — explicit avoid under-token notes; amber pip + Notes→dossier CTA; Notes/Prep pages open dossier on Notes tab.
2. **Desk density preset** — Compact (default) / Comfortable toggle on desk header; fixed layout retained.
3. **Amber secondary accent system** — CSS tokens + pin/severity/note cues; teal brand untouched.
4. **Marketing homepage** — stronger broadcast personality (hero grid, trailer scorebug frame, typography) without changing co-pilot copy or trailer file.

## Still parked

- Light theme as default (stays opt-in).
- Any under-player note body on pitch tokens (do not ship — SportsCom rhyme).
- User-rearrangeable widget grid (do not ship).

## Guardrails

- Keep CoComms brand (name, mic mark, teal primary).
- Do not break desk: LEAGUE / HOOKS / DATA VIZ, left match nav, Scan / On-air, dossiers, OBS overlay.
- No Stripe secrets in docs or commits.
- No outreach to Sports Pro / SportsCom creators.
- Trailer / Matchday Cut asset: do not overwrite concurrent video work; homepage only frames the existing `/videos/cocomms-matchday-demo.mp4`.
