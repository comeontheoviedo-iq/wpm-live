export type PackTemplateSeed = {
  key: string;
  title: string;
  description: string;
  section: string;
  order: number;
  prompt: string;
};

export const HOUSE_RULES = `
HOUSE RULES (always apply):
1) This is an UNOFFICIAL broadcast. Never claim to be the rights-holding or official league/club broadcast.
2) When referring to a domestic league with a sponsored/commercial name, prefer the country's top-flight label
   (e.g. "French top flight", "Scottish top flight", "Turkish top flight", "English top flight") unless the
   user explicitly asks for the sponsor name.
3) Be accurate, vivid, and usable live. Short paragraphs. NO invented stats, quotes, injuries, transfers,
   or personal stories — if unsure write "Unknown". Prefer fewer true lines over colourful fiction.
4) Tone: professional radio/stream commentary, warm, not hype-spam.
5) You are not allowed to invent. Ground every claim in MATCH CONTEXT, desk/API data, or grounded search.
   If a fact is not in context/search, skip it or mark Unknown.
`.trim();

export const PACK_TEMPLATE_SEEDS: PackTemplateSeed[] = [
  {
    key: "research",
    title: "Research pack",
    description:
      "Notebook-depth brief: venue, form, continental context, team news, opposition identity, officials, tactical battle lines.",
    section: "research",
    order: 1,
    prompt: `${HOUSE_RULES}

Write a NOTEBOOK-LEVEL DEEP-RESEARCH BRIEF for this fixture — scannable headings, factual only, gold-standard commentary prep depth.

Use ONLY: grounded Google search + the provided MATCH CONTEXT / desk / API-Football block.
Every claim must be sourced (cite outlet/date in parentheses) OR explicitly marked Unknown.
Forbid fabricated quotes, numbers, injuries, transfers, managerial bans, or personal anecdotes.

Required sections (use these exact headings — do not skip; write Unknown under a heading if missing):

## Venue & atmosphere
Capacity, city, expected feel / home crowd colour ONLY if known from context/search. Note surface/weather if in desk context.

## Broadcast framing
One short paragraph reinforcing this is an independent / unofficial broadcast (no rights-holder claim). Competition via country top-flight / UEFA label (NOT sponsor name).

## Table position & form
League/group standing if known; last-5 / recent form for both sides. Include a "Last 7 days" mini-list of relevant results when search/context provides them.

## Continental / competition context
UEFA or domestic cup path, group stakes, tie-breakers, must-win framing — only if applicable and known.

## Team news
Absences, returns, surprise inclusions/omissions ONLY if listed in context injuries / XI / confirmed search.
Call out notable selection stories when grounded (e.g. dropped starter, returning midfielder). Mark Unknown rather than guessing.

## Opposition identity
Style fingerprint for each side / key creator / press shape — ONLY when grounded. Name managers and one concrete stylistic note each if known.

## Manager / touchline notes
Suspensions, bans, absences from dugout — ONLY if confirmed. Else Unknown / none listed.

## Referee & cards
Referee (+ assistants if known). Card profile / average cards / reputation ONLY when sourced; otherwise keep clean and factual.

## Tactical battle lines
Formations from context + 2–4 concrete watchpoints (e.g. wide overloads, set-piece threat, midfield duel). No invented tactics boards.

## Key players to track
Named players from XI/squad only — one watchpoint each (max 6–8 total).

## Must-mention (8 facts)
Numbered bullets of air-ready facts grounded above.

## Open questions / Unknowns
Bullet list of gaps.

Target depth: thorough Notebook brief (roughly 700–1200 words equivalent). Prefer scannable bullets under headings over fluff.`,
  },
  {
    key: "intro",
    title: "Intro script",
    description:
      "Air-ready open 600–900w: venue, disclaimer, table/form, continental stakes, team news, opposition identity, ref, tactical battle.",
    section: "intro",
    order: 2,
    prompt: `${HOUSE_RULES}

Write an AIR-READY BROADCAST INTRO SCRIPT for an unofficial broadcast of this match.
Target length: 600–900 words spoken — scannable headings, Notebook / gold-standard depth (venue atmosphere, independent-broadcast disclaimer, table/form, continental context, last-7-days results, team news, opposition identity, manager touchline notes, referee card profile, tactical battle lines).
NO invented stats. If a detail is not in context/search, omit or mark Unknown.

Use these headings (keep them in the output):

## Cold open
## Venue & atmosphere
## Independent broadcast note
## Stakes, table & form
## Last 7 days
## Team news
## Opposition identity
## Manager / touchline
## Referee watch
## Tactical battle lines
## Human beat
## Hand-off

Guidance:
1) Cold open — 2–4 spoken lines that land the fixture.
2) Venue & atmosphere — stadium, city, crowd colour only if known.
3) Independent broadcast note — explicit unofficial / independent framing; competition via country top-flight / UEFA label (NOT sponsor).
4) Stakes, table & form — why it matters + standings/form only if known.
5) Last 7 days — recent results that shape the story; else Unknown / skip lightly.
6) Team news — ONLY from provided injuries / XI / confirmed search (e.g. dropped/returning players); else none listed.
7) Opposition identity — style notes for both sides grounded in context/search (managers, creators).
8) Manager / touchline — bans/absences ONLY if confirmed.
9) Referee watch — referee + card profile ONLY when known.
10) Tactical battle lines — formations from context + 1–2 concrete watchpoints (no invented boards).
11) Human beat — ONE grounded narrative from context/search; never invent personal drama.
12) Hand-off — bridge into lineups / first whistle.

Write in spoken prose, first person plural ("we"), ready to read on air.
If a RESEARCH BRIEF is provided below the match context, treat it as the primary factual spine — still do not invent beyond it.`,
  },
  {
    key: "profiles",
    title: "Player profiles",
    description: "Full profiles for starters + impact bench — factual only.",
    section: "profiles",
    order: 3,
    prompt: `${HOUSE_RULES}

Produce FULL PLAYER PROFILES for the likely/confirmed starting XIs and 3 impact substitutes per side.
For each player: name, role, 2–3 sentence profile (style, season note, watchpoint), plus one live "call" tip.
Richer is fine — but NO invention. If career history / season numbers are unknown, write a short honest placeholder
or "Unknown" rather than fabricating. Do not invent injuries, transfers, or personal stories.
Group by team. Prefer desk/API context and grounded search only.`,
  },
  {
    key: "referee",
    title: "Referee paragraph",
    description: "On-air referee intro paragraph — factual only.",
    section: "referee",
    order: 4,
    prompt: `${HOUSE_RULES}

Write a ready-to-read REFEREE PARAGRAPH (5–8 sentences) covering the referee and assistants if known.
Include style / card tendencies ONLY when known from context or grounded search; otherwise keep it clean and factual.
Never invent disciplinary history. End with a line that hands back to the action.`,
  },
  {
    key: "lineup",
    title: "Lineup read",
    description: "Spoken lineup read for both XIs — factual only.",
    section: "lineup",
    order: 5,
    prompt: `${HOUSE_RULES}

Write a spoken LINEUP / "let's look at the two teams" intro beat for both sides.
- Open with a short bridge into the XIs (e.g. looking at the two teams)
- Start with formation for each side (from context)
- Read numbers + surnames in a natural radio cadence
- Note captain and any standout selection ONLY if known from context
- Flag predicted vs confirmed if status is not confirmed
- Do not invent late changes, absences, or "surprise" inclusions not in the XI list
Keep it under ~90–120 seconds spoken.`,
  },
  {
    key: "hooks",
    title: "Hooks & fillers (factual)",
    description:
      "15+ numbered factual commentary hooks/fillers from grounded search + desk context (Notebook bar).",
    section: "hooks",
    order: 6,
    prompt: `${HOUSE_RULES}

SYSTEM TASK — COMMENTARY HOOKS & FILLERS (Notebook bar)
Write commentary hooks and fillers usable throughout the game for an unofficial broadcast.
Push hard to find REAL material via grounded Google search + MATCH CONTEXT / desk / API-Football.

You FAIL the task unless you produce **15 or more** numbered, relevant hooks/fillers.
Do NOT invent. Every line must be factual from grounded search or desk context.
If a specific beat cannot be verified, skip it (or mark Unknown) and find another true line instead —
volume of *true* lines is required; colourful fiction is forbidden.

Hunt across these categories (use only when you have a real fact):
- City / town facts for the venue
- Historical points for both teams
- Recent matches for each team
- Recent head-to-head
- Overall H2H + head coaches
- Quirky but true team facts
- General team stats
- Players returning to old clubs
- Standout player stats / milestones
- Narrative / transfer / context (only if confirmed)
- Injured players (only if listed/confirmed)
- Top scorers
- Upcoming goal milestones
- Transfer rumours — only when clearly attributed and current; else skip
- Anything else relevant and grounded

Format (NUMBER THEM 1…N, N ≥ 15):
1. [Tag — Player/Topic] Short title
   Spoken line(s) — 1–2 sentences, air-ready.

Prefer lines tagged to real named players from the XI/squad/context when possible.
Cite outlet/date lightly in parentheses when the fact comes from search.
Target: 15–22 true hooks. Never pad with guesses.`,
  },
];

export function buildMatchContextPrompt(ctx: {
  home: string;
  away: string;
  competition: string;
  broadcastCompetition: string;
  kickoff: string;
  venue?: string | null;
  homeFormation?: string;
  awayFormation?: string;
  lineupStatus?: string;
  referee?: string | null;
  homeXi?: string[];
  awayXi?: string[];
  notes?: string[];
}) {
  return [
    `HOME: ${ctx.home}`,
    `AWAY: ${ctx.away}`,
    `COMPETITION (official label): ${ctx.competition}`,
    `COMPETITION (on-air label): ${ctx.broadcastCompetition}`,
    `KICKOFF: ${ctx.kickoff}`,
    `VENUE: ${ctx.venue || "Unknown"}`,
    `HOME FORMATION: ${ctx.homeFormation || "TBC"}`,
    `AWAY FORMATION: ${ctx.awayFormation || "TBC"}`,
    `LINEUP STATUS: ${ctx.lineupStatus || "predicted"}`,
    `REFEREE: ${ctx.referee || "TBC"}`,
    `HOME XI: ${(ctx.homeXi || []).join(", ") || "TBC"}`,
    `AWAY XI: ${(ctx.awayXi || []).join(", ") || "TBC"}`,
    `MATCH NOTES:`,
    ...(ctx.notes || []).map((n) => `- ${n}`),
  ].join("\n");
}
