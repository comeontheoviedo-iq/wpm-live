/**
 * Live event detail panels — goal / card / sub.
 * Factual only: prefer desk caches; never invent tallies or suspension rules.
 */

import { ordinal, liveAdjustedSeasonStat, seasonOrdinal } from "./season-tally";
import { namesLooselyMatch, parseSubDescription } from "./player-name";
import { isScoredGoalType, selectScoredGoals } from "./match-goals";
import { resolvePersonAge } from "./person-age";
import type { PlayerFormRow } from "./api-football";

export type EventDetailKind = "goal" | "yellow" | "red" | "sub";

export type EventDetailPlayerLite = {
  id: string;
  name: string;
  photoUrl?: string | null;
  apiFootballPlayerId?: number | null;
  position?: string | null;
  birthDate?: string | null;
  age?: number | null;
  goals?: number | null;
  assists?: number | null;
  goalsAllComps?: number | null;
  assistsAllComps?: number | null;
  appearances?: number | null;
  yellowCards?: number | null;
  redCards?: number | null;
  matchGoals?: number | null;
  matchAssists?: number | null;
  noteHook?: string | null;
  side?: "home" | "away";
  team?: string;
};

export type EventDetailEventLite = {
  id?: string;
  type: string;
  minute: number;
  description: string;
  teamSide?: string | null;
  playerId?: string | null;
};

/** Known yellow-accumulation first-ban thresholds (AF league id). */
export const YELLOW_SUSPENSION_THRESHOLDS: Record<
  number,
  { threshold: number; label: string }
> = {
  // Premier League / EFL: 5 yellows → 1-match ban (later bands at 10 / 15).
  39: { threshold: 5, label: "Premier League (5 yellows → first ban)" },
  40: { threshold: 5, label: "Championship (5 yellows → first ban)" },
  41: { threshold: 5, label: "League One (5 yellows → first ban)" },
  42: { threshold: 5, label: "League Two (5 yellows → first ban)" },
  45: { threshold: 5, label: "FA Cup (competition rules may vary by round)" },
  48: { threshold: 5, label: "League Cup (competition rules may vary)" },
  // La Liga / Serie A / Ligue 1 / Bundesliga commonly use 5 for first ban.
  140: { threshold: 5, label: "La Liga (typically 5 yellows → first ban)" },
  135: { threshold: 5, label: "Serie A (typically 5 yellows → first ban)" },
  61: { threshold: 5, label: "Ligue 1 (typically 5 yellows → first ban)" },
  78: { threshold: 5, label: "Bundesliga (typically 5 yellows → first ban)" },
  88: { threshold: 5, label: "Eredivisie (typically 5 yellows → first ban)" },
  203: { threshold: 4, label: "Süper Lig (typically 4 yellows → first ban)" },
  179: { threshold: 5, label: "Scottish Premiership (typically 5 → first ban)" },
  2: { threshold: 3, label: "UCL group/league phase (typically 3 → next match ban)" },
  3: { threshold: 3, label: "UEL (typically 3 → next match ban)" },
  848: { threshold: 3, label: "UECL (typically 3 → next match ban)" },
};

export function eventDetailKind(type: string): EventDetailKind | null {
  const t = String(type || "").toLowerCase();
  if (t === "goal" || t === "penalty_goal" || t === "own_goal") return "goal";
  if (t === "yellow") return "yellow";
  if (t === "red") return "red";
  if (t === "sub") return "sub";
  return null;
}

export function parseGoalScorerName(description: string): string | null {
  const m = description.match(/—\s*([^(\n]+)/);
  return m?.[1]?.trim() || null;
}

export function parseAssistName(description: string): string | null {
  const m = description.match(/\(([^)]+)\)\s*$/);
  return m?.[1]?.trim() || null;
}

export function formatRelativeAgo(
  isoDate: string | null | undefined,
  asOf: Date = new Date()
): string | null {
  if (!isoDate) return null;
  const raw = String(isoDate).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  const then = m
    ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    : Date.parse(raw);
  if (!Number.isFinite(then)) return null;
  const now = Date.UTC(
    asOf.getUTCFullYear(),
    asOf.getUTCMonth(),
    asOf.getUTCDate()
  );
  const days = Math.max(0, Math.round((now - then) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 14) return `${days} days ago`;
  if (days < 60) {
    const w = Math.round(days / 7);
    return w === 1 ? "1 week ago" : `${w} weeks ago`;
  }
  if (days < 730) {
    const mo = Math.round(days / 30.44);
    return mo === 1 ? "1 month ago" : `${mo} months ago`;
  }
  const y = Math.round(days / 365.25);
  return y === 1 ? "1 year ago" : `${y} years ago`;
}

export function suspensionProximity(
  yellowNow: number | null,
  leagueAfId: number | null | undefined
): {
  known: boolean;
  threshold: number | null;
  remaining: number | null;
  label: string;
} {
  if (leagueAfId == null || !YELLOW_SUSPENSION_THRESHOLDS[leagueAfId]) {
    return {
      known: false,
      threshold: null,
      remaining: null,
      label:
        "Suspension threshold unknown for this league — showing season yellow count only",
    };
  }
  const cfg = YELLOW_SUSPENSION_THRESHOLDS[leagueAfId]!;
  if (yellowNow == null || !Number.isFinite(yellowNow)) {
    return {
      known: true,
      threshold: cfg.threshold,
      remaining: null,
      label: `${cfg.label} — yellow tally unavailable`,
    };
  }
  const remaining = Math.max(0, cfg.threshold - yellowNow);
  if (remaining === 0) {
    return {
      known: true,
      threshold: cfg.threshold,
      remaining: 0,
      label: `${yellowNow} yellows — at/over first-ban threshold (${cfg.label})`,
    };
  }
  return {
    known: true,
    threshold: cfg.threshold,
    remaining,
    label: `${yellowNow} of ${cfg.threshold} toward first ban · ${remaining} more (${cfg.label})`,
  };
}

export type PreviousGoalInfo = {
  date: string;
  opponent: string;
  ago: string | null;
  league?: string | null;
};

export type NarrativeHook = { text: string };

/** Factual hooks from recent form rows (include this match goal as newest when provided). */
export function buildGoalNarrativeHooks(opts: {
  form: PlayerFormRow[];
  opponentName?: string | null;
  /** Goals already counted in form for "this" fixture — usually exclude current */
  includeThisGoal?: boolean;
  /** Current fixture id — skip double-counting when form already has this match */
  excludeFixtureId?: number | null;
  excludeDatePrefix?: string | null;
}): NarrativeHook[] {
  const hooks: NarrativeHook[] = [];
  const rows = opts.form.filter((r) => r.played && !isCurrentFixtureFormRow(r, opts));
  // If form already includes this fixture's goals, do not add includeThisGoal again
  const formHasThis = opts.form.some(
    (r) => r.played && isCurrentFixtureFormRow(r, opts) && (r.goals || 0) > 0
  );
  const addThis = Boolean(opts.includeThisGoal) && !formHasThis;
  const withGoals = rows.filter((r) => (r.goals || 0) > 0);
  const last5 = rows.slice(0, 5);
  const goalsInLast5 =
    last5.reduce((s, r) => s + (r.goals || 0), 0) + (addThis ? 1 : 0);
  const appsInLast5 = last5.length + (addThis ? 1 : 0);
  if (goalsInLast5 >= 3 && appsInLast5 >= 3 && appsInLast5 <= 5) {
    hooks.push({
      text: `${ordinal(goalsInLast5)} goal in last ${appsInLast5} appearances`,
    });
  } else if (withGoals.length >= 3 || (addThis && withGoals.length >= 2)) {
    let streak = addThis ? 1 : 0;
    for (const r of rows) {
      if ((r.goals || 0) > 0) streak += 1;
      else break;
    }
    if (streak >= 3) {
      hooks.push({ text: `Scored in ${streak} consecutive appearances` });
    }
  }

  const opp = (opts.opponentName || "").trim().toLowerCase();
  if (opp) {
    const vsOpp = rows.filter((r) =>
      namesLooselyMatch(r.opponent, opts.opponentName)
    );
    const goalsVs =
      vsOpp.reduce((s, r) => s + (r.goals || 0), 0) + (addThis ? 1 : 0);
    const meetings = vsOpp.length + (addThis ? 1 : 0);
    if (goalsVs >= 2 && meetings >= 2) {
      hooks.push({
        text: `${ordinal(goalsVs)} vs ${opts.opponentName} in last ${meetings} meetings`,
      });
    }
  }
  return hooks.slice(0, 3);
}

function isCurrentFixtureFormRow(
  r: PlayerFormRow,
  opts: {
    excludeFixtureId?: number | null;
    excludeDatePrefix?: string | null;
  }
): boolean {
  if (
    opts.excludeFixtureId != null &&
    Number.isFinite(opts.excludeFixtureId) &&
    r.fixtureId === opts.excludeFixtureId
  ) {
    return true;
  }
  const prefix = (opts.excludeDatePrefix || "").trim();
  if (prefix && String(r.date || "").startsWith(prefix)) return true;
  return false;
}

/** Prior goal BEFORE the current fixture/event — never the goal just scored. */
export function findPreviousGoal(
  form: PlayerFormRow[],
  opts?: {
    asOf?: Date;
    excludeFixtureId?: number | null;
    excludeDatePrefix?: string | null;
  }
): PreviousGoalInfo | null {
  const asOf = opts?.asOf ?? new Date();
  for (const r of form) {
    if (!r.played) continue;
    if ((r.goals || 0) <= 0) continue;
    if (isCurrentFixtureFormRow(r, opts || {})) continue;
    const ago = formatRelativeAgo(r.date, asOf);
    return {
      date: r.date.slice(0, 10) || r.date,
      opponent: r.opponent || "—",
      ago,
      league: r.league || null,
    };
  }
  return null;
}

export function benchImpactFromForm(form: PlayerFormRow[]): {
  subApps: number;
  goalsOffBench: number;
  assistsOffBench: number;
  against: { opponent: string; goals: number; assists: number; date: string }[];
} {
  let subApps = 0;
  let goalsOffBench = 0;
  let assistsOffBench = 0;
  const against: {
    opponent: string;
    goals: number;
    assists: number;
    date: string;
  }[] = [];
  for (const r of form) {
    if (!r.played) continue;
    if (r.started === false) {
      subApps += 1;
      const g = r.goals || 0;
      const a = r.assists || 0;
      goalsOffBench += g;
      assistsOffBench += a;
      if (g > 0 || a > 0) {
        against.push({
          opponent: r.opponent || "—",
          goals: g,
          assists: a,
          date: r.date,
        });
      }
    }
  }
  return { subApps, goalsOffBench, assistsOffBench, against: against.slice(0, 5) };
}

export function subOrdinalForTeam(
  events: EventDetailEventLite[],
  teamSide: string | null | undefined,
  minute: number,
  description: string
): number | null {
  if (!teamSide) return null;
  const subs = events
    .filter((e) => /^sub$/i.test(e.type) && e.teamSide === teamSide)
    .slice()
    .sort((a, b) => a.minute - b.minute || a.description.localeCompare(b.description));
  const idx = subs.findIndex(
    (e) => e.minute === minute && e.description === description
  );
  if (idx >= 0) return idx + 1;
  // Fallback: count subs for side up to and including this minute
  const upTo = subs.filter((e) => e.minute < minute || (e.minute === minute)).length;
  return upTo > 0 ? upTo : null;
}

export type DeskEventDetailSnapshot = {
  kind: EventDetailKind;
  minute: number;
  type: string;
  description: string;
  teamSide: string | null;
  scoreline?: string;
  /** Primary player (scorer / booked / player ON) */
  player: EventDetailPlayerLite | null;
  playerAge: number | null;
  photoUrl: string | null;
  /** Goal */
  isOwnGoal?: boolean;
  goalsCompetitionNow: number | null;
  goalsAllCompsNow: number | null;
  competitionOrdinal: number | null;
  assistName: string | null;
  assister: EventDetailPlayerLite | null;
  assistsCompetitionNow: number | null;
  assistsAllCompsNow: number | null;
  noteHook: string | null;
  /** Card */
  yellowsNow: number | null;
  redsNow: number | null;
  suspension: ReturnType<typeof suspensionProximity> | null;
  /** Sub */
  playerOff: EventDetailPlayerLite | null;
  playerOn: EventDetailPlayerLite | null;
  subOrdinal: number | null;
  competitionName: string;
};

export function buildDeskEventDetailSnapshot(opts: {
  kind: EventDetailKind;
  event: EventDetailEventLite;
  squad: EventDetailPlayerLite[];
  events: EventDetailEventLite[];
  matchStatus: string;
  competitionName: string;
  leagueAfId?: number | null;
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  opponentForSide?: (side: "home" | "away") => string;
}): DeskEventDetailSnapshot {
  const {
    kind,
    event,
    squad,
    events,
    matchStatus,
    competitionName,
    leagueAfId,
    homeName,
    awayName,
    homeScore,
    awayScore,
  } = opts;

  const findByIdOrName = (
    id: string | null | undefined,
    name: string | null | undefined
  ) => {
    if (id) {
      const hit = squad.find((p) => p.id === id);
      if (hit) return hit;
    }
    if (name) {
      return squad.find((p) => namesLooselyMatch(p.name, name)) || null;
    }
    return null;
  };

  const base = {
    kind,
    minute: event.minute,
    type: event.type,
    description: event.description,
    teamSide: event.teamSide ?? null,
    scoreline: `${homeName} ${homeScore}–${awayScore} ${awayName}`,
    player: null as EventDetailPlayerLite | null,
    playerAge: null as number | null,
    photoUrl: null as string | null,
    goalsCompetitionNow: null as number | null,
    goalsAllCompsNow: null as number | null,
    competitionOrdinal: null as number | null,
    assistName: null as string | null,
    assister: null as EventDetailPlayerLite | null,
    assistsCompetitionNow: null as number | null,
    assistsAllCompsNow: null as number | null,
    noteHook: null as string | null,
    yellowsNow: null as number | null,
    redsNow: null as number | null,
    suspension: null as ReturnType<typeof suspensionProximity> | null,
    playerOff: null as EventDetailPlayerLite | null,
    playerOn: null as EventDetailPlayerLite | null,
    subOrdinal: null as number | null,
    competitionName,
  };

  if (kind === "goal") {
    const isOwn = /own_goal/i.test(event.type);
    const scorerName = parseGoalScorerName(event.description);
    const assistName = parseAssistName(event.description);
    const scorer = findByIdOrName(event.playerId, scorerName);
    const assister = assistName
      ? findByIdOrName(null, assistName)
      : null;
    const matchGoals =
      scorer && (scorer.matchGoals || 0) > 0 ? scorer.matchGoals! : 1;
    const afComp = scorer?.goals ?? null;
    const afAll = scorer?.goalsAllComps ?? afComp;
    const nth = scorer
      ? seasonOrdinal(afComp, matchGoals, matchGoals, matchStatus)
      : null;
    const goalsCompetitionNow = scorer
      ? liveAdjustedSeasonStat(afComp, matchGoals, matchStatus)
      : null;
    const goalsAllCompsNow = scorer
      ? liveAdjustedSeasonStat(afAll, matchGoals, matchStatus)
      : null;

    let assistsCompetitionNow: number | null = null;
    let assistsAllCompsNow: number | null = null;
    if (assister && assistName) {
      const matchA =
        (assister.matchAssists || 0) > 0 ? assister.matchAssists! : 1;
      assistsCompetitionNow = liveAdjustedSeasonStat(
        assister.assists ?? null,
        matchA,
        matchStatus
      );
      assistsAllCompsNow = liveAdjustedSeasonStat(
        assister.assistsAllComps ?? assister.assists ?? null,
        matchA,
        matchStatus
      );
    }

    return {
      ...base,
      isOwnGoal: isOwn,
      player: scorer,
      playerAge: resolvePersonAge(scorer),
      photoUrl: scorer?.photoUrl || null,
      goalsCompetitionNow: isOwn ? null : goalsCompetitionNow,
      goalsAllCompsNow: isOwn ? null : goalsAllCompsNow,
      competitionOrdinal: isOwn ? null : nth,
      assistName: isOwn ? null : assistName,
      assister: isOwn ? null : assister,
      assistsCompetitionNow: isOwn ? null : assistsCompetitionNow,
      assistsAllCompsNow: isOwn ? null : assistsAllCompsNow,
      noteHook: scorer?.noteHook || null,
    };
  }

  if (kind === "yellow" || kind === "red") {
    const nameGuess =
      parseGoalScorerName(event.description) ||
      event.description.replace(/^.*?—\s*/, "").trim() ||
      null;
    const player = findByIdOrName(event.playerId, nameGuess);
    const inMatchY = events.filter(
      (e) =>
        e.type === "yellow" &&
        ((player && e.playerId === player.id) ||
          (player &&
            namesLooselyMatch(
              parseGoalScorerName(e.description) || e.description,
              player.name
            )))
    ).length;
    const inMatchR = events.filter(
      (e) =>
        e.type === "red" &&
        ((player && e.playerId === player.id) ||
          (player &&
            namesLooselyMatch(
              parseGoalScorerName(e.description) || e.description,
              player.name
            )))
    ).length;
    const yellowsNow = player
      ? liveAdjustedSeasonStat(
          player.yellowCards ?? null,
          Math.max(inMatchY, kind === "yellow" ? 1 : inMatchY),
          matchStatus
        )
      : null;
    const redsNow = player
      ? liveAdjustedSeasonStat(
          player.redCards ?? null,
          Math.max(inMatchR, kind === "red" ? 1 : inMatchR),
          matchStatus
        )
      : null;
    return {
      ...base,
      player,
      playerAge: resolvePersonAge(player),
      photoUrl: player?.photoUrl || null,
      yellowsNow,
      redsNow,
      suspension: suspensionProximity(yellowsNow, leagueAfId),
      noteHook: player?.noteHook || null,
    };
  }

  // sub
  const { outName, inName } = parseSubDescription(event.description);
  const onP = findByIdOrName(null, inName);
  const offP = findByIdOrName(event.playerId, outName);
  const side =
    event.teamSide ||
    onP?.side ||
    offP?.side ||
    null;
  return {
    ...base,
    player: onP,
    playerAge: resolvePersonAge(onP),
    photoUrl: onP?.photoUrl || null,
    playerOn: onP,
    playerOff: offP,
    subOrdinal: subOrdinalForTeam(
      events,
      side,
      event.minute,
      event.description
    ),
    noteHook: onP?.noteHook || null,
  };
}

export function dash(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return String(n);
}

export { ordinal, selectScoredGoals, isScoredGoalType };
