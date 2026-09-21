/**
 * Lineup source badge + meta helpers for commentator desk chrome.
 * Official | Live | Predicted | Last XI — never style Predicted/Last like Official.
 * Official = kickoff named XI. Live = current pitch after substitutions.
 */

export type LineupSourceKind = "official" | "live" | "predicted" | "last_xi";

export type LineupSourceMeta = {
  competitionShort?: string | null;
  dateIso?: string | null;
  fixtureId?: number | null;
  homeFixtureId?: number | null;
  awayFixtureId?: number | null;
  lastXiCompetitionMismatch?: boolean;
  warning?: string | null;
  /** ISO when kickoff Official XI was captured / last confirmed from AF */
  officialCapturedAt?: string | null;
  /** True when board shape includes at least one applied substitution */
  liveAfterSubs?: boolean;
  /** Starter counts at last apply (verify panel) */
  homeStarters?: number | null;
  awayStarters?: number | null;
  emptySlotWarning?: string | null;
};

export function parseLineupSourceMeta(
  raw: string | null | undefined
): LineupSourceMeta | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as LineupSourceMeta;
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

export function stringifyLineupSourceMeta(meta: LineupSourceMeta | null | undefined): string | null {
  if (!meta) return null;
  try {
    return JSON.stringify(meta);
  } catch {
    return null;
  }
}

/** Map persisted lineupStatus → source kind (with optional explicit lineupSource). */
export function resolveLineupSourceKind(opts: {
  lineupSource?: string | null;
  lineupStatus?: string | null;
  matchStatus?: string | null;
  hasSubEvents?: boolean;
  meta?: LineupSourceMeta | null;
}): LineupSourceKind {
  const src = String(opts.lineupSource || "").trim().toLowerCase();
  if (src === "live") return "live";
  if (src === "predicted" || src === "last_xi") return src;
  if (src === "official") {
    return shouldShowLiveBadge(opts) ? "live" : "official";
  }
  const st = String(opts.lineupStatus || "").trim().toLowerCase();
  if (st === "predicted") return "predicted";
  if (st === "confirmed") {
    return shouldShowLiveBadge(opts) ? "live" : "official";
  }
  return "last_xi";
}

function shouldShowLiveBadge(opts: {
  matchStatus?: string | null;
  hasSubEvents?: boolean;
  meta?: LineupSourceMeta | null;
}): boolean {
  if (opts.meta?.liveAfterSubs) return true;
  if (!opts.hasSubEvents) return false;
  const ms = String(opts.matchStatus || "").toLowerCase();
  return (
    ms.includes("live") ||
    ms === "1h" ||
    ms === "2h" ||
    ms.includes("half") ||
    ms.includes("full") ||
    ms === "ft" ||
    ms === "aet" ||
    ms === "pen"
  );
}

/** Europe/London short date e.g. Sun 13 Sep */
export function formatLastXiDate(dateIso: string | Date | null | undefined): string | null {
  if (!dateIso) return null;
  const d = typeof dateIso === "string" ? new Date(dateIso) : dateIso;
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}

/** Badge label: Official | Live | Predicted | Last XI · Serie A · Sun 13 Sep */
export function lineupSourceBadgeLabel(opts: {
  kind: LineupSourceKind;
  meta?: LineupSourceMeta | null;
}): string {
  if (opts.kind === "official") return "Official";
  if (opts.kind === "live") return "Live";
  if (opts.kind === "predicted") return "Predicted";
  const parts = ["Last XI"];
  const comp = (opts.meta?.competitionShort || "").trim();
  if (comp) parts.push(comp);
  const dt = formatLastXiDate(opts.meta?.dateIso || null);
  if (dt) parts.push(dt);
  return parts.join(" · ");
}

/** Tailwind — Official emerald; Live violet; Predicted sky; Last XI amber. Never style non-Official like Official. */
export function lineupSourceBadgeClass(kind: LineupSourceKind): string {
  if (kind === "official") return "bg-emerald-600 text-white";
  if (kind === "live") return "bg-violet-600 text-white";
  if (kind === "predicted") return "bg-sky-600 text-white";
  return "bg-amber-500 text-white";
}

export function lineupSourceBadgeTitle(opts: {
  kind: LineupSourceKind;
  meta?: LineupSourceMeta | null;
}): string {
  if (opts.kind === "official") {
    return "Official kickoff named XI from the live feed";
  }
  if (opts.kind === "live") {
    return "Current pitch after substitutions — kickoff XI was Official (not a fresh Official dump)";
  }
  if (opts.kind === "predicted") {
    return "Predicted XI — NOT Official. Re-pull Official when both sides are named.";
  }
  if (opts.meta?.lastXiCompetitionMismatch) {
    return "Domestic last XI — not this competition. NOT tonight's Official.";
  }
  return "Last played XI — NOT tonight's Official.";
}

export function deriveLineupSourceFromPlan(opts: {
  action: string;
  lineupStatus: string;
  appliedLastXi?: boolean;
  liveAfterSubs?: boolean;
}): { lineupSource: LineupSourceKind; lineupStatus: string } {
  if (opts.action === "confirm" || opts.lineupStatus === "confirmed") {
    if (opts.liveAfterSubs) {
      return { lineupSource: "live", lineupStatus: "confirmed" };
    }
    return { lineupSource: "official", lineupStatus: "confirmed" };
  }
  if (opts.action === "keep_predicted" || opts.lineupStatus === "predicted") {
    return { lineupSource: "predicted", lineupStatus: "predicted" };
  }
  if (opts.action === "fallback_last_xi" || opts.appliedLastXi) {
    return { lineupSource: "last_xi", lineupStatus: "expected" };
  }
  return {
    lineupSource: resolveLineupSourceKind({
      lineupStatus: opts.lineupStatus,
      meta: opts.liveAfterSubs ? { liveAfterSubs: true } : null,
    }),
    lineupStatus: opts.lineupStatus,
  };
}

/** FotMob-style pitch grass: Official/Live = green; Predicted/Last XI = distinct non-green. */
export const PITCH_GRASS_OFFICIAL =
  "linear-gradient(180deg, rgba(0,0,0,0.12), transparent 18%, transparent 82%, rgba(0,0,0,0.14)), linear-gradient(90deg, rgba(0,0,0,0.08), transparent 10%, transparent 90%, rgba(0,0,0,0.08)), repeating-linear-gradient(90deg, #176f38 0 7.5%, #1c8240 7.5% 15%)";

/** Slate-blue stripes — clearly not matchday grass (Predicted / Last XI). */
export const PITCH_GRASS_PREDICTED =
  "linear-gradient(180deg, rgba(0,0,0,0.18), transparent 18%, transparent 82%, rgba(0,0,0,0.22)), linear-gradient(90deg, rgba(0,0,0,0.1), transparent 10%, transparent 90%, rgba(0,0,0,0.1)), repeating-linear-gradient(90deg, #1a3a5c 0 7.5%, #234b73 7.5% 15%)";

export function pitchGrassBackground(kind: LineupSourceKind): string {
  if (kind === "predicted" || kind === "last_xi") return PITCH_GRASS_PREDICTED;
  return PITCH_GRASS_OFFICIAL;
}

export function pitchFrameClass(kind: LineupSourceKind): string {
  if (kind === "predicted" || kind === "last_xi") return "border-slate-800/50";
  return "border-emerald-900/40";
}

/** Search URLs for human FotMob / SofaScore verify (no scrapers). */
export function buildLineupVerifyUrls(opts: {
  homeName: string;
  awayName: string;
  kickoffAt?: string | Date | null;
  apiFootballFixtureId?: number | null;
}): { fotmob: string; sofascore: string; query: string } {
  const home = (opts.homeName || "Home").trim();
  const away = (opts.awayName || "Away").trim();
  let dateBit = "";
  if (opts.kickoffAt) {
    const d =
      typeof opts.kickoffAt === "string"
        ? new Date(opts.kickoffAt)
        : opts.kickoffAt;
    if (!Number.isNaN(d.getTime())) {
      dateBit = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/London",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
    }
  }
  const query = [home, "vs", away, dateBit].filter(Boolean).join(" ");
  const q = encodeURIComponent(query);
  return {
    query,
    fotmob: `https://www.fotmob.com/search?q=${q}`,
    sofascore: `https://www.sofascore.com/search?q=${q}`,
  };
}
