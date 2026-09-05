/**
 * Enrich live flash / goal cards with relevant note snippets + key live stats.
 */

export type FlashStat = {
  label: string;
  homeValue: string | number | null;
  awayValue: string | number | null;
};

export type FlashNote = { id: string; title: string; body: string };

export function enrichFlashLines(opts: {
  baseLines: string[];
  scoreline?: string | null;
  relevantNotes?: FlashNote[];
  statistics?: FlashStat[];
  xg?: { home: number | null; away: number | null; label?: string } | null;
  maxNotes?: number;
}): string[] {
  const lines = [...opts.baseLines];
  const maxNotes = opts.maxNotes ?? 2;

  if (opts.scoreline) {
    const hasScore = lines.some((l) => /score|–|-/.test(l) && /\d/.test(l));
    if (!hasScore) lines.unshift(`Score: ${opts.scoreline}`);
  }

  const stats = opts.statistics || [];
  const onTarget = stats.find((s) => /on target|shots on/i.test(s.label));
  const poss = stats.find((s) => /possession/i.test(s.label));
  if (onTarget) {
    lines.push(`On target ${onTarget.homeValue}–${onTarget.awayValue}`);
  }
  if (poss) {
    lines.push(`Poss ${poss.homeValue}–${poss.awayValue}`);
  }
  if (opts.xg && (opts.xg.home != null || opts.xg.away != null)) {
    lines.push(
      `${opts.xg.label || "xG"} ${opts.xg.home ?? "–"}–${opts.xg.away ?? "–"}`
    );
  }

  for (const n of (opts.relevantNotes || []).slice(0, maxNotes)) {
    const snip = (n.body || n.title || "").replace(/\s+/g, " ").trim().slice(0, 120);
    if (snip) lines.push(`Note: ${snip}`);
  }

  // de-dupe exact lines
  const seen = new Set<string>();
  return lines.filter((l) => {
    const k = l.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Periodic moment flash only when fingerprint changed. */
export function shouldEmitMomentFlash(
  prevFingerprint: string | null,
  nextFingerprint: string
): boolean {
  if (!nextFingerprint) return false;
  return prevFingerprint !== nextFingerprint;
}

export function momentFingerprint(opts: {
  scoreHome: number;
  scoreAway: number;
  lastEventKey?: string | null;
  onTargetHome?: string | number | null;
  onTargetAway?: string | number | null;
}): string {
  return [
    opts.scoreHome,
    opts.scoreAway,
    opts.lastEventKey || "",
    opts.onTargetHome ?? "",
    opts.onTargetAway ?? "",
  ].join("|");
}
