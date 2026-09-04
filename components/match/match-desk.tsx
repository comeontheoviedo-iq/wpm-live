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
import { FORMATIONS } from "@/lib/formations";
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
    return "Official lineups from API-Football — board stays editable for commentary. Sync resets to official.";
  }
  if (status === "predicted") {
    return "Your personal predicted XI (click squad → tap slot, or drag). Official will override when published.";
  }
  return "Official lineups usually drop 20–60 min before KO — showing Expected (last XI). Click a squad player, then tap a pitch slot.";
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
  const [placing, setPlacing] = useState<SquadPlayer | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  // Desk stays editable even when Official — Sync restores AF XI.
  const locked = false;
  const [homeForm, setHomeForm] = useState(homeFormation);
  const [awayForm, setAwayForm] = useState(awayFormation);
  useEffect(() => {
    setHomeForm(homeFormation);
    setAwayForm(awayFormation);
  }, [homeFormation, awayFormation]);
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

  // Keep placing pointer fresh after refresh
  useEffect(() => {
    if (!placing) return;
    const fresh = squad.find((p) => p.id === placing.id);
    if (fresh) setPlacing(fresh);
    else setPlacing(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squad]);

  useEffect(() => {
    if (!placing) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPlacing(null);
        setMsg(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [placing]);

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

  useEffect(() => {
    if (!configured || !apiFootballFixtureId) return;
    const staleMs = 15 * 60 * 1000;
    const last = lastFeedSyncAt ? new Date(lastFeedSyncAt).getTime() : 0;
    if (!last || Date.now() - last > staleMs) {
      sync(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, apiFootballFixtureId]);

  useEffect(() => {
    if (!configured || !apiFootballFixtureId || status !== "Live") return;
    const t = setInterval(() => sync(true), 45_000);
    return () => clearInterval(t);
  }, [configured, apiFootballFixtureId, status, sync]);

  async function lineupAction(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/matches/${matchId}/lineup`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(json.error || "Lineup update failed");
      } else {
        setMsg(null);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function onSlotDrop(args: {
    side: "home" | "away";
    slotId: string;
    playerId: string;
  }) {
    const player = squad.find((p) => p.id === args.playerId);
    if (!player) return;
    if (player.side !== args.side) {
      setMsg("Players can only be placed on their own team half.");
      return;
    }
    await lineupAction({
      action: "place",
      playerId: args.playerId,
      formationSlot: args.slotId,
    });
    setPlacing(null);
  }

  async function onSlotClick(args: {
    side: "home" | "away";
    slotId: string;
    occupantId?: string | null;
  }) {
    if (!placing) return;
    if (placing.side !== args.side) {
      setMsg("Players can only be placed on their own team half.");
      return;
    }
    // Same player on their current / occupied slot → clear
    if (
      args.occupantId &&
      (args.occupantId === placing.id ||
        (placing.formationSlot === args.slotId &&
          (placing.isStarter || placing.onPitch)))
    ) {
      await lineupAction({ action: "clear", playerId: placing.id });
      setPlacing(null);
      return;
    }
    // Occupied → place (API vacates previous occupant = swap semantics)
    await lineupAction({
      action: "place",
      playerId: placing.id,
      formationSlot: args.slotId,
    });
    setPlacing(null);
  }

  async function onClearSlot(args: {
    side: "home" | "away";
    slotId: string;
    playerId: string;
  }) {
    await lineupAction({ action: "clear", playerId: args.playerId });
    if (placing?.id === args.playerId) setPlacing(null);
  }

  function onSquadClick(p: SquadPlayer) {
    // Click squad player → place mode (official boards stay editable)
    setPlacing(p);
    setSelected(null);
  }

  async function changeFormation(side: "home" | "away", formation: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/formation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side, formation }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(json.error || "Formation update failed");
      } else {
        if (side === "home") setHomeForm(formation);
        else setAwayForm(formation);
        setMsg(`${side === "home" ? "Home" : "Away"} → ${formation} (starters remapped)`);
        router.refresh();
      }
    } catch {
      setMsg("Formation update failed");
    } finally {
      setBusy(false);
    }
  }

  const playerNotes = useMemo(() => {
    if (!selected) return notes;
    return notes.filter((n) => n.entityId === selected.id);
  }, [notes, selected]);

  const placingOnXi = Boolean(
    placing &&
      placing.formationSlot &&
      (placing.isStarter || placing.onPitch)
  );

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
            ? "Official (editable)"
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

      {/* Placing banner */}
      {placing && (
        <div className="shrink-0 flex flex-wrap items-center gap-2 rounded-lg border border-sky-300 bg-sky-50 dark:bg-sky-950/50 dark:border-sky-800 px-3 py-1.5 text-xs">
          <span className="font-semibold text-sky-900 dark:text-sky-100">
            Tap a pitch slot for {placing.name}
            <span className="font-normal text-sky-700 dark:text-sky-300">
              {" "}
              · Esc cancel
            </span>
          </span>
          {placingOnXi && (
            <button
              type="button"
              className="rounded-md bg-rose-600 hover:bg-rose-500 text-white px-2 py-0.5 text-[10px] font-semibold"
              onClick={() =>
                lineupAction({ action: "clear", playerId: placing.id }).then(
                  () => setPlacing(null)
                )
              }
            >
              Remove from XI
            </button>
          )}
          <button
            type="button"
            className="ml-auto text-sky-700 dark:text-sky-300 hover:underline"
            onClick={() => setPlacing(null)}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Main grid: pitch + squad */}
      <div className="min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-2 overflow-hidden">
        <section className="min-h-0 flex flex-col gap-1.5 overflow-hidden">
          <div className="shrink-0 flex flex-wrap items-center gap-2 px-0.5">
            <p className="text-[10px] text-slate-500 flex-1 min-w-[12rem]">
              {lineupHint(lineupStatus)}
              {starterCount === 0 && (
                <span className="text-amber-600">
                  {" "}
                  Empty pitch — Sync squads / last XI, then click a player and tap
                  a slot.
                </span>
              )}
            </p>
            <label className="text-[10px] text-slate-600 dark:text-slate-300 flex items-center gap-1">
              Home
              <select
                className="rounded-md border border-slate-200 dark:border-slate-700 bg-transparent px-1.5 py-0.5 text-[11px] font-semibold"
                value={homeForm}
                disabled={busy}
                onChange={(e) => changeFormation("home", e.target.value)}
              >
                {Object.keys(FORMATIONS).map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[10px] text-slate-600 dark:text-slate-300 flex items-center gap-1">
              Away
              <select
                className="rounded-md border border-slate-200 dark:border-slate-700 bg-transparent px-1.5 py-0.5 text-[11px] font-semibold"
                value={awayForm}
                disabled={busy}
                onChange={(e) => changeFormation("away", e.target.value)}
              >
                {Object.keys(FORMATIONS).map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            {lineupStatus === "confirmed" && apiFootballFixtureId && (
              <button
                type="button"
                className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 hover:underline"
                disabled={busy}
                onClick={() => sync(false)}
                title="Re-sync official lineups from API-Football"
              >
                Reset to official
              </button>
            )}
          </div>
          <div className="min-h-0 flex-1">
            <PitchBoard
              homeName={homeName}
              awayName={awayName}
              homeColor={homeColor}
              awayColor={awayColor}
              homeFormation={homeForm}
              awayFormation={awayForm}
              homePlayers={homePlayers}
              awayPlayers={awayPlayers}
              homeCoach={homeCoach}
              awayCoach={awayCoach}
              referee={referee}
              lineupStatus={lineupStatus}
              onPlayerClick={(p) => {
                if (placing) return; // placing mode handles slot clicks
                const full = squad.find((s) => s.id === p.id);
                if (full) setSelected(full);
              }}
              onSlotDrop={onSlotDrop}
              onSlotClick={onSlotClick}
              onClearSlot={onClearSlot}
              placingPlayerId={placing?.id}
              placingSide={placing?.side}
              locked={false}
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
            placingId={placing?.id}
            onPlayerClick={onSquadClick}
            onRemoveFromXi={(p) =>
              lineupAction({ action: "clear", playerId: p.id }).then(() => {
                if (placing?.id === p.id) setPlacing(null);
              })
            }
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
