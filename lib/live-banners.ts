/**
 * Derive live desk banners from AF-synced MatchEvent rows.
 * Soft-fail: empty/unknown AF detail → no banner (never invent).
 */

export type BannerEvent = {
  id: string;
  type: string;
  minute: number;
  description: string;
  team?: string | null;
  playerId?: string | null;
};

export type LiveBanner =
  | {
      id: string;
      kind: "var";
      tone: "violet";
      title: string;
      detail: string;
    }
  | {
      id: string;
      kind: "one_away";
      tone: "amber";
      title: string;
      detail: string;
      playerIds: string[];
    }
  | {
      id: string;
      kind: "pens";
      tone: "sky";
      title: string;
      detail: string;
    };

export type SquadLite = {
  id: string;
  name: string;
  shirtNumber: number | null;
  side: "home" | "away";
  team: string;
};

function isVar(ev: BannerEvent) {
  return (
    /^var$/i.test(ev.type || "") ||
    /\bVAR\b/i.test(ev.description || "") ||
    /video assistant/i.test(ev.description || "")
  );
}

function isYellow(ev: BannerEvent) {
  return /^yellow$/i.test(ev.type || "") || /yellow card/i.test(ev.description || "");
}

function isRed(ev: BannerEvent) {
  return /^red$/i.test(ev.type || "") || /red card|sent off/i.test(ev.description || "");
}

function isPenRelated(ev: BannerEvent) {
  return /penalty|pen_/i.test(ev.type || "") || /penalty shoot/i.test(ev.description || "");
}

/** Players currently on one yellow (not yet sent off). */
export function playersOneAway(
  events: BannerEvent[],
  squad: SquadLite[]
): { playerId: string; name: string; team: string }[] {
  const yellows = new Map<string, number>();
  const reds = new Set<string>();
  const byId = new Map(squad.map((p) => [p.id, p]));

  for (const ev of events) {
    const pid = ev.playerId || null;
    if (!pid) continue;
    if (isRed(ev)) reds.add(pid);
    if (isYellow(ev)) yellows.set(pid, (yellows.get(pid) || 0) + 1);
  }

  const out: { playerId: string; name: string; team: string }[] = [];
  for (const [pid, count] of yellows) {
    if (reds.has(pid)) continue;
    if (count !== 1) continue;
    const p = byId.get(pid);
    if (!p) continue;
    out.push({ playerId: pid, name: p.name, team: p.team });
  }
  return out;
}

export function deriveLiveBanners(opts: {
  events: BannerEvent[];
  squad: SquadLite[];
  status: string;
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  /** AF short status if known, e.g. PEN / AET */
  afStatusShort?: string | null;
}): LiveBanner[] {
  const banners: LiveBanner[] = [];
  const { events, squad, status, homeName, awayName, homeScore, awayScore } = opts;

  // Most recent VAR check still "open" — last var event without a following non-var resolution note.
  const varEvents = events.filter(isVar);
  if (varEvents.length) {
    const last = varEvents[varEvents.length - 1]!;
    const idx = events.findIndex((e) => e.id === last.id);
    const after = idx >= 0 ? events.slice(idx + 1) : [];
    const resolved = after.some(
      (e) =>
        /goal|penalty|yellow|red|sub/i.test(e.type || "") ||
        /overturn|confirmed|cancelled|disallowed|awarded/i.test(e.description || "")
    );
    // Show while LIVE and either unresolved or very recent (last event is VAR)
    const isLast = events[events.length - 1]?.id === last.id;
    if ((status === "Live" || status === "Half Time") && (isLast || !resolved)) {
      banners.push({
        id: `var-${last.id}`,
        kind: "var",
        tone: "violet",
        title: "VAR check",
        detail: `${last.minute}' · ${last.description || "Review in progress"}`.trim(),
      });
    }
  }

  const oneAway = playersOneAway(events, squad);
  if (oneAway.length && (status === "Live" || status === "Half Time")) {
    const fp = oneAway
      .map((p) => p.playerId)
      .slice()
      .sort()
      .join(",");
    banners.push({
      id: `one-away|${fp}`,
      kind: "one_away",
      tone: "amber",
      title: "One away from a sending-off",
      detail: oneAway
        .slice(0, 4)
        .map((p) => `${p.name} (${p.team})`)
        .join(" · "),
      playerIds: oneAway.map((p) => p.playerId),
    });
  }

  const penMode =
    opts.afStatusShort === "PEN" ||
    /penalty|shoot-?out/i.test(status) ||
    (status === "Full Time" && events.some(isPenRelated) && /PEN|shoot/i.test(opts.afStatusShort || ""));

  const penEvents = events.filter(isPenRelated);
  if (penMode || (status === "Live" && /shoot-?out/i.test(events.map((e) => e.description).join(" ")))) {
    banners.push({
      id: "pens",
      kind: "pens",
      tone: "sky",
      title: penMode ? "Penalty shoot-out" : "Penalty situation",
      detail:
        penEvents.length > 0
          ? `${homeName} ${homeScore}–${awayScore} ${awayName} · ${penEvents
              .slice(-3)
              .map((e) => `${e.minute}' ${e.description}`)
              .join(" · ")}`
          : `${homeName} ${homeScore}–${awayScore} ${awayName}`,
    });
  }

  return banners;
}
