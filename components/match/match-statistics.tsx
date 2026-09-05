"use client";

import { EventTimeline, type TimelineEvent } from "@/components/match/event-timeline";
import { cn } from "@/lib/utils";

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
}) {
  const ordered = orderStats(statistics);
  const statusLabel =
    status === "Full Time" ? "Full Time" : status === "Live" ? "Live" : status;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden shadow-sm">
      <div className="border-b border-slate-100 dark:border-slate-800 px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span
            className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
            style={{ backgroundColor: homeColor }}
          >
            {homeName.slice(0, 3).toUpperCase()}
          </span>
          <span className="text-xl font-black tabular-nums">
            {homeScore}-{awayScore}
          </span>
          <span
            className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
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
          <div className="font-bold text-sm truncate">
            {homeName} vs {awayName}
          </div>
          <div className="text-[11px] text-slate-500 truncate">
            {[competition, kickoffLabel, venueName, venueCity]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-slate-800">
        <div className="p-4">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
            Team statistics
          </div>
          {ordered.length === 0 ? (
            <p className="text-xs text-slate-500 py-6">
              No statistics yet — Sync from API-Football.
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
