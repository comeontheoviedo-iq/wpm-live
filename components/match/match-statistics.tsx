"use client";

import { EventTimeline, type TimelineEvent } from "@/components/match/event-timeline";
import { cn } from "@/lib/utils";
import { deskVenueName } from "@/lib/venue-name";

export type StatRow = { label: string; homeValue: string; awayValue: string };

function parseStat(v: string): number {
  const s = String(v).replace("%", "").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function StatBar({
  label,
  homeValue,
  awayValue,
  homeColor,
  awayColor,
}: StatRow & { homeColor: string; awayColor: string }) {
  const h = parseStat(homeValue);
  const a = parseStat(awayValue);
  const total = h + a || 1;
  const hPct = (h / total) * 100;
  const aPct = (a / total) * 100;
  return (
    <div className="py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <div className="text-center text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
        {label}
      </div>
      <div className="flex items-center gap-2">
        <span className="w-10 text-right text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
          {homeValue}
        </span>
        <div className="flex-1 flex h-2.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-l-full transition-all"
            style={{ width: `${hPct}%`, backgroundColor: homeColor }}
          />
          <div
            className="h-full rounded-r-full transition-all"
            style={{ width: `${aPct}%`, backgroundColor: awayColor }}
          />
        </div>
        <span className="w-10 text-left text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
          {awayValue}
        </span>
      </div>
    </div>
  );
}

const PREFERRED = [
  /expected goals|\bxg\b/i,
  /possession/i,
  /corner/i,
  /total shots|shots total/i,
  /shots on/i,
  /shots off/i,
  /dangerous/i,
  /^fouls$/i,
  /offsides/i,
  /saves|goalkeeper/i,
  /passes accurate|accurate passes/i,
  /total passes/i,
  /yellow/i,
  /red/i,
  /blocked/i,
];

function orderStats(stats: StatRow[]): StatRow[] {
  const ranked: { s: StatRow; i: number }[] = [];
  const rest: StatRow[] = [];
  for (const s of stats) {
    const idx = PREFERRED.findIndex((re) => re.test(s.label));
    if (idx >= 0) ranked.push({ s, i: idx });
    else rest.push(s);
  }
  ranked.sort((a, b) => a.i - b.i);
  return [...ranked.map((r) => r.s), ...rest];
}

function findStat(stats: StatRow[], re: RegExp): StatRow | undefined {
  return stats.find((s) => re.test(s.label));
}

/** Parse "Normal Goal — Scorer (Assist)" style descriptions. */
export function parseGoalDescription(description: string): {
  scorer: string;
  assist: string | null;
} {
  const raw = String(description || "").trim();
  const afterDash = raw.replace(/^.*?[—–-]\s*/, "").trim() || raw;
  const m = afterDash.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (m) {
    return { scorer: m[1].trim(), assist: m[2].trim() };
  }
  return { scorer: afterDash || "Goal", assist: null };
}

export function MatchStatisticsView({
  homeName,
  awayName,
  homeColor,
  awayColor,
  homeScore,
  awayScore,
  status,
  competition,
  kickoffLabel,
  venueName,
  venueCity,
  statistics,
  events,
  attendance,
  venueCapacity,
}: {
  homeName: string;
  awayName: string;
  homeColor: string;
  awayColor: string;
  homeScore: number;
  awayScore: number;
  status: string;
  competition?: string;
  kickoffLabel?: string;
  venueName?: string | null;
  venueCity?: string | null;
  statistics: StatRow[];
  events: TimelineEvent[];
  attendance?: number | null;
  venueCapacity?: number | null;
}) {
  const ordered = orderStats(statistics);
  const statusLabel =
    status === "Full Time" ? "Full Time" : status === "Live" ? "Live" : status;

  const goals = events
    .filter((e) => /goal/i.test(String(e.type || "")))
    .slice()
    .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));

  const poss = findStat(statistics, /possession/i);
  const shots = findStat(statistics, /total shots|shots total/i);
  const onTarget = findStat(statistics, /shots on/i);
  const corners = findStat(statistics, /corner/i);

  const crowd =
    attendance && attendance > 0
      ? attendance
      : venueCapacity && venueCapacity > 0
        ? Math.round(venueCapacity * 0.78)
        : null;
  const crowdEst = !(attendance && attendance > 0) && crowd != null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden shadow-sm">
      {/* ABOVE-FOLD MATCH OVERVIEW — score / goals / att / key line */}
      <div
        className="border-b border-slate-100 dark:border-slate-800 px-4 py-3 space-y-3 bg-[#0a0d12] text-slate-100"
        data-stats-overview="1"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
              style={{ backgroundColor: homeColor }}
            >
              {homeName.slice(0, 3).toUpperCase()}
            </span>
            <span className="text-2xl font-black tabular-nums tracking-tight">
              {homeScore}–{awayScore}
            </span>
            <span
              className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
              style={{ backgroundColor: awayColor }}
            >
              {awayName.slice(0, 3).toUpperCase()}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white",
                status === "Live" ? "bg-rose-600" : "bg-emerald-600"
              )}
            >
              {statusLabel}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-sm truncate text-slate-100">
              {homeName} vs {awayName}
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              {[competition, kickoffLabel, deskVenueName(venueName) || venueName, venueCity]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
          {crowd != null ? (
            <div
              className="shrink-0 text-right tabular-nums"
              title={
                crowdEst
                  ? `Estimated from capacity ${venueCapacity?.toLocaleString()}`
                  : "Attendance"
              }
            >
              <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                Attendance{crowdEst ? " (est)" : ""}
              </div>
              <div className="text-sm font-bold text-slate-200">
                {crowdEst ? "~" : ""}
                {crowd.toLocaleString()}
                {venueCapacity ? (
                  <span className="text-slate-500 font-medium text-[11px]">
                    {" "}
                    / {venueCapacity.toLocaleString()}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {/* Goal list */}
        <div data-stats-goals="1">
          <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500 mb-1">
            Goals
          </div>
          {goals.length === 0 ? (
            <p className="text-xs text-slate-500">No goals yet.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {goals.map((g) => {
                const { scorer, assist } = parseGoalDescription(
                  g.description || ""
                );
                const side = g.teamSide === "away" ? "away" : "home";
                return (
                  <li
                    key={g.id}
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-0 text-[12px]"
                  >
                    <span className="tabular-nums font-bold text-amber-300/90 w-8 shrink-0">
                      {g.minute ?? "—"}&apos;
                    </span>
                    <span
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: side === "home" ? homeColor : awayColor,
                      }}
                    />
                    <span className="font-semibold text-slate-100">{scorer}</span>
                    {assist ? (
                      <span className="text-slate-500">
                        assist {assist}
                      </span>
                    ) : null}
                    <span className="text-slate-600 text-[10px] uppercase tracking-wide">
                      {side === "home" ? homeName : awayName}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Key line: poss / shots / on target / corners */}
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tabular-nums text-slate-300 border-t border-white/[0.06] pt-2"
          data-stats-keyline="1"
        >
          <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500 shrink-0">
            Key
          </span>
          {poss ? (
            <span>
              Poss{" "}
              <strong className="text-slate-100">
                {poss.homeValue}–{poss.awayValue}
              </strong>
            </span>
          ) : null}
          {shots ? (
            <span>
              Shots{" "}
              <strong className="text-slate-100">
                {shots.homeValue}–{shots.awayValue}
              </strong>
            </span>
          ) : null}
          {onTarget ? (
            <span>
              On target{" "}
              <strong className="text-slate-100">
                {onTarget.homeValue}–{onTarget.awayValue}
              </strong>
            </span>
          ) : null}
          {corners ? (
            <span>
              Corners{" "}
              <strong className="text-slate-100">
                {corners.homeValue}–{corners.awayValue}
              </strong>
            </span>
          ) : null}
          {!poss && !shots && !onTarget && !corners ? (
            <span className="text-slate-600">Sync for live team stats</span>
          ) : null}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-slate-800">
        <div className="p-4">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
            Team statistics
          </div>
          {ordered.length === 0 ? (
            <p className="text-xs text-slate-500 py-6">
              No statistics yet — Sync from the live feed.
            </p>
          ) : (
            ordered.map((s) => (
              <StatBar
                key={s.label}
                {...s}
                homeColor={homeColor}
                awayColor={awayColor}
              />
            ))
          )}
        </div>
        <div className="p-4">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
            Match timeline
          </div>
          <EventTimeline
            events={events}
            maxHeightClass="max-h-[70vh]"
            emptyLabel="No events yet."
          />
        </div>
      </div>
    </div>
  );
}
