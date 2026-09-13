# CoComms multi-channel outreach plan (v1)

Internal. **Chris approves every outbound message before send.** Bot drafts / queues / tracks only.

**CTA:** https://www.cocomms.online  
**Replies:** help@cocomms.online (when live)  
**LinkedIn detail:** `docs/LINKEDIN_OUTREACH.md`  
**Tracker:** `docs/outreach-tracker.csv` (or Google Sheet with same columns)

---

## Hard rules (all channels)

1. **Approve-before-send** — no DM, comment, post, or email goes live without Chris’s explicit OK on that copy.
2. **ICP** — football/soccer commentators who *call* matches. Skip Sports Pro / SportsCom / tool builders; skip Spalk scraping; Spalk partnership later.
3. **Voice** — commentary co-pilot; notes + voice; prep filed; live feed / lineups / desk. No Gemini, OBS, Speaks, BYO, SaaS-shell hype, fake social proof.
4. **No bots / scrapers** on LinkedIn. Automation = list queue, drafts, cadence reminders, tracker — not auto-send.
5. **Stop** on “not interested.” Mark `do_not_contact`.
6. **Zero ad budget** for v1 (organic only).

---

## Channel roles

| Channel | Role | Day-1 readiness | Cadence (light) |
|---------|------|-----------------|-----------------|
| **LinkedIn** | Primary pipeline — connects → soft intro → trial CTA | Ready (playbook + templates) | 10–20 connects/day; intros on accepts; CTA 3–5d later |
| **Reddit** | Community value posts + rare soft CTA (not cold DMs first) | Needs account + sub list approval | 1–2 helpful posts/week max across approved subs |
| **Facebook** | Groups / pages where commentators hang out | Needs which groups Chris owns/joins | 1 post or comment thread/week if group allows promo |
| **X / Instagram / TikTok / YouTube** | Brand presence + trailer; not cold DM factories | Trailer exists; accounts TBD | Post trailer / tips; DMs only if they initiate or Chris approves |

**Tomorrow start (Chris):** LinkedIn + Reddit + Facebook drafts. Approve-before-send. See `docs/OUTREACH_DRAFTS_2026-09-14.md`.

---

## LinkedIn (primary)

See `LINKEDIN_OUTREACH.md`. Sequence: Connect → Soft intro → Trial CTA.  
Exclude Sports Pro founder/builders and tool-builders.  
UTM optional: `?utm_source=linkedin&utm_medium=outreach&utm_campaign=commentator`

---

## Reddit (secondary)

### Approach
- Join as a real commentator-tool builder; **help first**.
- Prefer posts that answer a real pain (tab hell, lineup chaos, notes filing) with a soft “we built CoComms for that — trial at cocomms.online” only where self-promo is allowed.
- Prefer **comments** on existing threads over cold spam posts.
- **No mass DMs.** If someone asks for the link in-thread, reply with approved copy.

### Candidate subs (Chris to approve which to use)
| Sub | Why | Risk |
|-----|-----|------|
| r/sportsbroadcasting | Broadcast / calling adjacent | Promo rules — check sidebar |
| r/footballmanagergames | Prep nerds; weak ICP | Off-ICP; low priority |
| r/soccer | Huge; promo hate | High — comments only if on-topic |
| r/broadcasting | General | Check rules |
| League/country radio/football media subs | Closer to callers | Varies |

**Do not** create throwaway spam accounts. Use Chris / Ronnie Dog Media identity Chris chooses.

### Draft post skeleton (approve before post)
```
Title: [specific pain — e.g. How do you keep notes + live XI tidy on matchday?]

Body: Short real problem → what you tried → one concrete tip → optional soft CTA to CoComms trial.
```

---

## Facebook (secondary)

### Approach
- Commentator / remote commentary / football media **groups** only if rules allow product shares.
- Prefer value comment → link only if asked or if pinned promo day exists.
- Page posts from a CoComms or RDM page: trailer + “trial open” — Chris approves creative + caption.

### Needs from Chris
- List of groups he’s in / willing to join
- Whether posts go from personal profile or a Page

---

## Other socials (presence, not cold outreach)

| Asset | Use |
|-------|-----|
| Homepage trailer | Pin / post on YT, IG, X, LinkedIn company/personal as Chris approves |
| Training hub | After signup only — don’t cold-link gated training |
| Short tips | “One desk tip” carousels — draft later if LinkedIn replies need nurture |

Create / claim accounts only when Chris names which handles to use — don’t invent brand accounts without him.

---

## Approve-before-send workflow

1. Bot adds prospects / draft posts to tracker (`status=draft`).
2. Bot pastes proposed copy in chat (or sheet `draft_copy` column).
3. Chris replies **approve** / **edit: …** / **kill**.
4. Only then: send/post; mark `sent` + date; log channel.

---

## Week-1 usage discipline (Bot)

- Finish Zoho help@ + welcome email (funnel).
- Do **not** burn credits on huge LinkedIn scrapes or multi-agent research.
- Batch 1: small list (≤25) + draft connect notes for approval.
- Multi-channel: this doc + 2–3 Reddit/FB draft posts max until Chris picks channels.

---

## Success (honest)

Same as LinkedIn doc: accepts, replies, attributed trials, desks created. No invented benchmarks.

---

## D. Commercial license / enterprise track (media groups)

**Goal:** Find people at broadcasters and platforms who **manage or book groups of commentators** (not individual callers first) and pitch a **commercial / team license** for CoComms desks.

### Target orgs (global, expand as we go)

| Org | Why |
|-----|-----|
| talkSPORT / Wireless Group | Large UK football radio / commentary talent pool |
| DAZN | Global sports streaming; multi-territory commentary |
| Sky Sports / Sky | UK + intl football coverage |
| BBC Sport / BBC Audio | Staff + freelance callers |
| ESPN / ESPN+ | US + intl soccer commentary |
| beIN Sports | Multi-territory |
| CBS Sports / Paramount+ | US soccer |
| Apple TV (MLS Season Pass) / MLS | Club/league commentary ops |
| Spalk | Later — after individual signups (do not scrape talent roster) |
| IMG / Endeavor / Wasserman (talent) | Optional later — agencies who place commentators |

### Who to find (titles / keywords)

- Head / Director of Commentary, Commentary Manager, Talent Producer (football/soccer)
- Sports Audio Producer, Broadcast Operations (football)
- Freelance Coordinator / Talent Booker (sports)
- Head of Production / Exec Producer — football remotes
- Partnerships / Commercial (only if they clearly own tooling for talent)

**Exclude:** Sports Pro / SportsCom builders; pure sales with no talent ops link; Dan @ Sports Pro.

### Sequence (approve-before-send)

1. Identify 1–2 named contacts per org via LinkedIn (1st/2nd degree first).
2. Soft connect or InMail/DM with **enterprise** copy (below) — not the individual commentator CTA.
3. Offer a short demo desk + commercial conversation (seats / unlimited desks / SSO later).
4. Track in `outreach-tracker.csv` with `channel=linkedin_enterprise` and `league_or_outlet=<org>`.

### Draft enterprise soft intro (approve before send)

```
Hi [name] — I saw you work with football/soccer commentary talent at [org].

I built CoComms, a commentary co-pilot for matchday: commentators bring their notes and voice; we file notes in the right places and keep the live match desk in one screen so they’re not managing five screens and 20 tabs.

Early reviews say it’s more detailed and better value than other tools. Happy to show a desk and talk commercial / team licensing if useful for the people you look after.
```

### Draft enterprise CTA

```
[name] — if helpful, I can set up a short walkthrough of the CoComms desk and share commercial options for a group of commentators at [org]. No hard sell — shout if a 15-min look is worth it.
```

**Cadence:** build the org contact list this week in parallel with individual LinkedIn; do not pause individual commentator outreach for this.

