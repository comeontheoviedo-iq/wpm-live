/**
 * Lineup source badge + meta helpers for commentator desk chrome.
 * Official | Predicted | Last XI — never style Predicted/Last like Official.
 */

export type LineupSourceKind = "official" | "predicted" | "last_xi";

export type LineupSourceMeta = {
  competitionShort?: string | null;
  dateIso?: string | null;
  fixtureId?: number | null;
  homeFixtureId?: number | null;
  awayFixtureId?: number | null;
  lastXiCompetitionMismatch?: boolean;
  warning?: string | null;
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
}): LineupSourceKind {
  const src = String(opts.lineupSource || "").trim().toLowerCase();
  if (src === "official" || src === "predicted" || src === "last_xi") {
    return src;
  }
  const st = String(opts.lineupStatus || "").trim().toLowerCase();
  if (st === "confirmed") return "official";
  if (st === "predicted") return "predicted";
  return "last_xi";
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

/** Badge label: Official | Predicted | Last XI · Serie A · Sun 13 Sep */
export function lineupSourceBadgeLabel(opts: {
  kind: LineupSourceKind;
  meta?: LineupSourceMeta | null;
}): string {
  if (opts.kind === "official") return "Official";
  if (opts.kind === "predicted") return "Predicted";
  const parts = ["Last XI"];
  const comp = (opts.meta?.competitionShort || "").trim();
  if (comp) parts.push(comp);
  const dt = formatLastXiDate(opts.meta?.dateIso || null);
  if (dt) parts.push(dt);
  return parts.join(" · ");
}

/** Tailwind classes — Official emerald; Predicted sky; Last XI amber. Never style non-Official like Official. */
export function lineupSourceBadgeClass(kind: LineupSourceKind): string {
  if (kind === "official") return "bg-emerald-600 text-white";
  if (kind === "predicted") return "bg-sky-600 text-white";
  return "bg-amber-500 text-white";
}

export function deriveLineupSourceFromPlan(opts: {
  action: string;
  lineupStatus: string;
  appliedLastXi?: boolean;
}): { lineupSource: LineupSourceKind; lineupStatus: string } {
  if (opts.action === "confirm" || opts.lineupStatus === "confirmed") {
    return { lineupSource: "official", lineupStatus: "confirmed" };
  }
  if (opts.action === "keep_predicted" || opts.lineupStatus === "predicted") {
    return { lineupSource: "predicted", lineupStatus: "predicted" };
  }
  if (opts.action === "fallback_last_xi" || opts.appliedLastXi) {
    return { lineupSource: "last_xi", lineupStatus: "expected" };
  }
  // keep — preserve caller status mapping
  return {
    lineupSource: resolveLineupSourceKind({ lineupStatus: opts.lineupStatus }),
    lineupStatus: opts.lineupStatus,
  };
}
