"use client";

import { cn } from "@/lib/utils";

export type StoryScorer = {
  id: string;
  playerName: string;
  clubShort: string;
  goals: number;
  assists?: number;
  side?: "home" | "away" | "other";
};

/**
 * Compact desk strip: season scorers story + attendance beat.
 * Dark craft, soft-fail when empty.
 */
export function StatsStoryStrip({
  scorers,
  attendance,
  venueCapacity,
  homeName,
  awayName,
  className,
}: {
  scorers: StoryScorer[];
  attendance?: number | null;
  venueCapacity?: number | null;
  homeName: string;
  awayName: string;
  className?: string;
}) {
  const top = scorers.slice(0, 6);
  const crowd =
    attendance && attendance > 0
      ? attendance
      : venueCapacity && venueCapacity > 0
        ? Math.round(venueCapacity * 0.78)
        : null;
  const crowdEst = !(attendance && attendance > 0) && crowd != null;

  if (!top.length && crowd == null) return null;

  const homeBits = top.filter((s) => s.side === "home").slice(0, 3);
  const awayBits = top.filter((s) => s.side === "away").slice(0, 3);
  const mixed = !homeBits.length && !awayBits.length ? top.slice(0, 4) : null;

  return (
    <div
      className={cn(
        "stats-story-strip flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[2px] border border-white/[0.06] bg-[#0a0d12] px-2 py-1 text-[10px]",
        className
      )}
      data-stats-story-strip="1"
    >
      <span className="shrink-0 font-semibold uppercase tracking-[0.08em] text-slate-500">
        Story
      </span>

      {homeBits.length > 0 || awayBits.length > 0 ? (
        <>
          {homeBits.length > 0 ? (
            <span className="min-w-0 truncate text-slate-300">
              <span className="text-slate-500">{homeName}</span>{" "}
              {homeBits
                .map((s) => `${s.playerName} ${s.goals}`)
                .join(" · ")}
            </span>
          ) : null}
          {awayBits.length > 0 ? (
            <span className="min-w-0 truncate text-slate-300">
              <span className="text-slate-500">{awayName}</span>{" "}
              {awayBits
                .map((s) => `${s.playerName} ${s.goals}`)
                .join(" · ")}
            </span>
          ) : null}
        </>
      ) : mixed ? (
        <span className="min-w-0 truncate text-slate-300">
          {mixed
            .map((s) => `${s.playerName} (${s.clubShort}) ${s.goals}`)
            .join(" · ")}
        </span>
      ) : (
        <span className="text-slate-600">Scorers soft-fail</span>
      )}

      {crowd != null ? (
        <span
          className="ml-auto shrink-0 tabular-nums text-slate-400"
          title={
            crowdEst
              ? `Estimated from capacity ${venueCapacity?.toLocaleString()}`
              : "Attendance"
          }
        >
          <span className="text-slate-600 uppercase tracking-wide mr-1">
            Att
          </span>
          {crowdEst ? "~" : ""}
          {crowd.toLocaleString()}
          {venueCapacity ? (
            <span className="text-slate-600">
              {" "}
              / {venueCapacity.toLocaleString()}
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
