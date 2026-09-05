"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Loader2, RefreshCw } from "lucide-react";

type ShotSummary = {
  homeShots: number;
  awayShots: number;
  homeOnTarget: number;
  awayOnTarget: number;
  homeBlocked: number;
  awayBlocked: number;
};

type CoverageEntry = {
  competition: string;
  covered: boolean;
  note?: string;
};

export type AdvancedStatsPayload = {
  available: boolean;
  source: string | null;
  sourceLabel: string;
  competition: string;
  coveredCompetition: boolean;
  message: string | null;
  homeXg: number | null;
  awayXg: number | null;
  homeXga: number | null;
  awayXga: number | null;
  understatMatchId: string | null;
  matchedAt: string | null;
  forecast: { homeWin: number; draw: number; awayWin: number } | null;
  shotSummary: ShotSummary | null;
  coverage?: CoverageEntry[];
};

function fmtXg(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

export function AdvancedStatsCard({
  matchId,
  homeName,
  awayName,
  homeColor,
  awayColor,
  compact = false,
  showCoverage = false,
  className,
}: {
  matchId: string;
  homeName: string;
  awayName: string;
  homeColor?: string;
  awayColor?: string;
  compact?: boolean;
  showCoverage?: boolean;
  className?: string;
}) {
  const [data, setData] = useState<AdvancedStatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/advanced-stats`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setErr("Could not load advanced stats");
        setData(null);
        return;
      }
      const json = (await res.json()) as AdvancedStatsPayload;
      setData(json);
    } catch {
      setErr("Could not load advanced stats");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const hc = homeColor || "#0ea5e9";
  const ac = awayColor || "#f43f5e";

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm overflow-hidden",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Advanced stats
          </div>
          <div className="text-[11px] text-slate-500 truncate">
            {data?.sourceLabel || "xG"}
            {data?.competition ? ` · ${data.competition}` : ""}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-700"
          title="Refresh xG"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      <div className={cn("px-3", compact ? "py-2.5" : "py-3")}>
        {loading && !data ? (
          <p className="text-xs text-slate-500 flex items-center gap-2 py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading xG…
          </p>
        ) : err ? (
          <p className="text-xs text-slate-500 py-1">{err}</p>
        ) : data?.available && data.homeXg != null && data.awayXg != null ? (
          <div className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-wide text-slate-400 truncate">
                  {homeName}
                </div>
                <div
                  className="text-2xl font-black tabular-nums leading-none"
                  style={{ color: hc }}
                >
                  {fmtXg(data.homeXg)}
                </div>
              </div>
              <div className="text-center shrink-0 pb-0.5">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  xG
                </div>
                <div className="text-xs text-slate-500 tabular-nums">
                  {fmtXg(data.homeXg)} – {fmtXg(data.awayXg)}
                </div>
              </div>
              <div className="min-w-0 flex-1 text-right">
                <div className="text-[10px] uppercase tracking-wide text-slate-400 truncate">
                  {awayName}
                </div>
                <div
                  className="text-2xl font-black tabular-nums leading-none"
                  style={{ color: ac }}
                >
                  {fmtXg(data.awayXg)}
                </div>
              </div>
            </div>

            {/* Simple xG bar */}
            {(() => {
              const h = data.homeXg || 0;
              const a = data.awayXg || 0;
              const t = h + a || 1;
              return (
                <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full"
                    style={{ width: `${(h / t) * 100}%`, backgroundColor: hc }}
                  />
                  <div
                    className="h-full"
                    style={{ width: `${(a / t) * 100}%`, backgroundColor: ac }}
                  />
                </div>
              );
            })()}

            {!compact && (
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-lg bg-slate-50 dark:bg-slate-900 px-2 py-1.5">
                  <div className="text-slate-400 font-semibold uppercase text-[9px]">
                    xGA (opp xG)
                  </div>
                  <div className="tabular-nums font-semibold">
                    {fmtXg(data.homeXga)} – {fmtXg(data.awayXga)}
                  </div>
                </div>
                {data.shotSummary && (
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-900 px-2 py-1.5">
                    <div className="text-slate-400 font-semibold uppercase text-[9px]">
                      Shot map summary
                    </div>
                    <div className="tabular-nums font-semibold">
                      {data.shotSummary.homeShots}–{data.shotSummary.awayShots}{" "}
                      shots
                      <span className="text-slate-400 font-normal">
                        {" "}
                        · on target {data.shotSummary.homeOnTarget}–
                        {data.shotSummary.awayOnTarget}
                      </span>
                    </div>
                  </div>
                )}
                {data.forecast && (
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-900 px-2 py-1.5 col-span-2">
                    <div className="text-slate-400 font-semibold uppercase text-[9px]">
                      Model win probs (from xG)
                    </div>
                    <div className="tabular-nums font-semibold">
                      H {data.forecast.homeWin}% · D {data.forecast.draw}% · A{" "}
                      {data.forecast.awayWin}%
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500 py-1">
            {data?.message || "xG not available for this competition"}
          </p>
        )}
      </div>

      {showCoverage && data?.coverage && data.coverage.length > 0 && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-3 py-2 bg-slate-50/80 dark:bg-slate-900/40">
          <div className="text-[9px] font-bold uppercase tracking-wide text-slate-400 mb-1">
            Free xG coverage (Understat)
          </div>
          <ul className="flex flex-wrap gap-1">
            {data.coverage.map((c) => (
              <li
                key={c.competition}
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] border",
                  c.covered
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-950"
                )}
                title={c.note || undefined}
              >
                {c.covered ? "✓" : "✗"} {c.competition}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Tiny inline chip for live strips: "xG 2.88–0.91 · Understat" or honest empty. */
export function AdvancedStatsStrip({
  matchId,
  className,
}: {
  matchId: string;
  className?: string;
}) {
  const [data, setData] = useState<AdvancedStatsPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/matches/${matchId}/advanced-stats`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as AdvancedStatsPayload;
        if (!cancelled) setData(json);
      } catch {
        /* soft */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  if (!data) return null;

  if (data.available && data.homeXg != null && data.awayXg != null) {
    return (
      <span
        className={cn("tabular-nums text-violet-700 dark:text-violet-300", className)}
        title={data.sourceLabel}
      >
        xG {data.homeXg.toFixed(2)}–{data.awayXg.toFixed(2)}
        <span className="text-slate-400 font-normal"> · Understat</span>
      </span>
    );
  }

  if (!data.coveredCompetition) {
    return (
      <span
        className={cn("text-slate-400", className)}
        title={data.message || undefined}
      >
        xG n/a
      </span>
    );
  }

  return null;
}
