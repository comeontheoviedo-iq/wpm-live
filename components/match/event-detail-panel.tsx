"use client";

/**
 * Big live event detail panel — Goal / Yellow / Red / Sub.
 * Desk-first snapshot, then optional AF enrich. Dismissible; does not block commentary.
 */

import { useEffect, useRef, useState } from "react";
import { X, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import { playerPhotoUrl } from "@/lib/flags";
import { ordinal } from "@/lib/season-tally";
import {
  dash,
  type DeskEventDetailSnapshot,
  type EventDetailKind,
} from "@/lib/event-detail";

export type EventDetailEnrich = {
  goalsCompetitionNow?: number | null;
  goalsAllCompsNow?: number | null;
  competitionOrdinal?: number | null;
  assistsCompetitionNow?: number | null;
  assistsAllCompsNow?: number | null;
  yellowsNow?: number | null;
  redsNow?: number | null;
  suspension?: {
    known: boolean;
    threshold: number | null;
    remaining: number | null;
    label: string;
  } | null;
  previousGoal?: {
    date: string;
    opponent: string;
    ago: string | null;
    league?: string | null;
  } | null;
  narratives?: { text: string }[];
  bench?: {
    subApps: number;
    goalsOffBench: number;
    assistsOffBench: number;
    against: { opponent: string; goals: number; assists: number; date: string }[];
  } | null;
  suspensionsThisSeason?: {
    type: string;
    start: string | null;
    end: string | null;
  }[];
  formError?: string | null;
  formSampleSize?: number;
};

/** Auto-open dwell: 20s then dismiss (user can close earlier; pin pauses auto-dismiss). */
const AUTO_MS: Record<EventDetailKind, number> = {
  goal: 20_000,
  yellow: 20_000,
  red: 20_000,
  sub: 20_000,
};

function kindLabel(kind: EventDetailKind, type: string): string {
  if (kind === "goal") {
    if (/own_goal/i.test(type)) return "OWN GOAL";
    if (/penalty/i.test(type)) return "PENALTY GOAL";
    return "GOAL";
  }
  if (kind === "yellow") return "YELLOW CARD";
  if (kind === "red") return "RED CARD";
  return "SUBSTITUTION";
}

function StatRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string | null;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/5 py-1 last:border-0">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <span className="text-right text-[12px] font-semibold tabular-nums text-slate-100">
        {value}
        {hint ? (
          <span className="ml-1 text-[10px] font-normal text-slate-500">
            {hint}
          </span>
        ) : null}
      </span>
    </div>
  );
}

function Photo({
  url,
  name,
  accent,
}: {
  url: string | null;
  name: string;
  accent: string;
}) {
  return (
    <div
      className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/15"
      style={{ boxShadow: `inset 0 0 0 2px ${accent}33` }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover object-top" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-slate-800 text-lg font-bold text-slate-400">
          {(name || "?").slice(0, 1)}
        </div>
      )}
    </div>
  );
}

export function EventDetailPanel({
  snapshot,
  enrich,
  enriching,
  autoDismiss,
  onClose,
  onPinToggle,
  pinned,
  className,
}: {
  snapshot: DeskEventDetailSnapshot;
  enrich?: EventDetailEnrich | null;
  enriching?: boolean;
  /** When true (auto-open), schedule dismiss. Click-open stays until closed unless pinned. */
  autoDismiss?: boolean;
  onClose: () => void;
  onPinToggle?: () => void;
  pinned?: boolean;
  className?: string;
}) {
  const { kind } = snapshot;
  const rootRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  useEffect(() => {
    if (!autoDismiss || pinned || hovered) return;
    const t = window.setTimeout(() => onClose(), AUTO_MS[kind] || 20_000);
    return () => window.clearTimeout(t);
  }, [autoDismiss, pinned, hovered, kind, onClose, snapshot.minute, snapshot.description]);

  const accent =
    kind === "goal"
      ? "#34d399"
      : kind === "red"
        ? "#f43f5e"
        : kind === "yellow"
          ? "#fbbf24"
          : "#38bdf8";

  const goalsComp =
    enrich?.goalsCompetitionNow ?? snapshot.goalsCompetitionNow;
  const goalsAll = enrich?.goalsAllCompsNow ?? snapshot.goalsAllCompsNow;
  // Assist tallies stay desk/snapshot — enrich is for the primary (scorer/ON/booked) player
  const assistsComp = snapshot.assistsCompetitionNow;
  const assistsAll = snapshot.assistsAllCompsNow;
  const yellows = enrich?.yellowsNow ?? snapshot.yellowsNow;
  const reds = enrich?.redsNow ?? snapshot.redsNow;
  const suspension = enrich?.suspension ?? snapshot.suspension;
  const previousGoal = enrich?.previousGoal ?? null;
  const narratives = enrich?.narratives || [];
  const bench = enrich?.bench ?? null;
  const suspensions = enrich?.suspensionsThisSeason || [];

  const primaryName =
    kind === "sub"
      ? snapshot.playerOn?.name || "—"
      : snapshot.player?.name ||
        snapshot.description.replace(/^.*?—\s*/, "").split("(")[0]?.trim() ||
        "—";

  const photo = playerPhotoUrl({
    photoUrl: snapshot.photoUrl,
    apiFootballPlayerId: snapshot.player?.apiFootballPlayerId,
  });

  const title = `${kindLabel(kind, snapshot.type)} ${snapshot.minute}'`;

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label={title}
      data-cocomms="event-detail-panel"
      data-kind={kind}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "event-detail-panel pointer-events-auto w-[min(94vw,28rem)] overflow-hidden rounded-xl border border-white/10 bg-[var(--surface-glass)] shadow-2xl backdrop-blur-md",
        className
      )}
      style={{ borderLeftWidth: 3, borderLeftColor: accent }}
    >
      <div className="flex items-start justify-between gap-2 border-b border-white/8 px-3 py-2">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {kind === "goal"
              ? "Goal"
              : kind === "sub"
                ? "Sub"
                : kind === "red"
                  ? "Sent off"
                  : "Card"}
            {snapshot.scoreline ? ` · ${snapshot.scoreline}` : ""}
            {enriching ? " · updating…" : ""}
          </div>
          <div className="truncate text-sm font-extrabold tracking-tight text-slate-50">
            {title}
            <span className="ml-1.5 font-bold text-slate-300">{primaryName}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {onPinToggle ? (
            <button
              type="button"
              className="rounded p-1.5 text-slate-400 hover:bg-white/5 hover:text-amber-300"
              title={pinned ? "Unpin" : "Keep open"}
              onClick={onPinToggle}
            >
              <Pin
                className={cn("h-3.5 w-3.5", pinned && "fill-amber-400 text-amber-400")}
              />
            </button>
          ) : null}
          <button
            type="button"
            className="rounded p-1.5 text-slate-400 hover:bg-white/5 hover:text-rose-300"
            title="Dismiss (Esc)"
            onClick={onClose}
            aria-label="Close event detail"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-3 px-3 py-2.5">
        <Photo url={photo} name={primaryName} accent={accent} />
        <div className="min-w-0 flex-1">
          {kind === "goal" && (
            <>
              <StatRow
                label={`${snapshot.competitionName} goals`}
                value={
                  snapshot.isOwnGoal
                    ? "—"
                    : (() => {
                        const nth =
                          enrich?.competitionOrdinal ??
                          snapshot.competitionOrdinal;
                        if (nth != null && Number.isFinite(nth)) {
                          return `${ordinal(nth)} this season`;
                        }
                        return dash(goalsComp);
                      })()
                }
                hint={
                  snapshot.isOwnGoal || goalsComp == null
                    ? undefined
                    : `${dash(goalsComp)} total`
                }
              />
              <StatRow
                label="All comps goals"
                value={snapshot.isOwnGoal ? "—" : dash(goalsAll)}
              />
              {!snapshot.isOwnGoal && (
                <>
                  <StatRow
                    label="Assist"
                    value={
                      snapshot.assistName
                        ? snapshot.assister?.name || snapshot.assistName
                        : "—"
                    }
                  />
                  {snapshot.assistName ? (
                    <>
                      <StatRow
                        label="Assist · this comp"
                        value={dash(assistsComp)}
                      />
                      <StatRow
                        label="Assist · all comps"
                        value={dash(assistsAll)}
                      />
                    </>
                  ) : null}
                </>
              )}
              {previousGoal ? (
                <StatRow
                  label="Previous goal"
                  value={`${previousGoal.date} vs ${previousGoal.opponent}`}
                  hint={previousGoal.ago}
                />
              ) : enrich?.formError ? (
                <StatRow label="Previous goal" value="—" hint={enrich.formError} />
              ) : enrich && !enriching ? (
                <StatRow label="Previous goal" value="—" hint="none in recent form" />
              ) : (
                <StatRow label="Previous goal" value="—" hint={enriching ? "…" : undefined} />
              )}
              {narratives.map((n, i) => (
                <div
                  key={i}
                  className="mt-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] leading-snug text-emerald-200/95"
                >
                  {n.text}
                </div>
              ))}
            </>
          )}

          {(kind === "yellow" || kind === "red") && (
            <>
              <StatRow label="Yellows this season" value={dash(yellows)} />
              <StatRow label="Reds this season" value={dash(reds)} />
              {suspension ? (
                <div className="mt-1.5 rounded-md bg-amber-500/10 px-2 py-1.5 text-[11px] leading-snug text-amber-100/95">
                  {suspension.label}
                </div>
              ) : null}
              {suspensions.length > 0 ? (
                <div className="mt-1.5 space-y-0.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Suspensions this season
                  </div>
                  {suspensions.map((s, i) => (
                    <div key={i} className="text-[11px] text-slate-300">
                      {s.type}
                      {s.start ? ` · ${s.start}` : ""}
                      {s.end ? ` → ${s.end}` : ""}
                    </div>
                  ))}
                </div>
              ) : kind === "yellow" || kind === "red" ? (
                <div className="mt-1 text-[10px] text-slate-500">
                  No prior suspensions listed this season (AF sidelined)
                </div>
              ) : null}
            </>
          )}

          {kind === "sub" && (
            <>
              <StatRow label="Player ON" value={primaryName} />
              <StatRow
                label="ON for"
                value={snapshot.playerOff?.name || "—"}
              />
              <StatRow
                label="Age"
                value={
                  snapshot.playerAge != null ? String(snapshot.playerAge) : "—"
                }
              />
              <StatRow
                label="Position"
                value={snapshot.playerOn?.position || "—"}
              />
              <StatRow
                label="Sub #"
                value={
                  snapshot.subOrdinal != null
                    ? ordinal(snapshot.subOrdinal)
                    : "—"
                }
                hint="this team, this match"
              />
              {bench ? (
                <>
                  <StatRow
                    label="Came on as sub"
                    value={`${bench.subApps} times`}
                    hint="recent form"
                  />
                  <StatRow
                    label="Bench impact"
                    value={`${bench.goalsOffBench}G / ${bench.assistsOffBench}A`}
                    hint="off bench"
                  />
                  {bench.against.length > 0 ? (
                    <div className="mt-1 space-y-0.5">
                      {bench.against.slice(0, 3).map((a, i) => (
                        <div key={i} className="text-[11px] text-slate-300">
                          vs {a.opponent}
                          {a.goals ? ` · ${a.goals}G` : ""}
                          {a.assists ? ` · ${a.assists}A` : ""}
                          <span className="text-slate-500"> · {a.date}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <StatRow
                  label="Bench impact"
                  value="—"
                  hint={enriching ? "…" : enrich?.formError || undefined}
                />
              )}
            </>
          )}

          {snapshot.noteHook ? (
            <div className="mt-1.5 rounded-md bg-sky-500/10 px-2 py-1 text-[11px] leading-snug text-sky-100/95">
              Note: {snapshot.noteHook}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Stable key for an AF/desk event (aligns with ticker pin keys). */
export function eventDetailKey(ev: {
  minute: number;
  type: string;
  description: string;
}): string {
  return `${ev.minute}|${ev.type}|${ev.description}`;
}

export type EventDetailEnrichArgs = {
  kind: EventDetailKind;
  type: string;
  playerId?: string | null;
  afPlayerId?: number | null;
  teamAfId?: number | null;
  opponentName?: string | null;
  matchStatus?: string;
  inMatchGoals?: number;
  inMatchAssists?: number;
  inMatchYellows?: number;
  inMatchReds?: number;
  includeForm?: boolean;
};

/** Connected panel: desk snapshot + AF enrich. */
export function EventDetailPanelConnected({
  matchId,
  snapshot,
  enrichArgs,
  autoDismiss,
  onClose,
  onPinToggle,
  pinned,
  className,
}: {
  matchId: string;
  snapshot: DeskEventDetailSnapshot;
  enrichArgs: EventDetailEnrichArgs;
  autoDismiss?: boolean;
  onClose: () => void;
  onPinToggle?: () => void;
  pinned?: boolean;
  className?: string;
}) {
  const [enrich, setEnrich] = useState<EventDetailEnrich | null>(null);
  const [enriching, setEnriching] = useState(false);
  const key = [
    enrichArgs.kind,
    enrichArgs.type,
    enrichArgs.playerId || "",
    enrichArgs.afPlayerId || "",
    enrichArgs.teamAfId || "",
    enrichArgs.inMatchGoals || 0,
    enrichArgs.inMatchAssists || 0,
    enrichArgs.inMatchYellows || 0,
    enrichArgs.inMatchReds || 0,
    enrichArgs.includeForm === false ? "0" : "1",
    snapshot.minute,
    snapshot.description,
  ].join("|");

  useEffect(() => {
    const ac = new AbortController();
    setEnriching(true);
    setEnrich(null);
    void (async () => {
      try {
        const res = await fetch(`/api/matches/${matchId}/event-detail`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(enrichArgs),
          signal: ac.signal,
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = await res.json();
        if (ac.signal.aborted) return;
        setEnrich({
          goalsCompetitionNow: json.goalsCompetitionNow,
          goalsAllCompsNow: json.goalsAllCompsNow,
          competitionOrdinal: json.competitionOrdinal,
          assistsCompetitionNow: json.assistsCompetitionNow,
          assistsAllCompsNow: json.assistsAllCompsNow,
          yellowsNow: json.yellowsNow,
          redsNow: json.redsNow,
          suspension: json.suspension,
          previousGoal: json.previousGoal,
          narratives: json.narratives,
          bench: json.bench,
          suspensionsThisSeason: json.suspensionsThisSeason,
          formError: json.formError,
          formSampleSize: json.formSampleSize,
        });
      } catch (e) {
        if ((e as { name?: string })?.name === "AbortError") return;
      } finally {
        if (!ac.signal.aborted) setEnriching(false);
      }
    })();
    return () => ac.abort();
    // enrichArgs captured via key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, key]);

  return (
    <EventDetailPanel
      snapshot={snapshot}
      enrich={enrich}
      enriching={enriching}
      autoDismiss={autoDismiss}
      onClose={onClose}
      onPinToggle={onPinToggle}
      pinned={pinned}
      className={className}
    />
  );
}
