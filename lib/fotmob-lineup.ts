/**
 * Silent FotMob XI verify + one-tap Apply (prep/live desks).
 *
 * Server-side fetch only. Soft-fail on 403/429. Aggressive short cache.
 * Confirmed Official = lineupType "standard" (source often enetpulse).
 * Predicted = lastStarting11 / lastStartingLineups — never Apply.
 *
 * After Apply we set Official + xiFeedFrozen reason=fotmob_apply so the next
 * AF sync cannot wipe pre-KO (planLineupApply would otherwise fallback_last_xi).
 * Unlock / Re-pull Official clears freeze as usual.
 */

import {
  matchSquadPlayer,
  namesLooselyMatch,
  normalizePlayerKey,
  significantNameTokens,
} from "./player-name";
import { coerceValidSlotIds, normalizeFormation, slotsFor } from "./formations";

export const FOTMOB_APPLY_WINDOW_MIN = 30;
/** Poll window for silent verify badge (not Apply). */
export const FOTMOB_POLL_WINDOW_MIN = 180;
export const FOTMOB_CACHE_TTL_MS = 90_000;
export const FOTMOB_FEED_FREEZE_REASON = "fotmob_apply";

const FOTMOB_UA =
  "Mozilla/5.0 (compatible; CoCommsVerify/1.0; +https://cocomms.online)";

export type FotMobLineupClass = "confirmed" | "predicted" | "none";

export type FotMobStarter = {
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  shirtNumber?: number | null;
  /** Synthetic AF-like grid "row:col" from verticalLayout when present */
  grid?: string | null;
  positionHint?: string | null;
};

export type FotMobSideLineup = {
  name: string;
  formation: string | null;
  starters: FotMobStarter[];
};

export type FotMobNormalizedLineup = {
  fotmobMatchId: number;
  lineupType: string | null;
  source: string | null;
  classification: FotMobLineupClass;
  home: FotMobSideLineup;
  away: FotMobSideLineup;
  fetchedAt: string;
};

export type FotMobVerifyStatus =
  | "matches"
  | "fotmob_official_ours_predicted"
  | "mismatch"
  | "fotmob_pending"
  | "fotmob_unavailable"
  | "desk_inactive"
  | "outside_poll_window";

export type FotMobDiffSide = {
  ours: string[];
  fotmob: string[];
  onlyOurs: string[];
  onlyFotmob: string[];
  matched: string[];
};

export type FotMobVerifyResult = {
  status: FotMobVerifyStatus;
  statusLabel: string;
  fotmobConfirmed: boolean;
  minutesToKickoff: number | null;
  canApply: boolean;
  diff: { home: FotMobDiffSide; away: FotMobDiffSide } | null;
  formations: {
    ours: { home: string | null; away: string | null };
    fotmob: { home: string | null; away: string | null };
  } | null;
  fetchedAt: string | null;
  fotmobMatchId: number | null;
  error?: string | null;
  deskActive: boolean;
  withinApplyWindow: boolean;
};

type CacheEntry<T> = { at: number; value: T };
const detailsCache = new Map<number, CacheEntry<FotMobNormalizedLineup | { error: string; http?: number }>>();
const dateMatchesCache = new Map<string, CacheEntry<FotMobDateMatch[]>>();

export type FotMobDateMatch = {
  id: number;
  homeName: string;
  awayName: string;
  utcTime: string | null;
  leagueName: string | null;
};

/** Prep/live commentary desk — not FT / cancelled. */
export function isActiveCommentaryDesk(status: string | null | undefined): boolean {
  const s = String(status || "").trim();
  if (!s) return false;
  const lower = s.toLowerCase();
  if (
    lower.includes("full time") ||
    lower === "ft" ||
    lower.includes("cancel") ||
    lower.includes("postpone") ||
    lower.includes("abandon") ||
    lower.includes("suspend")
  ) {
    return false;
  }
  return (
    s === "Assigned" ||
    s === "Preparation" ||
    s === "Ready" ||
    s === "Live" ||
    s === "Half Time" ||
    s === "Not Started" ||
    s === "Scheduled" ||
    lower === "1h" ||
    lower === "2h" ||
    lower.includes("live") ||
    lower.includes("half")
  );
}

export function minutesToKickoff(
  kickoff: Date | string | null | undefined,
  now: Date = new Date()
): number | null {
  if (!kickoff) return null;
  const d = typeof kickoff === "string" ? new Date(kickoff) : kickoff;
  if (Number.isNaN(d.getTime())) return null;
  return (d.getTime() - now.getTime()) / 60_000;
}

/** T−30 … kickoff (inclusive). Hide Apply once kickoff passed. */
export function withinFotMobApplyWindow(
  kickoff: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  const m = minutesToKickoff(kickoff, now);
  if (m == null) return false;
  return m >= 0 && m <= FOTMOB_APPLY_WINDOW_MIN;
}

export function withinFotMobPollWindow(
  kickoff: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  const m = minutesToKickoff(kickoff, now);
  if (m == null) return false;
  // Poll from 3h before KO until shortly after KO (badge may still help at 0')
  return m <= FOTMOB_POLL_WINDOW_MIN && m >= -15;
}

export function classifyFotMobLineup(opts: {
  lineupType?: string | null;
  source?: string | null;
  homeStarters?: number;
  awayStarters?: number;
}): FotMobLineupClass {
  const type = String(opts.lineupType || "").trim();
  const source = String(opts.source || "").trim();
  const homeN = opts.homeStarters ?? 0;
  const awayN = opts.awayStarters ?? 0;
  if (!type && homeN < 11 && awayN < 11) return "none";

  const predicted =
    type === "lastStarting11" ||
    type === "lastStartingLineups" ||
    source === "lastStartingLineups" ||
    /last.?start/i.test(type) ||
    /last.?start/i.test(source);

  if (predicted) return "predicted";

  if (type === "standard" || type === "confirmed" || type === "official") {
    if (homeN >= 11 && awayN >= 11) return "confirmed";
    return homeN + awayN > 0 ? "predicted" : "none";
  }

  // Unknown type with full XI + enetpulse → treat as confirmed (bake-off pattern)
  if (
    homeN >= 11 &&
    awayN >= 11 &&
    /enetpulse/i.test(source) &&
    type &&
    !predicted
  ) {
    return "confirmed";
  }

  if (homeN >= 11 && awayN >= 11 && type) return "predicted";
  return "none";
}

export function surnameKey(name: string): string {
  const toks = significantNameTokens(name);
  return toks[toks.length - 1] || normalizePlayerKey(name);
}

export function starterSurnameSet(names: string[]): Set<string> {
  return new Set(names.map(surnameKey).filter((s) => s.length >= 2));
}

export function compareStarterSurnames(
  ours: string[],
  fotmob: string[]
): FotMobDiffSide {
  const ourKeys = ours.map((n) => ({ name: n, key: surnameKey(n) }));
  const fmKeys = fotmob.map((n) => ({ name: n, key: surnameKey(n) }));
  const ourSet = new Set(ourKeys.map((x) => x.key).filter(Boolean));
  const fmSet = new Set(fmKeys.map((x) => x.key).filter(Boolean));
  const matched = [...ourSet].filter((k) => fmSet.has(k));
  const onlyOurs = ourKeys
    .filter((x) => x.key && !fmSet.has(x.key))
    .map((x) => x.name);
  const onlyFotmob = fmKeys
    .filter((x) => x.key && !ourSet.has(x.key))
    .map((x) => x.name);
  return {
    ours: ours,
    fotmob: fotmob,
    onlyOurs,
    onlyFotmob,
    matched,
  };
}

export function sidesMatchOfficial(
  home: FotMobDiffSide,
  away: FotMobDiffSide
): boolean {
  // Match when each side has ≥9 surname overlaps and few extras
  const homeOk =
    home.matched.length >= 9 &&
    home.onlyFotmob.length <= 2 &&
    home.onlyOurs.length <= 2;
  const awayOk =
    away.matched.length >= 9 &&
    away.onlyFotmob.length <= 2 &&
    away.onlyOurs.length <= 2;
  return homeOk && awayOk;
}

export function verifyStatusLabel(status: FotMobVerifyStatus): string {
  switch (status) {
    case "matches":
      return "Matches FotMob";
    case "fotmob_official_ours_predicted":
      return "FotMob Official · ours Predicted";
    case "mismatch":
      return "Mismatch";
    case "fotmob_pending":
      return "FotMob pending";
    case "fotmob_unavailable":
      return "FotMob unavailable";
    case "desk_inactive":
      return "FotMob (desk inactive)";
    case "outside_poll_window":
      return "FotMob (outside window)";
    default:
      return "FotMob";
  }
}

export function buildVerifyResult(opts: {
  deskActive: boolean;
  kickoff: Date | string | null | undefined;
  ourLineupSourceKind: "official" | "live" | "predicted" | "last_xi";
  ourHomeStarters: string[];
  ourAwayStarters: string[];
  ourHomeFormation?: string | null;
  ourAwayFormation?: string | null;
  fotmob: FotMobNormalizedLineup | null;
  fotmobMatchId?: number | null;
  error?: string | null;
  now?: Date;
}): FotMobVerifyResult {
  const now = opts.now || new Date();
  const mins = minutesToKickoff(opts.kickoff, now);
  const withinApply = withinFotMobApplyWindow(opts.kickoff, now);
  const withinPoll = withinFotMobPollWindow(opts.kickoff, now);

  const base = {
    fotmobConfirmed: false,
    minutesToKickoff: mins,
    canApply: false,
    diff: null as FotMobVerifyResult["diff"],
    formations: null as FotMobVerifyResult["formations"],
    fetchedAt: opts.fotmob?.fetchedAt || null,
    fotmobMatchId: opts.fotmob?.fotmobMatchId ?? opts.fotmobMatchId ?? null,
    error: opts.error || null,
    deskActive: opts.deskActive,
    withinApplyWindow: withinApply,
  };

  if (!opts.deskActive) {
    const status: FotMobVerifyStatus = "desk_inactive";
    return { ...base, status, statusLabel: verifyStatusLabel(status) };
  }
  if (!withinPoll && !opts.fotmob) {
    const status: FotMobVerifyStatus = "outside_poll_window";
    return { ...base, status, statusLabel: verifyStatusLabel(status) };
  }
  if (opts.error && !opts.fotmob) {
    const status: FotMobVerifyStatus = "fotmob_unavailable";
    return { ...base, status, statusLabel: verifyStatusLabel(status) };
  }
  if (!opts.fotmob || opts.fotmob.classification === "none") {
    const status: FotMobVerifyStatus = "fotmob_pending";
    return { ...base, status, statusLabel: verifyStatusLabel(status) };
  }

  const homeDiff = compareStarterSurnames(
    opts.ourHomeStarters,
    opts.fotmob.home.starters.map((s) => s.name)
  );
  const awayDiff = compareStarterSurnames(
    opts.ourAwayStarters,
    opts.fotmob.away.starters.map((s) => s.name)
  );
  const formations = {
    ours: {
      home: opts.ourHomeFormation || null,
      away: opts.ourAwayFormation || null,
    },
    fotmob: {
      home: opts.fotmob.home.formation,
      away: opts.fotmob.away.formation,
    },
  };
  const confirmed = opts.fotmob.classification === "confirmed";
  const match = sidesMatchOfficial(homeDiff, awayDiff);
  const oursOfficial =
    opts.ourLineupSourceKind === "official" ||
    opts.ourLineupSourceKind === "live";

  let status: FotMobVerifyStatus;
  if (!confirmed) {
    status = "fotmob_pending"; // predicted sheet — treat as pending Official
  } else if (match && oursOfficial) {
    status = "matches";
  } else if (confirmed && !oursOfficial) {
    status = match ? "fotmob_official_ours_predicted" : "fotmob_official_ours_predicted";
  } else if (!match) {
    status = "mismatch";
  } else {
    status = "matches";
  }

  // Predicted FotMob with full XI: show pending (not mismatch vs our predicted)
  if (opts.fotmob.classification === "predicted") {
    status = "fotmob_pending";
  }

  const needsApply =
    confirmed &&
    (!oursOfficial || !match) &&
    withinApply &&
    opts.deskActive;

  return {
    ...base,
    status,
    statusLabel: verifyStatusLabel(status),
    fotmobConfirmed: confirmed,
    canApply: Boolean(needsApply),
    diff: { home: homeDiff, away: awayDiff },
    formations,
  };
}

function layoutToGrid(starters: {
  verticalLayout?: { x?: number; y?: number } | null;
}[]): (string | null)[] {
  const withIdx = starters.map((s, index) => ({
    index,
    y: Number(s.verticalLayout?.y),
    x: Number(s.verticalLayout?.x),
  }));
  const usable = withIdx.filter(
    (p) => Number.isFinite(p.y) && Number.isFinite(p.x)
  );
  if (usable.length < 8) return starters.map(() => null);

  // Cluster y into formation lines (tolerance 0.04)
  const sortedY = [...usable].sort((a, b) => a.y - b.y);
  const rows: number[] = [];
  const rowOf = new Map<number, number>();
  for (const p of sortedY) {
    const last = rows[rows.length - 1];
    if (last == null || Math.abs(p.y - last) > 0.04) {
      rows.push(p.y);
    }
    const rowIdx = rows.findIndex((ry) => Math.abs(p.y - ry) <= 0.04);
    rowOf.set(p.index, (rowIdx >= 0 ? rowIdx : rows.length - 1) + 1);
  }

  const byRow = new Map<number, typeof usable>();
  for (const p of usable) {
    const r = rowOf.get(p.index) || 1;
    const list = byRow.get(r) || [];
    list.push(p);
    byRow.set(r, list);
  }
  const grids: (string | null)[] = starters.map(() => null);
  for (const [r, list] of byRow) {
    list.sort((a, b) => a.x - b.x);
    list.forEach((p, i) => {
      grids[p.index] = `${r}:${i + 1}`;
    });
  }
  return grids;
}

function normalizeSide(raw: Record<string, unknown> | null | undefined): FotMobSideLineup {
  const team = raw || {};
  const formation = String(team.formation || "").trim() || null;
  const startersRaw = Array.isArray(team.starters) ? team.starters : [];
  const grids = layoutToGrid(startersRaw as { verticalLayout?: { x?: number; y?: number } }[]);
  const starters: FotMobStarter[] = startersRaw.map((row: Record<string, unknown>, i: number) => {
    const name = String(row.name || "").trim();
    const shirt = row.shirtNumber != null ? Number(row.shirtNumber) : null;
    return {
      name,
      firstName: row.firstName != null ? String(row.firstName) : null,
      lastName: row.lastName != null ? String(row.lastName) : null,
      shirtNumber: Number.isFinite(shirt as number) ? (shirt as number) : null,
      grid: grids[i],
      positionHint: row.positionId != null ? String(row.positionId) : null,
    };
  }).filter((s) => s.name);

  return {
    name: String(team.name || "").trim(),
    formation,
    starters,
  };
}

export function normalizeFotMobMatchDetails(
  raw: unknown,
  fotmobMatchId: number,
  fetchedAt: Date = new Date()
): FotMobNormalizedLineup {
  const root = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const content = (root.content && typeof root.content === "object"
    ? root.content
    : root) as Record<string, unknown>;
  const lineup = (content.lineup && typeof content.lineup === "object"
    ? content.lineup
    : {}) as Record<string, unknown>;

  const home = normalizeSide(lineup.homeTeam as Record<string, unknown>);
  const away = normalizeSide(lineup.awayTeam as Record<string, unknown>);
  const lineupType = lineup.lineupType != null ? String(lineup.lineupType) : null;
  const source = lineup.source != null ? String(lineup.source) : null;
  const classification = classifyFotMobLineup({
    lineupType,
    source,
    homeStarters: home.starters.length,
    awayStarters: away.starters.length,
  });

  return {
    fotmobMatchId,
    lineupType,
    source,
    classification,
    home,
    away,
    fetchedAt: fetchedAt.toISOString(),
  };
}

async function fotmobFetchJson(url: string): Promise<{
  ok: boolean;
  status: number;
  json: unknown | null;
  error?: string;
}> {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": FOTMOB_UA,
      },
      // Next.js / undici
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (res.status === 403 || res.status === 429) {
      return {
        ok: false,
        status: res.status,
        json: null,
        error: `FotMob blocked (${res.status})`,
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        json: null,
        error: `FotMob HTTP ${res.status}`,
      };
    }
    const json = await res.json().catch(() => null);
    if (json == null) {
      return { ok: false, status: res.status, json: null, error: "FotMob empty body" };
    }
    return { ok: true, status: res.status, json };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      json: null,
      error: e instanceof Error ? e.message : "FotMob fetch failed",
    };
  }
}

export async function fetchFotMobMatchDetails(
  fotmobMatchId: number,
  opts?: { bypassCache?: boolean }
): Promise<
  | { ok: true; lineup: FotMobNormalizedLineup }
  | { ok: false; error: string; http?: number }
> {
  const cached = detailsCache.get(fotmobMatchId);
  if (
    !opts?.bypassCache &&
    cached &&
    Date.now() - cached.at < FOTMOB_CACHE_TTL_MS
  ) {
    if ("error" in cached.value) {
      return { ok: false, error: cached.value.error, http: cached.value.http };
    }
    return { ok: true, lineup: cached.value };
  }

  const url = `https://www.fotmob.com/api/data/matchDetails?matchId=${fotmobMatchId}`;
  const res = await fotmobFetchJson(url);
  if (!res.ok || !res.json) {
    const err = { error: res.error || "FotMob unavailable", http: res.status };
    detailsCache.set(fotmobMatchId, { at: Date.now(), value: err });
    return { ok: false, ...err };
  }
  const lineup = normalizeFotMobMatchDetails(res.json, fotmobMatchId);
  detailsCache.set(fotmobMatchId, { at: Date.now(), value: lineup });
  return { ok: true, lineup };
}

function londonDateYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(d)
    .replace(/-/g, "");
}

function clubNameCandidates(name: string, shortName?: string | null): string[] {
  const out = new Set<string>();
  for (const n of [name, shortName || ""]) {
    const t = String(n || "").trim();
    if (t) out.add(t);
  }
  return [...out];
}

function teamNamesCompatible(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (namesLooselyMatch(a, b)) return true;
  const na = normalizePlayerKey(a);
  const nb = normalizePlayerKey(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Containment on significant tokens (Bayern München (W) ↔ Bayern)
  const ta = new Set(significantNameTokens(a).filter((t) => t.length >= 3));
  const tb = new Set(significantNameTokens(b).filter((t) => t.length >= 3));
  if (!ta.size || !tb.size) return false;
  let overlap = 0;
  for (const t of ta) if (tb.has(t)) overlap++;
  if (overlap >= 1 && (ta.size <= 2 || tb.size <= 2)) return true;
  if (overlap >= 2) return true;
  // Prefix / includes
  if (na.includes(nb) || nb.includes(na)) return true;
  return false;
}

export function scoreFotMobDateMatch(
  row: FotMobDateMatch,
  homeNames: string[],
  awayNames: string[],
  kickoff?: Date | null
): number {
  let score = 0;
  const homeHit = homeNames.some((n) => teamNamesCompatible(n, row.homeName));
  const awayHit = awayNames.some((n) => teamNamesCompatible(n, row.awayName));
  if (homeHit) score += 50;
  if (awayHit) score += 50;
  if (homeHit && awayHit) score += 20;
  // Swapped sides (rare)
  if (!homeHit && !awayHit) {
    const swapH = homeNames.some((n) => teamNamesCompatible(n, row.awayName));
    const swapA = awayNames.some((n) => teamNamesCompatible(n, row.homeName));
    if (swapH && swapA) score += 40;
  }
  if (kickoff && row.utcTime) {
    const t = new Date(row.utcTime).getTime();
    if (!Number.isNaN(t)) {
      const deltaMin = Math.abs(t - kickoff.getTime()) / 60_000;
      if (deltaMin <= 5) score += 30;
      else if (deltaMin <= 30) score += 15;
      else if (deltaMin <= 120) score += 5;
      else score -= 20;
    }
  }
  return score;
}

export async function fetchFotMobMatchesForDate(
  dateYmd: string
): Promise<
  | { ok: true; matches: FotMobDateMatch[] }
  | { ok: false; error: string; http?: number }
> {
  const cached = dateMatchesCache.get(dateYmd);
  if (cached && Date.now() - cached.at < FOTMOB_CACHE_TTL_MS) {
    return { ok: true, matches: cached.value };
  }
  const url = `https://www.fotmob.com/api/data/matches?date=${dateYmd}`;
  const res = await fotmobFetchJson(url);
  if (!res.ok || !res.json) {
    return { ok: false, error: res.error || "FotMob date list unavailable", http: res.status };
  }
  const root = res.json as { leagues?: { name?: string; matches?: unknown[] }[] };
  const out: FotMobDateMatch[] = [];
  for (const league of root.leagues || []) {
    for (const m of league.matches || []) {
      const row = m as {
        id?: number;
        home?: { name?: string; longName?: string };
        away?: { name?: string; longName?: string };
        status?: { utcTime?: string };
      };
      if (!row.id) continue;
      out.push({
        id: Number(row.id),
        homeName: String(row.home?.longName || row.home?.name || ""),
        awayName: String(row.away?.longName || row.away?.name || ""),
        utcTime: row.status?.utcTime || null,
        leagueName: league.name || null,
      });
    }
  }
  dateMatchesCache.set(dateYmd, { at: Date.now(), value: out });
  return { ok: true, matches: out };
}

export async function resolveFotMobMatchId(opts: {
  homeName: string;
  awayName: string;
  homeShortName?: string | null;
  awayShortName?: string | null;
  kickoff: Date;
  cachedId?: number | null;
}): Promise<
  | { ok: true; fotmobMatchId: number; resolvedVia: "cache" | "date_search" }
  | { ok: false; error: string }
> {
  if (opts.cachedId && Number.isFinite(opts.cachedId) && opts.cachedId > 0) {
    return { ok: true, fotmobMatchId: opts.cachedId, resolvedVia: "cache" };
  }
  const ymd = londonDateYmd(opts.kickoff);
  // Also try UTC date if London day differs near midnight
  const utcYmd = opts.kickoff.toISOString().slice(0, 10).replace(/-/g, "");
  const dates = [...new Set([ymd, utcYmd])];
  const homeNames = clubNameCandidates(opts.homeName, opts.homeShortName);
  const awayNames = clubNameCandidates(opts.awayName, opts.awayShortName);

  let best: { id: number; score: number } | null = null;
  let lastErr: string | null = null;
  for (const d of dates) {
    const list = await fetchFotMobMatchesForDate(d);
    if (!list.ok) {
      lastErr = list.error;
      continue;
    }
    for (const row of list.matches) {
      const score = scoreFotMobDateMatch(row, homeNames, awayNames, opts.kickoff);
      if (!best || score > best.score) best = { id: row.id, score };
    }
  }
  if (!best || best.score < 100) {
    return {
      ok: false,
      error: lastErr || "FotMob match not found for home/away + date",
    };
  }
  return { ok: true, fotmobMatchId: best.id, resolvedVia: "date_search" };
}

export type MappedStarter = {
  fotmobName: string;
  playerId: string;
  playerName: string;
  formationSlot: string;
  shirtNumber?: number | null;
};

export type UnmappedStarter = {
  fotmobName: string;
  shirtNumber?: number | null;
  reason: string;
};

export function mapFotMobStartersToClubPlayers(opts: {
  starters: FotMobStarter[];
  formation: string | null;
  fallbackFormation: string;
  clubPlayers: { id: string; name: string; shirtNumber?: number | null }[];
}): { mapped: MappedStarter[]; unmapped: UnmappedStarter[]; formation: string } {
  const formation = normalizeFormation(
    opts.formation,
    opts.fallbackFormation
  );
  const slots = slotsFor(formation);
  const usedPlayerIds = new Set<string>();
  const mapped: MappedStarter[] = [];
  const unmapped: UnmappedStarter[] = [];

  // Order starters by grid when present, else array order
  const ordered = opts.starters.map((s, index) => {
    const [rs, cs] = String(s.grid || "").split(":");
    return {
      starter: s,
      index,
      row: Number(rs) || 999,
      col: Number(cs) || index + 1,
      hasGrid: Boolean(s.grid),
    };
  });
  const gridCount = ordered.filter((o) => o.hasGrid).length;
  if (gridCount >= 8) {
    ordered.sort((a, b) => a.row - b.row || a.col - b.col);
  }

  const slotIds = coerceValidSlotIds(
    ordered.map((_, i) => slots[i]?.id || ""),
    formation
  );

  const available = opts.clubPlayers.filter((p) => !usedPlayerIds.has(p.id));

  for (let i = 0; i < ordered.length; i++) {
    const { starter } = ordered[i];
    const slot = slotIds[i] || slots[i]?.id || `S${i + 1}`;
    // Prefer shirt number + fuzzy, then matchSquadPlayer
    let hit: { id: string; name: string } | null = null;
    if (starter.shirtNumber != null) {
      const byNum = available.filter(
        (p) => p.shirtNumber === starter.shirtNumber
      );
      if (byNum.length === 1 && namesLooselyMatch(byNum[0].name, starter.name)) {
        hit = byNum[0];
      } else if (byNum.length === 1) {
        // Number unique on club — accept if surname overlaps OR only one with that number
        const sk = surnameKey(starter.name);
        if (
          surnameKey(byNum[0].name) === sk ||
          available.filter((p) => p.shirtNumber === starter.shirtNumber).length ===
            1
        ) {
          // Still require some name signal when possible
          if (
            surnameKey(byNum[0].name) === sk ||
            namesLooselyMatch(byNum[0].name, starter.name)
          ) {
            hit = byNum[0];
          }
        }
      }
    }
    if (!hit) {
      const pool = available.filter((p) => !usedPlayerIds.has(p.id));
      hit = matchSquadPlayer(starter.name, pool);
    }
    if (!hit) {
      unmapped.push({
        fotmobName: starter.name,
        shirtNumber: starter.shirtNumber,
        reason: "no_fuzzy_match_on_club_squad",
      });
      continue;
    }
    usedPlayerIds.add(hit.id);
    mapped.push({
      fotmobName: starter.name,
      playerId: hit.id,
      playerName: hit.name,
      formationSlot: slot,
      shirtNumber: starter.shirtNumber,
    });
  }

  return { mapped, unmapped, formation };
}

/** Clear cache (tests). */
export function clearFotMobCaches() {
  detailsCache.clear();
  dateMatchesCache.clear();
}
