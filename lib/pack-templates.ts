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
    description: "Deep-research brief: form, team news, tactics, key players, officials, stakes.",
    section: "research",
    order: 1,
    prompt: `${HOUSE_RULES}

Write a DEEP-RESEARCH BRIEF for this fixture — Notebook-style, scannable, factual only.

Use ONLY: grounded Google search + the provided MATCH CONTEXT / desk / API-Football block.
Every claim must be sourced (cite outlet/date in parentheses) OR explicitly marked Unknown.
Forbid fabricated quotes, numbers, injuries, transfers, or personal anecdotes.

Required sections (use these headings):
## Form
## Team news
## Tactics
## Key players
## Officials
## Stakes
## Must-mention (5 facts)

Under Form: last-5 / recent results if known; otherwise Unknown.
Under Team news: absences/returns ONLY if listed in context injuries or confirmed via search.
Under Tactics: formations from context + one watchpoint per side (no invented systems).
Under Key players: named players from XI/squad only.
Under Officials: referee from context; style notes only if known.
Under Stakes: competition framing with country top-flight / UEFA label (NOT sponsor name).

End with a short "Open questions / Unknowns" bullet list.`,
  },
  {
    key: "intro",
    title: "Intro script",
    description: "Fuller broadcast open — stakes, form, absentees, tactical beat, human story.",
    section: "intro",
    order: 2,
    prompt: `${HOUSE_RULES}

Write a FULLER BROADCAST OPEN / INTRO SCRIPT for an unofficial broadcast of this match.
Target length: ~400–700 words equivalent — a scannable spoken script (not a novel).
NO invented stats. If a detail is not in context/search, omit or mark Unknown.

Use these headings (keep them in the output):
## Cold open
## Scene-set
## Stakes & form
## Key absentees
## Tactical beat
## Human story
## Hand-off

Guidance:
1) Cold open — 2–4 spoken lines that land the fixture.
2) Scene-set — teams, venue, kick-off energy; competition via country top-flight / UEFA label (NOT sponsor).
3) Stakes & form — why it matters + recent form only if known.
4) Key absentees — ONLY from provided injuries / confirmed search; else say none listed.
5) Tactical beat — ONE concrete watchpoint grounded in formations/XI (no invented tactics boards).
6) Human story — ONE grounded narrative (player/coach/club) from context/search; never invent personal drama.
7) Hand-off — bridge into lineups / first whistle.

Write in spoken prose, first person plural ("we"), ready to read on air.`,
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

Write a spoken LINEUP READ for both teams.
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
    description: "8–12 short factual on-air lines derived only from research/desk context.",
    section: "hooks",
    order: 6,
    prompt: `${HOUSE_RULES}

CRITICAL — HOOKS MUST BE DERIVED ONLY FROM THE RESEARCH / MATCH CONTEXT AND DESK FACTS ALREADY PROVIDED.
Ban invented injuries, transfers, personal stories, fake stats, and colourful fiction.
If a beat is not in context or grounded search, SKIP it. Prefer fewer true hooks over colourful fiction.

Generate 8–12 short factual on-air lines (not 15+ filler fluff).
Prefer lines tagged to real named players from the XI/squad/context.
Categories (use only when you have a real fact): openers, form/stakes, player watchpoint, tactical observation,
injury/absence (only if listed), discipline (only if known), substitution bridge, weather/venue colour (only if known), full-time.

Format:
1. [Tag — Player/Topic] Title
   Spoken line(s)

Number them. Each item: short title + 1–2 spoken lines.`,
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
