/**
 * Factual 2nd-half intro script from first-half desk events.
 * Co-pilot tone for Scripts — no invented colour.
 */

export type Ht2hEvent = {
  type: string;
  minute: number;
  description: string;
  teamSide?: string | null;
};

function sideLabel(
  side: string | null | undefined,
  homeName: string,
  awayName: string
): string {
  if (side === "home") return homeName;
  if (side === "away") return awayName;
  return "";
}

/** Prefer events at/before HT (minute <= 45 + stoppage buffer, or type halftime). */
export function firstHalfEvents(events: Ht2hEvent[]): Ht2hEvent[] {
  const sorted = [...events].sort(
    (a, b) => a.minute - b.minute || a.description.localeCompare(b.description)
  );
  const htIdx = sorted.findIndex((e) => /halftime|half.?time/i.test(e.type || ""));
  if (htIdx >= 0) return sorted.slice(0, htIdx + 1);
  // No explicit HT row — take up to 45'+ buffer (AF sometimes posts 45+3 as 48)
  return sorted.filter((e) => e.minute <= 50);
}

export function buildHt2hIntroScript(opts: {
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  competition: string;
  events: Ht2hEvent[];
  homeFormation?: string | null;
  awayFormation?: string | null;
}): string {
  const {
    homeName,
    awayName,
    homeScore,
    awayScore,
    competition,
    events,
    homeFormation,
    awayFormation,
  } = opts;

  const fh = firstHalfEvents(events);
  const goals = fh.filter((e) =>
    /^(goal|penalty_goal|own_goal)$/i.test(e.type || "")
  );
  const yellows = fh.filter((e) => /yellow/i.test(e.type || ""));
  const reds = fh.filter((e) => /red/i.test(e.type || ""));
  const pens = fh.filter((e) => /penalty/i.test(e.type || ""));
  const vars = fh.filter((e) => /var/i.test(e.type || ""));
  const subs = fh.filter((e) => /^sub$/i.test(e.type || ""));

  const lines: string[] = [];
  lines.push(`2nd half intro · ${homeName} vs ${awayName} · ${competition}`);
  lines.push("");
  lines.push(
    `Half-time score: ${homeName} ${homeScore}–${awayScore} ${awayName}.`
  );
  lines.push("");

  if (goals.length) {
    lines.push("First-half goals (desk feed):");
    for (const g of goals) {
      const side = sideLabel(g.teamSide, homeName, awayName);
      lines.push(
        `  ${g.minute}' — ${g.description}${side ? ` · ${side}` : ""}`
      );
    }
  } else {
    lines.push("First half: no goals on the desk feed.");
  }
  lines.push("");

  if (yellows.length || reds.length) {
    lines.push(
      `Cards so far: ${yellows.length} yellow${yellows.length === 1 ? "" : "s"}, ${reds.length} red${reds.length === 1 ? "" : "s"}.`
    );
    for (const c of [...reds, ...yellows].slice(0, 8)) {
      const side = sideLabel(c.teamSide, homeName, awayName);
      lines.push(
        `  ${c.minute}' ${c.type.replace(/_/g, " ")} — ${c.description}${side ? ` · ${side}` : ""}`
      );
    }
    lines.push("");
  }

  if (pens.length) {
    lines.push("Penalty / spot-kick moments:");
    for (const p of pens.slice(0, 6)) {
      lines.push(`  ${p.minute}' — ${p.description}`);
    }
    lines.push("");
  }

  if (vars.length) {
    lines.push("VAR checks logged:");
    for (const v of vars.slice(0, 4)) {
      lines.push(`  ${v.minute}' — ${v.description}`);
    }
    lines.push("");
  }

  if (subs.length) {
    lines.push("First-half changes:");
    for (const s of subs.slice(0, 6)) {
      const side = sideLabel(s.teamSide, homeName, awayName);
      lines.push(
        `  ${s.minute}' — ${s.description}${side ? ` · ${side}` : ""}`
      );
    }
    lines.push("");
  }

  if (homeFormation || awayFormation) {
    lines.push(
      `Shapes into the break: ${homeName} ${homeFormation || "—"} · ${awayName} ${awayFormation || "—"}.`
    );
    lines.push("");
  }

  lines.push("Into the second half — watch:");
  if (homeScore === awayScore) {
    lines.push(
      `  · Level at ${homeScore}–${awayScore}; first goal after the restart swings the desk narrative.`
    );
  } else if (homeScore > awayScore) {
    lines.push(
      `  · ${homeName} lead ${homeScore}–${awayScore}; can ${awayName} respond after the break?`
    );
  } else {
    lines.push(
      `  · ${awayName} lead ${awayScore}–${homeScore}; ${homeName} need a response in the second half.`
    );
  }
  if (reds.length) {
    lines.push("  · Red card already — numerical advantage / damage limitation shapes 2H.");
  }
  lines.push("");
  lines.push(
    "— End 2H intro (first-half desk facts only; add Notebook colour live)."
  );
  return lines.join("\n");
}
