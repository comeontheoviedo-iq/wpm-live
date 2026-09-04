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
3) Be accurate, vivid, and usable live. Short paragraphs. No invented stats — mark unknowns clearly.
4) Tone: professional radio/stream commentary, warm, not hype-spam.
`.trim();

export const PACK_TEMPLATE_SEEDS: PackTemplateSeed[] = [
  {
    key: "research",
    title: "Research pack",
    description: "Form, stakes, storylines, and tactical watchpoints.",
    section: "research",
    order: 1,
    prompt: `${HOUSE_RULES}

Write a RESEARCH PACK for this fixture.
Include:
- Competition context (use country top-flight label when applicable)
- Form & stakes (last 5 if known; otherwise mark unknown)
- Head-to-head / narrative hooks
- Tactical watchpoints for each side
- Key absences / returning players
- 5 "must mention" facts for open/close
Keep it scannable with headings.`,
  },
  {
    key: "intro",
    title: "Intro script",
    description: "Cold open + scene-set with unofficial + top-flight house rules.",
    section: "intro",
    order: 2,
    prompt: `${HOUSE_RULES}

Write a 90–120 second INTRO SCRIPT for an unofficial broadcast of this match.
Structure:
1) Cold open hook (1–2 lines)
2) Teams, venue, kick-off energy
3) Competition framing using the country top-flight / UEFA label (NOT sponsor name)
4) One storyline per side
5) Hand-off into lineups / first whistle
Write in spoken prose, first person plural ("we"), ready to read on air.`,
  },
  {
    key: "profiles",
    title: "Player profiles",
    description: "Full profiles for starters + impact bench.",
    section: "profiles",
    order: 3,
    prompt: `${HOUSE_RULES}

Produce FULL PLAYER PROFILES for the likely/confirmed starting XIs and 3 impact substitutes per side.
For each player: name, role, 2–3 sentence profile (style, season note, watchpoint), plus one live "call" tip.
If a player is unknown, write a short honest placeholder rather than inventing career history.
Group by team.`,
  },
  {
    key: "referee",
    title: "Referee paragraph",
    description: "On-air referee intro paragraph.",
    section: "referee",
    order: 4,
    prompt: `${HOUSE_RULES}

Write a single ready-to-read REFEREE PARAGRAPH (4–6 sentences) covering the referee and assistants if known.
Include style notes only when known; otherwise keep it clean and factual. End with a line that hands back to the action.`,
  },
  {
    key: "lineup",
    title: "Lineup read",
    description: "Spoken lineup read for both XIs.",
    section: "lineup",
    order: 5,
    prompt: `${HOUSE_RULES}

Write a spoken LINEUP READ for both teams.
- Start with formation for each side
- Read numbers + surnames in a natural radio cadence
- Note captain and any standout selection
- Flag predicted vs confirmed if status is not confirmed
Keep it under 90 seconds spoken.`,
  },
  {
    key: "hooks",
    title: "Hooks & fillers (15+)",
    description: "Fifteen-plus live hooks, fillers, and bridges.",
    section: "hooks",
    order: 6,
    prompt: `${HOUSE_RULES}

Generate at least 15 HOOKS / FILLERS for live use.
Categories: openers, after-goal, after-miss, discipline, substitution, weather/venue colour, tactical observation, crowd, injury pause, full-time.
Number them. Each item: short title + 1–2 spoken lines.
Do not invent fake stats; prefer flexible language.`,
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
