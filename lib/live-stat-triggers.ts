/**
 * LIVE commentary threshold / pattern flashes from AF fixture data.
 *
 * Sources:
 * - Team: AF /fixtures/statistics (synced → Statistic rows)
 * - Player: AF /fixtures/players (ephemeral on sync poll — not persisted)
 *
 * Soft-fail: missing/null stats never invent numbers. Dedup via fired Set
 * (once per threshold crossing per player/match key).
 */

export type LivePlayerStatRow = {
  /** Local Player.id when mapped; null if AF-only */
  playerId: string | null;
  afPlayerId: number;
  name: string;
  teamSide: "home" | "away";
  teamName: string;
  minutes: number | null;
  shotsOn: number | null;
  shotsTotal: number | null;
  /** AF passes.key — closest free-plan proxy for "chances created" */
  keyPasses: number | null;
  duelsWon: number | null;
  duelsTotal: number | null;
  tackles: number | null;
  interceptions: number | null;
  dribblesSuccess: number | null;
  dribblesAttempts: number | null;
  foulsCommitted: number | null;
  saves: number | null;
  goals: number | null;
  assists: number | null;
  rating: string | null;
};

export type StatThresholds = {
  keyPasses: number;
  shotsOn: number;
  duelsWon: number;
  tackles: number;
  dribblesSuccess: number;
  saves: number;
  foulsCommitted: number;
  /** Possession swing (pp) vs first sample or prior — momentum proxy */
  possessionSwing: number;
  /** |home shots − away shots| for shot-momentum proxy */
  shotDiff: number;
};

export const DEFAULT_STAT_THRESHOLDS: StatThresholds = {
  keyPasses: 3,
  shotsOn: 3,
  duelsWon: 6,
  tackles: 4,
  dribblesSuccess: 3,
  saves: 3,
  foulsCommitted: 4,
  possessionSwing: 12,
  shotDiff: 6,
};

export type StatTriggerFlash = {
  /** Stable dedupe key — also used as fired Set entry */
  id: string;
  kind: "player_threshold" | "momentum";
  title: string;
  lines: string[];
  playerId?: string | null;
  teamSide?: "home" | "away";
  /** Optional viz preference when numbers support it */
  vizHint?:
    | "possession"
    | "shot_map"
    | "xg_race"
    | "shots_compare"
    | "leaderboard"
    | "gk_saves"
    | "momentum_proxy"
    | "corners_fouls"
    | null;
  /** Stat field for leaderboard focus */
  focusStat?: string;
  /** Field that crossed (for logging / UI) */
  stat: string;
  value: number;
};

function num(v: number | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type ThresholdDef = {
  stat: string;
  label: string;
  threshold: number;
  pick: (r: LivePlayerStatRow) => number | null;
  title: (name: string, v: number) => string;
  line: (r: LivePlayerStatRow, v: number) => string;
};

function defs(t: StatThresholds): ThresholdDef[] {
  return [
    {
      stat: "keyPasses",
      label: "key passes",
      threshold: t.keyPasses,
      pick: (r) => num(r.keyPasses),
      title: (name, v) => `${name} · ${v} key passes`,
      line: (r, v) =>
        `${r.name} (${r.teamName}) — ${v} key passes` +
        (r.assists != null && r.assists > 0 ? ` · ${r.assists} assist(s)` : "") +
        " · AF key-pass tally (chances-created proxy)",
    },
    {
      stat: "shotsOn",
      label: "shots on target",
      threshold: t.shotsOn,
      pick: (r) => num(r.shotsOn),
      title: (name, v) => `${name} · ${v} on target`,
      line: (r, v) =>
        `${r.name} (${r.teamName}) — ${v} shots on target` +
        (r.shotsTotal != null ? ` / ${r.shotsTotal} total` : ""),
    },
    {
      stat: "duelsWon",
      label: "duels won",
      threshold: t.duelsWon,
      pick: (r) => num(r.duelsWon),
      title: (name, v) => `${name} · ${v} duels won`,
      line: (r, v) =>
        `${r.name} (${r.teamName}) — ${v} duels won` +
        (r.duelsTotal != null ? ` / ${r.duelsTotal}` : ""),
    },
    {
      stat: "tackles",
      label: "tackles",
      threshold: t.tackles,
      pick: (r) => num(r.tackles),
      title: (name, v) => `${name} · ${v} tackles`,
      line: (r, v) =>
        `${r.name} (${r.teamName}) — ${v} tackles` +
        (r.interceptions != null && r.interceptions > 0
          ? ` · ${r.interceptions} interceptions`
          : ""),
    },
    {
      stat: "dribblesSuccess",
      label: "successful dribbles",
      threshold: t.dribblesSuccess,
      pick: (r) => num(r.dribblesSuccess),
      title: (name, v) => `${name} · ${v} dribbles`,
      line: (r, v) =>
        `${r.name} (${r.teamName}) — ${v} successful dribbles` +
        (r.dribblesAttempts != null ? ` / ${r.dribblesAttempts} attempts` : ""),
    },
    {
      stat: "saves",
      label: "saves",
      threshold: t.saves,
      pick: (r) => num(r.saves),
      title: (name, v) => `${name} · ${v} saves`,
      line: (r, v) => `${r.name} (${r.teamName}) — ${v} saves`,
    },
    {
      stat: "foulsCommitted",
      label: "fouls",
      threshold: t.foulsCommitted,
      pick: (r) => num(r.foulsCommitted),
      title: (name, v) => `${name} · ${v} fouls`,
      line: (r, v) => `${r.name} (${r.teamName}) — ${v} fouls committed`,
    },
  ];
}

/**
 * Emit one flash per (player, stat) the first time value ≥ threshold.
 * Subsequent polls with higher values do not re-fire (crossing once).
 */
export function evaluatePlayerThresholds(
  rows: LivePlayerStatRow[],
  fired: Set<string>,
  thresholds: Partial<StatThresholds> = {}
): StatTriggerFlash[] {
  const t = { ...DEFAULT_STAT_THRESHOLDS, ...thresholds };
  const out: StatTriggerFlash[] = [];
  for (const r of rows) {
    for (const d of defs(t)) {
      const v = d.pick(r);
      if (v == null) continue; // soft-fail missing
      if (v < d.threshold) continue;
      const id = `thr|${r.afPlayerId}|${d.stat}|${d.threshold}`;
      if (fired.has(id)) continue;
      fired.add(id);
      const vizByStat: Record<string, NonNullable<StatTriggerFlash["vizHint"]>> = {
        shotsOn: "leaderboard",
        keyPasses: "leaderboard",
        saves: "gk_saves",
        duelsWon: "leaderboard",
        tackles: "leaderboard",
        dribblesSuccess: "leaderboard",
        foulsCommitted: "corners_fouls",
      };
      out.push({
        id,
        kind: "player_threshold",
        title: d.title(r.name, v),
        lines: [d.line(r, v)],
        playerId: r.playerId,
        teamSide: r.teamSide,
        vizHint: vizByStat[d.stat] ?? null,
        focusStat: d.stat,
        stat: d.stat,
        value: v,
      });
    }
  }
  return out;
}

function parsePoss(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(String(v).replace("%", "").trim());
  return Number.isFinite(n) ? n : null;
}

function parseCount(v: string | number | null | undefined): number | null {
  if (v == null || v === "—") return null;
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Momentum without AF "momentum" field: possession swing + shot differential proxy.
 * Soft-fail when team stats absent.
 */
export function evaluateMomentumProxy(opts: {
  statistics: { label: string; homeValue: string | number; awayValue: string | number }[];
  /** Home possession % samples over the match (newest last) */
  possessionSamples?: number[];
  fired: Set<string>;
  homeName: string;
  awayName: string;
  thresholds?: Partial<StatThresholds>;
}): StatTriggerFlash[] {
  const t = { ...DEFAULT_STAT_THRESHOLDS, ...(opts.thresholds || {}) };
  const out: StatTriggerFlash[] = [];
  const stats = opts.statistics || [];

  const poss = stats.find((s) => /possession/i.test(s.label));
  const homePoss = poss ? parsePoss(poss.homeValue) : null;
  const awayPoss = poss ? parsePoss(poss.awayValue) : null;

  const samples = opts.possessionSamples || [];
  if (homePoss != null && samples.length >= 2) {
    const first = samples[0]!;
    const swing = homePoss - first;
    if (Math.abs(swing) >= t.possessionSwing) {
      const side = swing > 0 ? "home" : "away";
      const id = `mom|poss|${side}|${t.possessionSwing}`;
      if (!opts.fired.has(id)) {
        opts.fired.add(id);
        const leader = swing > 0 ? opts.homeName : opts.awayName;
        out.push({
          id,
          kind: "momentum",
          title: `Momentum · ${leader}`,
          lines: [
            `Possession swing ${swing > 0 ? "+" : ""}${Math.round(swing)}pp for ${leader}`,
            `Now ${homePoss}%–${awayPoss ?? "–"}% (${opts.homeName}–${opts.awayName})`,
            "Proxy from Ball Possession (AF has no live momentum field)",
          ],
          teamSide: side,
          vizHint: "possession",
          stat: "possessionSwing",
          value: Math.abs(Math.round(swing)),
        });
      }
    }
  }

  const shots =
    stats.find((s) => /^shots$/i.test(s.label) || /total shots/i.test(s.label)) ||
    null;
  const onTarget =
    stats.find((s) => /shots on (goal|target)/i.test(s.label)) || null;
  const hShots = shots ? parseCount(shots.homeValue) : null;
  const aShots = shots ? parseCount(shots.awayValue) : null;
  if (hShots != null && aShots != null) {
    const diff = hShots - aShots;
    if (Math.abs(diff) >= t.shotDiff) {
      const side = diff > 0 ? "home" : "away";
      const id = `mom|shots|${side}|${t.shotDiff}`;
      if (!opts.fired.has(id)) {
        opts.fired.add(id);
        const leader = diff > 0 ? opts.homeName : opts.awayName;
        const onH = onTarget ? parseCount(onTarget.homeValue) : null;
        const onA = onTarget ? parseCount(onTarget.awayValue) : null;
        out.push({
          id,
          kind: "momentum",
          title: `Shot pressure · ${leader}`,
          lines: [
            `Shots ${hShots}–${aShots} (${opts.homeName}–${opts.awayName})`,
            onH != null && onA != null ? `On target ${onH}–${onA}` : null,
            "Proxy from team shot counts (no AF momentum/xG on free plan for this fixture)",
          ].filter(Boolean) as string[],
          teamSide: side,
          vizHint: "shots_compare",
          stat: "shotDiff",
          value: Math.abs(diff),
        });
      }
    }
  }

  return out;
}

/** Map raw AF /fixtures/players payload → compact rows (soft-fail per field). */
export function mapAfFixturePlayersToRows(opts: {
  teams: {
    team: { id: number; name: string };
    players: {
      player: { id: number; name: string };
      statistics: {
        games?: { minutes?: number | null; rating?: string | null };
        goals?: {
          total?: number | null;
          assists?: number | null;
          saves?: number | null;
        };
        shots?: { total?: number | null; on?: number | null };
        passes?: { key?: number | null };
        tackles?: { total?: number | null; interceptions?: number | null };
        duels?: { total?: number | null; won?: number | null };
        dribbles?: { attempts?: number | null; success?: number | null };
        fouls?: { committed?: number | null };
      }[];
    }[];
  }[];
  homeAfTeamId: number;
  awayAfTeamId: number;
  /** Map AF player id → local Player.id */
  localByAfId: Map<number, string>;
}): LivePlayerStatRow[] {
  const out: LivePlayerStatRow[] = [];
  for (const block of opts.teams || []) {
    const tid = block.team?.id;
    let teamSide: "home" | "away" | null = null;
    if (tid === opts.homeAfTeamId) teamSide = "home";
    else if (tid === opts.awayAfTeamId) teamSide = "away";
    if (!teamSide) continue;
    for (const row of block.players || []) {
      const st = row.statistics?.[0];
      if (!st) continue;
      const afId = row.player?.id;
      if (!afId) continue;
      out.push({
        playerId: opts.localByAfId.get(afId) || null,
        afPlayerId: afId,
        name: row.player.name || "Unknown",
        teamSide,
        teamName: block.team.name,
        minutes: num(st.games?.minutes ?? null),
        shotsOn: num(st.shots?.on ?? null),
        shotsTotal: num(st.shots?.total ?? null),
        keyPasses: num(st.passes?.key ?? null),
        duelsWon: num(st.duels?.won ?? null),
        duelsTotal: num(st.duels?.total ?? null),
        tackles: num(st.tackles?.total ?? null),
        interceptions: num(st.tackles?.interceptions ?? null),
        dribblesSuccess: num(st.dribbles?.success ?? null),
        dribblesAttempts: num(st.dribbles?.attempts ?? null),
        foulsCommitted: num(st.fouls?.committed ?? null),
        saves: num(st.goals?.saves ?? null),
        goals: num(st.goals?.total ?? null),
        assists: num(st.goals?.assists ?? null),
        rating: st.games?.rating ?? null,
      });
    }
  }
  return out;
}
