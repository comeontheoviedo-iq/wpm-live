"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type ScoreFx = {
  id: number;
  date: string;
  status: string;
  elapsed: number | null;
  extra: number | null;
  home: { id: number; name: string };
  away: { id: number; name: string };
  goals: { home: number | null; away: number | null };
};

type Mode = "live" | "upcoming" | "empty";

/** Drop common club suffixes so chips stay glanceable. */
function shortClub(name: string) {
  const cleaned = name
    .replace(/\b(FC|CF|AFC|SC|FK|SK|AC|AS|SS|UD|CD|RC|IF)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const parts = cleaned.split(" ").filter(Boolean);
  if (!parts.length) return name.slice(0, 10);
  if (parts.length === 1) return parts[0]!.slice(0, 10);
  const last = parts[parts.length - 1]!;
  if (/^(United|City|Town|Athletic|Hotspur)$/i.test(last)) {
    return `${parts[parts.length - 2]!.slice(0, 3)} ${last.slice(0, 3)}`;
  }
  return last.slice(0, 10);
}

function liveClock(fx: ScoreFx) {
  const short = (fx.status || "").toUpperCase();
  if (short === "HT") return "HT";
  if (short === "P" || short === "PEN") return "PEN";
  if (short === "BT") return "BT";
  if (fx.elapsed == null) return short || "LIVE";
  if (fx.extra && fx.extra > 0) return `${fx.elapsed}+${fx.extra}'`;
  return `${fx.elapsed}'`;
}

function kickoffChip(iso: string) {
  try {
    const d = new Date(iso);
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const time = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
    if (day === today) return time;
    const wd = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      weekday: "short",
    }).format(d);
    return `${wd} ${time}`;
  } catch {
    return "—";
  }
}

/**
 * Compact desk strip: other live scores in this competition, or upcoming
 * fixtures when the league is quiet. Soft-fail empty. Lean poll only.
 */
export function CompetitionScoresStrip({
  matchId,
  className,
}: {
  matchId: string;
  className?: string;
}) {
  const [mode, setMode] = useState<Mode>("empty");
  const [fixtures, setFixtures] = useState<ScoreFx[]>([]);

  const load = useCallback(() => {
    fetch(`/api/matches/${matchId}/competition-scores`)
      .then((r) => r.json())
      .then((j) => {
        const list = Array.isArray(j.fixtures) ? (j.fixtures as ScoreFx[]) : [];
        const nextMode: Mode =
          j.mode === "live" || j.mode === "upcoming" ? j.mode : "empty";
        setMode(list.length ? nextMode : "empty");
        setFixtures(list);
      })
      .catch(() => {
        /* soft-fail — keep last chips */
      });
  }, [matchId]);

  useEffect(() => {
    load();
    const ms = mode === "live" ? 45_000 : mode === "upcoming" ? 120_000 : 90_000;
    const t = setInterval(load, ms);
    return () => clearInterval(t);
  }, [load, mode]);

  if (!fixtures.length) return null;

  const label = mode === "live" ? "Live" : "Next";

  return (
    <div
      className={cn(
        "competition-scores-strip flex items-center gap-x-2.5 overflow-x-auto scrollbar-none rounded-[2px] border border-white/[0.06] bg-[#0a0d12] px-2 py-1 text-[10px]",
        className
      )}
      data-competition-scores-strip="1"
      data-scores-mode={mode}
    >
      <span
        className={cn(
          "shrink-0 font-semibold uppercase tracking-[0.08em]",
          mode === "live" ? "text-rose-400" : "text-slate-500"
        )}
      >
        {label}
      </span>
      {fixtures.map((fx) =>
        mode === "live" ? (
          <span
            key={fx.id}
            className="min-w-0 shrink-0 tabular-nums text-slate-300"
            title={`${fx.home.name} ${fx.goals.home ?? "–"}–${fx.goals.away ?? "–"} ${fx.away.name}`}
          >
            <span className="text-slate-400">{shortClub(fx.home.name)}</span>{" "}
            <span className="font-bold text-slate-100">
              {fx.goals.home ?? "–"}–{fx.goals.away ?? "–"}
            </span>{" "}
            <span className="text-slate-400">{shortClub(fx.away.name)}</span>
            <span className="ml-1 text-rose-400/90">{liveClock(fx)}</span>
          </span>
        ) : (
          <span
            key={fx.id}
            className="min-w-0 shrink-0 text-slate-300"
            title={`${fx.home.name} vs ${fx.away.name}`}
          >
            <span className="tabular-nums text-slate-500">
              {kickoffChip(fx.date)}
            </span>{" "}
            <span className="text-slate-400">{shortClub(fx.home.name)}</span>
            <span className="text-slate-600">–</span>
            <span className="text-slate-400">{shortClub(fx.away.name)}</span>
          </span>
        )
      )}
    </div>
  );
}
