/**
 * Factual full-time summary script from events + pinned hooks.
 * No invented colour — only what is on the desk.
 */

export type FtEvent = {
  type: string;
  minute: number;
  description: string;
  team?: string | null;
};

export type FtNote = {
  title: string;
  body: string;
  pinned?: boolean;
  category?: string;
};

export function buildFtSummaryScript(opts: {
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  competition: string;
  events: FtEvent[];
  pinnedNotes?: FtNote[];
  referee?: string | null;
}): string {
  const {
    homeName,
    awayName,
    homeScore,
    awayScore,
    competition,
    events,
    pinnedNotes = [],
    referee,
  } = opts;

  const goals = events.filter((e) =>
    /goal|penalty_goal|own_goal/i.test(e.type || "")
  );
  const cards = events.filter((e) => /yellow|red/i.test(e.type || ""));
  const pens = events.filter((e) => /penalty/i.test(e.type || ""));

  const lines: string[] = [];
  lines.push(
    `Full time: ${homeName} ${homeScore}–${awayScore} ${awayName} (${competition}).`
  );

  if (goals.length) {
    lines.push("Goals:");
    for (const g of goals) {
      lines.push(`  ${g.minute}' — ${g.description}${g.team ? ` (${g.team})` : ""}`);
    }
  } else {
    lines.push("No goals recorded on the desk feed.");
  }

  if (cards.length) {
    const yellows = cards.filter((c) => /yellow/i.test(c.type));
    const reds = cards.filter((c) => /red/i.test(c.type));
    lines.push(
      `Cards: ${yellows.length} yellow${yellows.length === 1 ? "" : "s"}, ${reds.length} red${reds.length === 1 ? "" : "s"}.`
    );
  }

  if (pens.length) {
    lines.push("Penalty incidents:");
    for (const p of pens.slice(0, 6)) {
      lines.push(`  ${p.minute}' — ${p.description}`);
    }
  }

  if (referee) {
    lines.push(`Referee: ${referee}.`);
  }

  const hooks = pinnedNotes
    .filter((n) => n.pinned || /hook/i.test(n.category || "") || /hook/i.test(n.title || ""))
    .slice(0, 4);
  if (hooks.length) {
    lines.push("Pinned hooks (factual desk notes):");
    for (const h of hooks) {
      const body = (h.body || "").replace(/\s+/g, " ").trim().slice(0, 160);
      lines.push(`  · ${h.title}${body ? ` — ${body}` : ""}`);
    }
  }

  lines.push(
    "— End FT pack (desk facts only; expand live colour from Notebook notes as needed)."
  );
  return lines.join("\n");
}
