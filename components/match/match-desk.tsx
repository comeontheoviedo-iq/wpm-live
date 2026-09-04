"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  Sparkles,
  X,
  AlertTriangle,
  Link2,
} from "lucide-react";
import { PitchBoard, type PitchPlayer } from "@/components/match/pitch";
import { SquadRail, type SquadPlayer } from "@/components/match/squad-rail";
import { NotesPanel, type NoteRow } from "@/components/notes/notes-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Coach = { name: string; nationality: string; age: number | null };

type Predictions = {
  advice?: string | null;
  percent?: { home?: number | null; draw?: number | null; away?: number | null };
  winner?: { name?: string | null } | null;
};

function parsePredictions(json: string | null | undefined): Predictions | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as Predictions;
  } catch {
    return null;
  }
}

function lineupHint(status: string) {
  if (status === "confirmed") {
    return "Official lineups from API-Football — board is locked.";
  }
  if (status === "predicted") {
    return "Your personal predicted XI (drag squad → pitch to rearrange). Official will override when published.";
  }
  return "Official lineups usually drop 20–60 min before KO — showing Expected (last XI). Drag to set your predicted XI.";
}

export function MatchDesk({
  matchId,
  homeName,
  awayName,
  homeFullName,
  awayFullName,
  homeColor,
  awayColor,
  homeFormation,
  awayFormation,
  homePlayers,
  awayPlayers,
  homeCoach,
  awayCoach,
  referee,
  lineupStatus,
  apiFootballFixtureId,
  lastFeedSyncAt,
  status,
  kickoffLabel,
  competition,
  homeScore,
  awayScore,
  minute,
  notes,
  injuryCount,
  predictionsAdvice,
  predictionsJson,
  h2hSummary,
  packCount,
}: {
  matchId: string;
  homeName: string;
  awayName: string;
  homeFullName: string;
  awayFullName: string;
  homeColor: string;
  awayColor: string;
  homeFormation: string;
  awayFormation: string;
  homePlayers: PitchPlayer[];
  awayPlayers: PitchPlayer[];
  homeCoach?: Coach | null;
  awayCoach?: Coach | null;
  referee?: string;
  lineupStatus: string;
  apiFootballFixtureId: number | null;
  lastFeedSyncAt: string | Date | null;
  status: string;
  kickoffLabel: string;
  competition: string;
  homeScore: number;
  awayScore: number;
  minute: number;
  notes: NoteRow[];
  injuryCount: number;
  predictionsAdvice: string | null;
  predictionsJson: string | null;
  h2hSummary: string | null;
  packCount: number;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<SquadPlayer | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const locked = lineupStatus === "confirmed";
  const preds = useMemo(
    () => parsePredictions(predictionsJson),
    [predictionsJson]
  );

  const squad: SquadPlayer[] = useMemo(() => {
    const noteCount = (id: string) =>
      notes.filter((n) => n.entityId === id).length;
    return [
      ...homePlayers.map((p) => ({
        ...p,
        side: "home" as const,
        team: homeName,
        noteCount: noteCount(p.id),
      })),
      ...awayPlayers.map((p) => ({
        ...p,
        side: "away" as const,
        team: awayName,
        noteCount: noteCount(p.id),
      })),
    ];
  }, [homePlayers, awayPlayers, homeName, awayName, notes]);

  const starterCount =
    homePlayers.filter((p) => p.isStarter || p.onPitch).length +
    awayPlayers.filter((p) => p.isStarter || p.onPitch).length;

  const sync = useCallback(
    async (silent = false) => {
      if (!apiFootballFixtureId) {
        if (!silent) setMsg("Link an API-Football fixture first (Prep).");
        return;
      }
      setBusy(true);
      if (!silent) setMsg(null);
      try {
        const res = await fetch(`/api/matches/${matchId}/sync`, {
          method: "POST",
        });
        const json = await res.json();
        if (!res.ok) {
          setMsg(json.error || "Sync failed");
        } else {
          if (!silent) {
            setMsg(
              `Synced · ${json.lineupStatus} · squads ${json.squadHome ?? 0}/${json.squadAway ?? 0} · injuries ${json.injuryCount ?? 0}`
            );
          }
          router.refresh();
        }
      } catch {
        setMsg("Sync failed");
      } finally {
        setBusy(false);
      }
    },
    [apiFootballFixtureId, matchId, router]
  );

  useEffect(() => {
    fetch("/api/integrations")
      .then((r) => r.json())
      .then((j) => setConfigured(Boolean(j.apiFootball)))
      .catch(() => setConfigured(false));
  }, []);

  // Auto-sync when feed stale (>15 min) or never
  useEffect(() => {
    if (!configured || !apiFootballFixtureId) return;
    const staleMs = 15 * 60 * 1000;
    const last = lastFeedSyncAt ? new Date(lastFeedSyncAt).getTime() : 0;
    if (!last || Date.now() - last > staleMs) {
      sync(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, apiFootballFixtureId]);

  // Live poll
  useEffect(() => {
    if (!configured || !apiFootballFixtureId || status !== "Live") return;
    const t = setInterval(() => sync(true), 45_000);
    return () => clearInterval(t);
  }, [configured, apiFootballFixtureId, status, sync]);

  async function onSlotDrop(args: {
    side: "home" | "away";
    slotId: string;
    playerId: string;
  }) {
    if (locked) {
      setMsg("Official lineups locked");
      return;
    }
    const player = squad.find((p) => p.id === args.playerId);
    if (!player) return;
    if (player.side !== args.side) {
      setMsg("Players can only be placed on their own team half.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/matches/${matchId}/lineup`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "place",
          playerId: args.playerId,
          formationSlot: args.slotId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(json.error || "Could not place player");
      } else {
        setMsg(null);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  const playerNotes = useMemo(() => {
    if (!selected) return notes;
    return notes.filter((n) => n.entityId === selected.id);
  }, [notes, selected]);

  return (
    <div className="h-[calc(100dvh-7.5rem)] max-h-[100dvh] min-h-[420px] grid grid-rows-[auto_auto_1fr] gap-2 overflow-hidden">
      {/* Top bar */}
      <header className="shrink-0 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="font-bold text-sm sm:text-base truncate">
            {homeFullName}{" "}
            <span className="text-slate-400 font-normal">vs</span>{" "}
            {awayFullName}
            {status === "Live" && (
              <span className="ml-2 text-rose-600 font-semibold tabular-nums">
                {minute}&apos; {homeScore}-{awayScore}
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 truncate">
            {competition} · {kickoffLabel} · {status}
            {apiFootballFixtureId ? ` · #${apiFootballFixtureId}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link
            href={`/match-day/${matchId}/packs`}
            className="inline-flex items-center gap-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white px-2.5 py-1.5 text-xs font-semibold"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Packs{packCount ? ` (${packCount})` : ""}
          </Link>
          {!apiFootballFixtureId && (
            <Link
              href={`/match-day/${matchId}/prep`}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs"
            >
              <Link2 className="h-3.5 w-3.5" /> Link fixture
            </Link>
          )}
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || !apiFootballFixtureId}
            onClick={() => sync(false)}
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5 mr-1", busy && "animate-spin")}
            />
            Sync
          </Button>
        </div>
      </header>

      {/* Intel strip */}
      <div className="shrink-0 flex flex-wrap items-center gap-2 text-[11px]">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-semibold text-white",
            lineupStatus === "confirmed"
              ? "bg-emerald-600"
              : lineupStatus === "predicted"
                ? "bg-sky-600"
                : "bg-amber-500"
          )}
        >
          {lineupStatus === "confirmed"
            ? "Official"
            : lineupStatus === "predicted"
              ? "Your predicted XI"
              : "Expected (last XI)"}
        </span>
        <span className="rounded-full border border-slate-200 dark:border-slate-700 px-2 py-0.5">
          Injuries {injuryCount}
        </span>
        {(predictionsAdvice || preds?.advice) && (
          <span
            className="rounded-full border border-teal-200 dark:border-teal-900 bg-teal-50 dark:bg-teal-950/40 px-2 py-0.5 text-teal-800 dark:text-teal-200 truncate max-w-[280px]"
            title={predictionsAdvice || preds?.advice || ""}
          >
            Pred: {predictionsAdvice || preds?.advice}
            {preds?.percent?.home != null
              ? ` · ${preds.percent.home}/${preds.percent.draw}/${preds.percent.away}%`
              : ""}
          </span>
        )}
        {h2hSummary && (
          <span className="rounded-full border border-slate-200 dark:border-slate-700 px-2 py-0.5 truncate max-w-[320px]">
            {h2hSummary}
          </span>
        )}
        {configured === false && (
          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-3 w-3" /> API_FOOTBALL_KEY missing
          </span>
        )}
        {msg && <span className="text-slate-500 truncate">{msg}</span>}
      </div>

      {/* Main grid: pitch + squad */}
      <div className="min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-2 overflow-hidden">
        <section className="min-h-0 flex flex-col gap-1.5 overflow-hidden">
          <p className="text-[10px] text-slate-500 shrink-0 px-0.5">
            {lineupHint(lineupStatus)}
            {starterCount === 0 && (
              <span className="text-amber-600">
                {" "}
                Empty pitch — Sync squads / last XI, then drag players onto
                slots.
              </span>
            )}
          </p>
          <div className="min-h-0 flex-1">
            <PitchBoard
              homeName={homeName}
              awayName={awayName}
              homeColor={homeColor}
              awayColor={awayColor}
              homeFormation={homeFormation}
              awayFormation={awayFormation}
              homePlayers={homePlayers}
              awayPlayers={awayPlayers}
              homeCoach={homeCoach}
              awayCoach={awayCoach}
              referee={referee}
              lineupStatus={lineupStatus}
              onPlayerClick={(p) => {
                const full = squad.find((s) => s.id === p.id);
                if (full) setSelected(full);
              }}
              onSlotDrop={locked ? undefined : onSlotDrop}
              locked={locked}
              compact
            />
          </div>
        </section>

        <aside className="min-h-0 overflow-hidden">
          <SquadRail
            players={squad}
            homeName={homeName}
            awayName={awayName}
            homeColor={homeColor}
            awayColor={awayColor}
            locked={locked}
            selectedId={selected?.id}
            onPlayerClick={(p) => setSelected(p)}
          />
        </aside>
      </div>

      {/* Notes drawer */}
      {selected && (
        <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md shadow-2xl border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800">
            <div className="min-w-0">
              <div className="text-sm font-bold truncate">{selected.name}</div>
              <div className="text-[11px] text-slate-500">
                #{selected.shirtNumber} · {selected.team} ·{" "}
                {selected.position || "—"}
                {selected.formationSlot
                  ? ` · ${selected.formationSlot}`
                  : ""}
              </div>
            </div>
            <button
              type="button"
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => setSelected(null)}
              aria-label="Close notes"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            <NotesPanel
              matchId={matchId}
              initialNotes={playerNotes}
              entityType="player"
              entityId={selected.id}
              entityLabel={selected.name}
            />
          </div>
        </div>
      )}
    </div>
  );
}
