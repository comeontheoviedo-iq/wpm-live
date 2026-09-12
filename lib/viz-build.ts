/**
 * Soft-fail builders for LIVE data-viz flashes.
 * Never invent numbers. UI labels use "Advanced stats" — never provider brands.
 *
 * Catalogue + gaps: docs/DATA_VIZ_FLASH.md
 */

import { selectScoredGoals } from "./match-goals";
import type { LivePlayerStatRow } from "@/lib/live-stat-triggers";

export type ShotPoint = {
  x: number;
  y: number;
  xg: number;
  result: string;
  side: "home" | "away";
  player?: string;
  minute?: number;
};

export type VizFlashKind =
  | "shot_map"
  | "xg_race"
  | "xg_timeline"
  | "shot_outcome"
  | "xg_vs_goals"
  | "possession"
  | "shots_compare"
  | "corners_fouls"
  | "pass_pct"
  | "match_dna"
  | "leaderboard"
  | "gk_saves"
  | "goal_timeline"
  | "card_timeline"
  | "momentum_proxy";

export type StatBag = { label: string; homeValue: string | number; awayValue: string | number };

export type TimelineEvent = {
  minute: number;
  side: "home" | "away";
  type: string;
  label?: string;
};

export type MomentumSample = {
  at: number;
  homePoss: number | null;
  homeShots: number | null;
  awayShots: number | null;
  homeScore: number;
  awayScore: number;
};

export type LeaderboardRow = {
  name: string;
  value: number;
  side: "home" | "away";
};

export type CompareStat = {
  label: string;
  home: number;
  away: number;
};

export type VizPayload = {
  kind: VizFlashKind;
  shots?: ShotPoint[];
  homeXg?: number | null;
  awayXg?: number | null;
  homeGoals?: number | null;
  awayGoals?: number | null;
  possessionSamples?: number[];
  compare?: CompareStat[];
  compareTitle?: string;
  dna?: CompareStat[];
  leaderboard?: LeaderboardRow[];
  leaderboardTitle?: string;
  gkName?: string;
  gkSaves?: number;
  gkSide?: "home" | "away";
  timelineEvents?: TimelineEvent[];
  timelineTitle?: string;
  momentumSamples?: MomentumSample[];
};

export type VizBags = {
  shots?: ShotPoint[];
  homeXg?: number | null;
  awayXg?: number | null;
  homeGoals?: number | null;
  awayGoals?: number | null;
  possessionSamples?: number[];
  statistics?: StatBag[];
  events?: { minute: number; type: string; teamSide: string | null; description?: string }[];
  livePlayerStats?: LivePlayerStatRow[];
  momentumSamples?: MomentumSample[];
  /** Prefer this player for GK / leaderboard focus */
  focusAfPlayerId?: number | null;
  focusStat?: string | null;
};

function parseNum(v: string | number | null | undefined): number | null {
  if (v == null || v === "—") return null;
  const n = Number(String(v).replace("%", "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function findStat(stats: StatBag[] | undefined, re: RegExp): StatBag | null {
  if (!stats?.length) return null;
  return stats.find((s) => re.test(s.label)) || null;
}

function pair(stats: StatBag[] | undefined, re: RegExp): CompareStat | null {
  const row = findStat(stats, re);
  if (!row) return null;
  const home = parseNum(row.homeValue);
  const away = parseNum(row.awayValue);
  if (home == null || away == null) return null;
  return { label: row.label, home, away };
}

/** Pass accuracy % from Total passes + Passes accurate when both exist. */
export function passPctPair(stats: StatBag[] | undefined): CompareStat | null {
  const total = findStat(stats, /total passes/i);
  const acc = findStat(stats, /passes accurate/i);
  if (!total || !acc) return null;
  const th = parseNum(total.homeValue);
  const ta = parseNum(total.awayValue);
  const ah = parseNum(acc.homeValue);
  const aa = parseNum(acc.awayValue);
  if (th == null || ta == null || ah == null || aa == null) return null;
  if (th <= 0 || ta <= 0) return null;
  return {
    label: "Pass %",
    home: Math.round((ah / th) * 1000) / 10,
    away: Math.round((aa / ta) * 1000) / 10,
  };
}

export function buildShotMap(bags: VizBags): VizPayload | null {
  if (!bags.shots?.length) return null;
  return {
    kind: "shot_map",
    shots: bags.shots,
    homeXg: bags.homeXg ?? null,
    awayXg: bags.awayXg ?? null,
  };
}

export function buildXgRace(bags: VizBags): VizPayload | null {
  if (bags.homeXg == null || bags.awayXg == null) return null;
  return {
    kind: "xg_race",
    homeXg: bags.homeXg,
    awayXg: bags.awayXg,
    shots: bags.shots,
  };
}

/** Cumulative xG over minutes — needs shot minutes. */
export function buildXgTimeline(bags: VizBags): VizPayload | null {
  const withMin = (bags.shots || []).filter(
    (s) => typeof s.minute === "number" && Number.isFinite(s.minute) && Number.isFinite(s.xg)
  );
  if (withMin.length < 2) return null;
  return {
    kind: "xg_timeline",
    shots: withMin,
    homeXg: bags.homeXg ?? null,
    awayXg: bags.awayXg ?? null,
  };
}

export function buildShotOutcome(bags: VizBags): VizPayload | null {
  if (!bags.shots?.length) return null;
  // Need at least two outcome buckets with counts
  const buckets = new Map<string, number>();
  for (const s of bags.shots) {
    const r = (s.result || "").toLowerCase();
    let key = "Other";
    if (/goal/.test(r)) key = "Goal";
    else if (/saved|on.?target|shoton/.test(r)) key = "On target";
    else if (/block/.test(r)) key = "Blocked";
    else if (/miss|off|wood|wide/.test(r)) key = "Off target";
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  if (buckets.size < 2) return null;
  return { kind: "shot_outcome", shots: bags.shots };
}

export function buildXgVsGoals(bags: VizBags): VizPayload | null {
  if (bags.homeXg == null || bags.awayXg == null) return null;
  if (bags.homeGoals == null || bags.awayGoals == null) return null;
  return {
    kind: "xg_vs_goals",
    homeXg: bags.homeXg,
    awayXg: bags.awayXg,
    homeGoals: bags.homeGoals,
    awayGoals: bags.awayGoals,
  };
}

export function buildPossession(bags: VizBags): VizPayload | null {
  if ((bags.possessionSamples?.length || 0) >= 2) {
    return { kind: "possession", possessionSamples: [...bags.possessionSamples!] };
  }
  const poss = pair(bags.statistics, /possession/i);
  if (!poss) return null;
  // Single snapshot → dual bar via compare under possession kind still works via sparkline soft message;
  // expose as shots_compare-style dual via possession with one synthetic? Prefer dedicated dual:
  return {
    kind: "possession",
    possessionSamples: [poss.home], // length 1 → component shows dual bar fallback
    compare: [poss],
  };
}

export function buildShotsCompare(bags: VizBags): VizPayload | null {
  const total = pair(bags.statistics, /^shots$/i) || pair(bags.statistics, /total shots/i);
  const on = pair(bags.statistics, /shots on (goal|target)/i);
  const rows = [total, on].filter(Boolean) as CompareStat[];
  if (!rows.length) return null;
  return { kind: "shots_compare", compare: rows, compareTitle: "Shots" };
}

export function buildCornersFouls(bags: VizBags): VizPayload | null {
  const corners = pair(bags.statistics, /corner/i);
  const fouls =
    pair(bags.statistics, /^fouls$/i) || pair(bags.statistics, /fouls committed/i);
  const rows = [corners, fouls].filter(Boolean) as CompareStat[];
  if (!rows.length) return null;
  return { kind: "corners_fouls", compare: rows, compareTitle: "Corners & fouls" };
}

export function buildPassPct(bags: VizBags): VizPayload | null {
  const pct = passPctPair(bags.statistics);
  if (!pct) return null;
  return { kind: "pass_pct", compare: [pct], compareTitle: "Pass accuracy" };
}

export function buildMatchDna(bags: VizBags): VizPayload | null {
  const poss = pair(bags.statistics, /possession/i);
  const shots = pair(bags.statistics, /^shots$/i) || pair(bags.statistics, /total shots/i);
  const sot = pair(bags.statistics, /shots on (goal|target)/i);
  const corners = pair(bags.statistics, /corner/i);
  const fouls =
    pair(bags.statistics, /^fouls$/i) || pair(bags.statistics, /fouls committed/i);
  const dna = [
    poss ? { label: "Poss %", home: poss.home, away: poss.away } : null,
    shots ? { label: "Shots", home: shots.home, away: shots.away } : null,
    sot ? { label: "SOT", home: sot.home, away: sot.away } : null,
    corners ? { label: "Corners", home: corners.home, away: corners.away } : null,
    fouls ? { label: "Fouls", home: fouls.home, away: fouls.away } : null,
  ].filter(Boolean) as CompareStat[];
  if (dna.length < 3) return null;
  return { kind: "match_dna", dna };
}

const LB_FIELDS: {
  stat: string;
  title: string;
  pick: (r: LivePlayerStatRow) => number | null;
}[] = [
  { stat: "keyPasses", title: "Key passes", pick: (r) => r.keyPasses },
  { stat: "shotsOn", title: "Shots on target", pick: (r) => r.shotsOn },
  { stat: "duelsWon", title: "Duels won", pick: (r) => r.duelsWon },
  { stat: "tackles", title: "Tackles", pick: (r) => r.tackles },
  { stat: "saves", title: "Saves", pick: (r) => r.saves },
  { stat: "dribblesSuccess", title: "Successful dribbles", pick: (r) => r.dribblesSuccess },
];

export function buildLeaderboard(bags: VizBags): VizPayload | null {
  const rows = bags.livePlayerStats || [];
  if (!rows.length) return null;
  const prefer = bags.focusStat || "keyPasses";
  const field = LB_FIELDS.find((f) => f.stat === prefer) || LB_FIELDS[0]!;
  const ranked = rows
    .map((r) => {
      const v = field.pick(r);
      if (v == null || v <= 0) return null;
      return { name: r.name, value: v, side: r.teamSide as "home" | "away" };
    })
    .filter(Boolean) as LeaderboardRow[];
  ranked.sort((a, b) => b.value - a.value);
  const top = ranked.slice(0, 5);
  if (!top.length) return null;
  return {
    kind: "leaderboard",
    leaderboard: top,
    leaderboardTitle: field.title,
  };
}

export function buildGkSaves(bags: VizBags): VizPayload | null {
  const rows = bags.livePlayerStats || [];
  const withSaves = rows
    .filter((r) => r.saves != null && r.saves > 0)
    .sort((a, b) => (b.saves || 0) - (a.saves || 0));
  let pick = withSaves[0];
  if (bags.focusAfPlayerId != null) {
    pick = withSaves.find((r) => r.afPlayerId === bags.focusAfPlayerId) || pick;
  }
  if (!pick || pick.saves == null) {
    // Fall back to team GK saves statistic
    const team = pair(bags.statistics, /goalkeeper saves|saves/i);
    if (!team) return null;
    const side = team.home >= team.away ? "home" : "away";
    return {
      kind: "gk_saves",
      gkName: side === "home" ? "Home GK" : "Away GK",
      gkSaves: side === "home" ? team.home : team.away,
      gkSide: side,
      compare: [team],
      compareTitle: "Goalkeeper saves",
    };
  }
  return {
    kind: "gk_saves",
    gkName: pick.name,
    gkSaves: pick.saves,
    gkSide: pick.teamSide,
  };
}

function mapSide(side: string | null): "home" | "away" | null {
  if (side === "home" || side === "away") return side;
  return null;
}

export function buildGoalTimeline(bags: VizBags): VizPayload | null {
  const goals = selectScoredGoals(bags.events || [])
    .map((e) => {
      const side = mapSide(e.teamSide);
      if (side == null || !Number.isFinite(e.minute)) return null;
      return {
        minute: e.minute,
        side,
        type: e.type,
        label: e.description,
      } as TimelineEvent;
    })
    .filter(Boolean) as TimelineEvent[];
  if (!goals.length) return null;
  return { kind: "goal_timeline", timelineEvents: goals, timelineTitle: "Goals" };
}

export function buildCardTimeline(bags: VizBags): VizPayload | null {
  const cards = (bags.events || [])
    .filter((e) => /yellow|red/i.test(e.type || ""))
    .map((e) => {
      const side = mapSide(e.teamSide);
      if (side == null || !Number.isFinite(e.minute)) return null;
      return {
        minute: e.minute,
        side,
        type: e.type,
        label: e.description,
      } as TimelineEvent;
    })
    .filter(Boolean) as TimelineEvent[];
  if (!cards.length) return null;
  return { kind: "card_timeline", timelineEvents: cards, timelineTitle: "Cards" };
}

export function buildMomentumProxy(bags: VizBags): VizPayload | null {
  const samples = bags.momentumSamples || [];
  if (samples.length >= 2) {
    return { kind: "momentum_proxy", momentumSamples: [...samples] };
  }
  // Soft single-point from current stats + score
  const shots = pair(bags.statistics, /total shots/i) || pair(bags.statistics, /^shots$/i);
  const poss = pair(bags.statistics, /possession/i);
  if (!shots && !poss) return null;
  if (bags.homeGoals == null || bags.awayGoals == null) return null;
  return {
    kind: "momentum_proxy",
    momentumSamples: [
      {
        at: 0,
        homePoss: poss?.home ?? null,
        homeShots: shots?.home ?? null,
        awayShots: shots?.away ?? null,
        homeScore: bags.homeGoals,
        awayScore: bags.awayGoals,
      },
    ],
    compare: [poss, shots].filter(Boolean) as CompareStat[],
  };
}

type Builder = (bags: VizBags) => VizPayload | null;

const BUILDERS: Record<VizFlashKind, Builder> = {
  shot_map: buildShotMap,
  xg_race: buildXgRace,
  xg_timeline: buildXgTimeline,
  shot_outcome: buildShotOutcome,
  xg_vs_goals: buildXgVsGoals,
  possession: buildPossession,
  shots_compare: buildShotsCompare,
  corners_fouls: buildCornersFouls,
  pass_pct: buildPassPct,
  match_dna: buildMatchDna,
  leaderboard: buildLeaderboard,
  gk_saves: buildGkSaves,
  goal_timeline: buildGoalTimeline,
  card_timeline: buildCardTimeline,
  momentum_proxy: buildMomentumProxy,
};

/** Preference chains per trigger context — rotate variety, soft-fail down the list. */
export const VIZ_CHAINS: Record<string, VizFlashKind[]> = {
  goal: ["shot_map", "goal_timeline", "xg_race", "xg_vs_goals", "xg_timeline", "shot_outcome"],
  ht: ["xg_race", "match_dna", "xg_timeline", "shot_outcome", "xg_vs_goals", "shots_compare", "possession"],
  moment: ["possession", "shots_compare", "momentum_proxy", "corners_fouls", "pass_pct", "match_dna"],
  card: ["card_timeline", "match_dna", "corners_fouls"],
  shotsOn: ["leaderboard", "shot_map", "shots_compare"],
  keyPasses: ["leaderboard", "shot_map"],
  saves: ["gk_saves", "leaderboard"],
  duelsWon: ["leaderboard"],
  tackles: ["leaderboard"],
  dribblesSuccess: ["leaderboard"],
  foulsCommitted: ["corners_fouls", "leaderboard"],
  possessionSwing: ["possession", "momentum_proxy", "match_dna"],
  shotDiff: ["shots_compare", "shot_map", "momentum_proxy"],
  default: [
    "match_dna",
    "shots_compare",
    "possession",
    "xg_race",
    "shot_map",
    "corners_fouls",
    "pass_pct",
    "goal_timeline",
  ],
};

export function buildViz(
  kind: VizFlashKind,
  bags: VizBags
): VizPayload | null {
  const fn = BUILDERS[kind];
  if (!fn) return null;
  try {
    return fn(bags);
  } catch {
    return null;
  }
}

/**
 * Pick first buildable viz from prefer + chain, skipping recently shown kinds
 * when an alternative is available (dedupe spam / rotate variety).
 */
export function pickViz(opts: {
  prefer?: VizFlashKind | null;
  context?: string;
  bags: VizBags;
  recentKinds?: VizFlashKind[];
}): VizPayload | null {
  const chain = [
    ...(opts.prefer ? [opts.prefer] : []),
    ...((opts.context && VIZ_CHAINS[opts.context]) || VIZ_CHAINS.default),
  ];
  const recent = new Set(opts.recentKinds || []);
  const seen = new Set<VizFlashKind>();
  const ordered: VizFlashKind[] = [];
  for (const k of chain) {
    if (seen.has(k)) continue;
    seen.add(k);
    ordered.push(k);
  }
  // Prefer non-recent first, then allow recent as last resort
  const pass1 = ordered.filter((k) => !recent.has(k));
  const pass2 = ordered.filter((k) => recent.has(k));
  for (const k of [...pass1, ...pass2]) {
    const v = buildViz(k, opts.bags);
    if (v) return v;
  }
  return null;
}

export const ALL_VIZ_KINDS = Object.keys(BUILDERS) as VizFlashKind[];
