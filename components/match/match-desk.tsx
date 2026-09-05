"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  Sparkles,
  AlertTriangle,
  Link2,
  CloudSun,
  MapPin,
  ChevronDown,
  Radio,
  Info,
} from "lucide-react";
import { PitchBoard, type PitchPlayer } from "@/components/match/pitch";
import { SquadRail, type SquadPlayer } from "@/components/match/squad-rail";
import {
  NotesPanel,
  type NoteRow,
  type NotesFilterScope,
} from "@/components/notes/notes-panel";
import { PlayerDossier } from "@/components/match/player-dossier";
import { EventTimeline } from "@/components/match/event-timeline";
import { EventComposer } from "@/components/live/event-composer";
import { Button } from "@/components/ui/button";
import { FORMATIONS } from "@/lib/formations";
import { cn } from "@/lib/utils";

type Coach = { name: string; nationality: string; age: number | null };

type Predictions = {
  advice?: string | null;
  percent?: { home?: number | null; draw?: number | null; away?: number | null };
  winner?: { name?: string | null } | null;
};

type MatchEventRow = {
  id: string;
  type: string;
  minute: number;
  description: string;
  teamSide: string | null;
  playerId: string | null;
};

type StatRow = { label: string; homeValue: string; awayValue: string };
type ScorerRow = {
  id: string;
  goals: number;
  assists: number;
  rank: number;
  playerName: string;
  clubShort: string;
  side: "home" | "away" | "other";
};
type KeeperRow = {
  id: string;
  cleanSheets: number;
  saves: number;
  appearances: number;
  rank: number;
  playerName: string;
  clubShort: string;
  side: "home" | "away" | "other";
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
  if (status === "confirmed") return "Official XI · editable";
  if (status === "predicted") return "Your predicted XI";
  return "Expected XI · click squad → tap slot";
}

function enrichPlayers(
  players: PitchPlayer[],
  events: MatchEventRow[]
): PitchPlayer[] {
  const subbedOutNames = new Set<string>();
  const subbedOutIds = new Set<string>();
  for (const e of events) {
    if (e.type !== "sub") continue;
    // AF sync: player = out, assist name often in "(Name)"
    if (e.playerId) subbedOutIds.add(e.playerId);
    const m = e.description.match(/^[^—]+—\s*([^(\n]+)/);
    const outName = m?.[1]?.trim();
    if (outName) subbedOutNames.add(outName.toLowerCase());
  }
  return players.map((p) => {
    const mine = events.filter(
      (e) =>
        e.playerId === p.id ||
        (e.description && e.description.includes(p.name))
    );
    const matchGoals = mine.filter((e) =>
      ["goal", "penalty_goal", "own_goal"].includes(e.type)
    ).length;
    const matchAssists = mine.filter(
      (e) =>
        e.description.toLowerCase().includes(`(${p.name.toLowerCase()})`) ||
        (e.type === "goal" && e.description.toLowerCase().includes("assist"))
    ).length;
    const matchYellow = mine.some((e) => e.type === "yellow");
    const matchRed = mine.some((e) => e.type === "red");
    const subbedOff =
      subbedOutIds.has(p.id) ||
      subbedOutNames.has(p.name.toLowerCase()) ||
      mine.some(
        (e) =>
          e.type === "sub" &&
          e.playerId === p.id
      );
    return {
      ...p,
      matchGoals: matchGoals || undefined,
      matchAssists: matchAssists || undefined,
      matchYellow: matchYellow || undefined,
      matchRed: matchRed || undefined,
      subbedOff: subbedOff || undefined,
    };
  });
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
  venueName,
  venueCity,
  venueCapacity,
  weatherSummary,
  weatherTempC,
  weatherWindKph,
  weatherHumidity,
  events = [],
  statistics = [],
  scorers = [],
  keepers = [],
  homeClubId,
  awayClubId,
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
  venueName?: string | null;
  venueCity?: string | null;
  venueCapacity?: number | null;
  weatherSummary?: string | null;
  weatherTempC?: number | null;
  weatherWindKph?: number | null;
  weatherHumidity?: number | null;
  events?: MatchEventRow[];
  statistics?: StatRow[];
  scorers?: ScorerRow[];
  keepers?: KeeperRow[];
  homeClubId?: string;
  awayClubId?: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<SquadPlayer | null>(null);
  const [placing, setPlacing] = useState<SquadPlayer | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const locked = false;
  const [homeForm, setHomeForm] = useState(homeFormation);
  const [awayForm, setAwayForm] = useState(awayFormation);
  const [notesFilter, setNotesFilter] = useState<NotesFilterScope>("all");
  const [dossierId, setDossierId] = useState<string | null>(null);
  const [onAirOpen, setOnAirOpen] = useState(false);
  const [intelOpen, setIntelOpen] = useState(false);
  const [flashEventIds, setFlashEventIds] = useState<string[]>([]);

  useEffect(() => {
    setHomeForm(homeFormation);
    setAwayForm(awayFormation);
  }, [homeFormation, awayFormation]);

  const preds = useMemo(
    () => parsePredictions(predictionsJson),
    [predictionsJson]
  );

  const homeEnriched = useMemo(
    () => enrichPlayers(homePlayers, events),
    [homePlayers, events]
  );
  const awayEnriched = useMemo(
    () => enrichPlayers(awayPlayers, events),
    [awayPlayers, events]
  );

  const squad: SquadPlayer[] = useMemo(() => {
    const noteCount = (id: string) =>
      notes.filter((n) => n.entityId === id).length;
    return [
      ...homeEnriched.map((p) => ({
        ...p,
        side: "home" as const,
        team: homeName,
        noteCount: noteCount(p.id),
      })),
      ...awayEnriched.map((p) => ({
        ...p,
        side: "away" as const,
        team: awayName,
        noteCount: noteCount(p.id),
      })),
    ];
  }, [homeEnriched, awayEnriched, homeName, awayName, notes]);

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
    homeEnriched.filter((p) => p.isStarter || p.onPitch).length +
    awayEnriched.filter((p) => p.isStarter || p.onPitch).length;

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
          const news = (json.newEvents || []) as {
            type: string;
            minute: number;
            description: string;
          }[];
          if (news.length) {
            const top = news
              .slice(0, 3)
              .map((e) => `${e.minute}' ${e.description}`)
              .join(" · ");
            setFlash(`${news.length} new: ${top}`);
            setTimeout(() => setFlash(null), 8000);
          }
          if (!silent) {
            setMsg(
              `Synced · ${json.lineupStatus} · squads ${json.squadHome ?? 0}/${json.squadAway ?? 0} · injuries ${json.injuryCount ?? 0}` +
                (json.venueName ? ` · ${json.venueName}` : "") +
                (json.weatherSummary ? ` · ${json.weatherSummary}` : "")
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
    const t = setInterval(() => sync(true), 18_000);
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
    // place → API swaps if occupied
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
    setPlacing(p);
    setSelected(null);
  }

  function openPlayer(p: PitchPlayer | SquadPlayer) {
    if (placing) return;
    const full = squad.find((s) => s.id === p.id);
    if (full) setSelected(full);
    setDossierId(p.id);
    setNotesFilter("players");
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
        setMsg(
          `${side === "home" ? "Home" : "Away"} → ${formation} (starters remapped)`
        );
        router.refresh();
      }
    } catch {
      setMsg("Formation update failed");
    } finally {
      setBusy(false);
    }
  }

  const placingOnXi = Boolean(
    placing &&
      placing.formationSlot &&
      (placing.isStarter || placing.onPitch)
  );

  const possession = statistics.find((s) =>
    /possession/i.test(s.label)
  );
  const shots = statistics.find((s) =>
    /^shots$/i.test(s.label) || /total shots/i.test(s.label)
  );
  const corners = statistics.find((s) => /corner/i.test(s.label));
  const fouls = statistics.find((s) => /^fouls$/i.test(s.label) || /fouls committed/i.test(s.label));
  const penalties = events.filter((e) =>
    ["penalty_goal", "penalty_miss"].includes(e.type)
  );

  const deskNotes = useMemo(() => {
    if (dossierId) {
      return notes.filter((n) => n.entityId === dossierId);
    }
    return notes;
  }, [notes, dossierId]);

  return (
    <div className="relative h-[calc(100dvh-11rem)] max-h-[100dvh] min-h-[380px] flex flex-col gap-1.5 overflow-hidden">
      {/* Slim top bar — score / meta / stats / actions */}
      <header className="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 py-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-bold text-sm truncate">
              {homeName}{" "}
              <span className="text-slate-400 font-normal">vs</span>{" "}
              {awayName}
            </span>
            {(status === "Live" || status === "Full Time" || homeScore > 0 || awayScore > 0) && (
              <span
                className={cn(
                  "font-semibold tabular-nums text-sm",
                  status === "Live" ? "text-rose-600" : "text-slate-700 dark:text-slate-200"
                )}
              >
                {status === "Live" ? `${minute}' ` : ""}
                {homeScore}–{awayScore}
              </span>
            )}
            <span className="text-[11px] text-slate-500 truncate">
              {competition} · {kickoffLabel} · {status}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 truncate flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {(venueName || venueCity) && (
              <span className="inline-flex items-center gap-0.5">
                <MapPin className="h-3 w-3 shrink-0" />
                {venueName || "Venue"}
                {venueCity ? `, ${venueCity}` : ""}
              </span>
            )}
            {(weatherSummary || weatherTempC != null) && (
              <span className="inline-flex items-center gap-0.5">
                <CloudSun className="h-3 w-3 shrink-0" />
                {weatherSummary || "Weather"}
                {weatherTempC != null ? ` · ${weatherTempC}°C` : ""}
              </span>
            )}
            <span
              className={cn(
                "rounded-full px-1.5 py-px font-semibold text-white text-[9px]",
                lineupStatus === "confirmed"
                  ? "bg-emerald-600"
                  : lineupStatus === "predicted"
                    ? "bg-sky-600"
                    : "bg-amber-500"
              )}
              title={lineupHint(lineupStatus)}
            >
              {lineupStatus === "confirmed"
                ? "Official"
                : lineupStatus === "predicted"
                  ? "Predicted"
                  : "Expected"}
            </span>
            {injuryCount > 0 && (
              <span className="rounded-full border border-slate-200 dark:border-slate-700 px-1.5 py-px">
                Inj {injuryCount}
              </span>
            )}
            {possession && (
              <span className="tabular-nums">
                Poss {possession.homeValue}–{possession.awayValue}
              </span>
            )}
            {shots && (
              <span className="tabular-nums">
                Shots {shots.homeValue}–{shots.awayValue}
              </span>
            )}
            {corners && (
              <span className="tabular-nums">
                Corners {corners.homeValue}–{corners.awayValue}
              </span>
            )}
            {fouls && (
              <span className="tabular-nums">
                Fouls {fouls.homeValue}–{fouls.awayValue}
              </span>
            )}
            {(predictionsAdvice || preds?.advice) && (
              <span
                className="truncate max-w-[200px] text-teal-700 dark:text-teal-300"
                title={predictionsAdvice || preds?.advice || ""}
              >
                Pred {predictionsAdvice || preds?.advice}
              </span>
            )}
            {configured === false && (
              <span className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-3 w-3" /> No API key
              </span>
            )}
            {msg && (
              <span className="text-slate-400 truncate max-w-[240px]" title={msg}>
                {msg}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-wrap shrink-0">
          <div className="relative">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] font-medium hover:bg-slate-50 dark:hover:bg-slate-900"
              onClick={() => setIntelOpen((v) => !v)}
              aria-expanded={intelOpen}
            >
              <Info className="h-3 w-3" />
              Intel
            </button>
            {intelOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-30 cursor-default"
                  aria-label="Close intel"
                  onClick={() => setIntelOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-40 w-56 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-lg p-2 text-[11px]">
                  <div className="font-semibold text-slate-500 uppercase tracking-wide px-1 mb-1">
                    Match intel
                  </div>
                  <Link
                    href={`/match-day/${matchId}/scorers`}
                    className="block rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-900"
                    onClick={() => setIntelOpen(false)}
                  >
                    Scorers {scorers.length ? `(${scorers.length})` : ""}
                  </Link>
                  <Link
                    href={`/match-day/${matchId}/keepers`}
                    className="block rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-900"
                    onClick={() => setIntelOpen(false)}
                  >
                    Keepers {keepers.length ? `(${keepers.length})` : ""}
                  </Link>
                  <Link
                    href={`/match-day/${matchId}/penalties`}
                    className="block rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-900"
                    onClick={() => setIntelOpen(false)}
                  >
                    Penalties {penalties.length ? `(${penalties.length})` : ""}
                  </Link>
                  <Link
                    href={`/match-day/${matchId}/injuries`}
                    className="block rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-900"
                    onClick={() => setIntelOpen(false)}
                  >
                    Injuries ({injuryCount})
                  </Link>
                  {h2hSummary && (
                    <p className="mt-1 px-2 py-1 text-slate-500 border-t border-slate-100 dark:border-slate-800">
                      {h2hSummary}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium",
              onAirOpen
                ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
                : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900"
            )}
            onClick={() => setOnAirOpen((v) => !v)}
          >
            <Radio className="h-3 w-3 text-rose-500" />
            On-air
            <span className="tabular-nums text-slate-500">{events.length}</span>
            <ChevronDown
              className={cn("h-3 w-3 text-slate-400 transition", onAirOpen && "rotate-180")}
            />
          </button>

          <Link
            href={`/match-day/${matchId}/packs`}
            className="inline-flex items-center gap-1 rounded-md bg-violet-600 hover:bg-violet-500 text-white px-2 py-1 text-[11px] font-semibold"
          >
            <Sparkles className="h-3 w-3" />
            Packs{packCount ? ` (${packCount})` : ""}
          </Link>
          {!apiFootballFixtureId && (
            <Link
              href={`/match-day/${matchId}/prep`}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-[11px]"
            >
              <Link2 className="h-3 w-3" /> Link
            </Link>
          )}
          <Button
            size="sm"
            variant="secondary"
            className="h-7 px-2 text-[11px]"
            disabled={busy || !apiFootballFixtureId}
            onClick={() => sync(false)}
          >
            <RefreshCw className={cn("h-3 w-3 mr-1", busy && "animate-spin")} />
            Sync
          </Button>
        </div>
      </header>

      {/* Flash toast — overlay, not a permanent band */}
      {flash && (
        <div className="pointer-events-none absolute left-1/2 top-12 z-50 -translate-x-1/2 max-w-[min(90%,36rem)] rounded-lg border border-amber-300 bg-amber-50/95 dark:bg-amber-950/95 dark:border-amber-800 px-3 py-1.5 text-xs font-medium text-amber-900 dark:text-amber-100 shadow-lg animate-pulse">
          {flash}
        </div>
      )}

      {/* Placing toast */}
      {placing && (
        <div className="absolute left-1/2 top-12 z-40 -translate-x-1/2 flex flex-wrap items-center gap-2 rounded-lg border border-sky-300 bg-sky-50/95 dark:bg-sky-950/95 dark:border-sky-800 px-3 py-1.5 text-xs shadow-lg">
          <span className="font-semibold text-sky-900 dark:text-sky-100">
            Place {placing.name}
            <span className="font-normal text-sky-700 dark:text-sky-300"> · Esc cancel</span>
          </span>
          {placingOnXi && (
            <button
              type="button"
              className="rounded-md bg-rose-600 hover:bg-rose-500 text-white px-2 py-0.5 text-[10px] font-semibold"
              onClick={() =>
                lineupAction({ action: "clear", playerId: placing.id }).then(() =>
                  setPlacing(null)
                )
              }
            >
              Remove from XI
            </button>
          )}
          <button
            type="button"
            className="text-sky-700 dark:text-sky-300 hover:underline"
            onClick={() => setPlacing(null)}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Main landscape: notes | pitch | squad */}
      <div className="relative min-h-0 flex-1 grid grid-cols-1 lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)_minmax(180px,200px)] gap-1.5 overflow-hidden">
        <aside className="min-h-0 overflow-hidden order-2 lg:order-1">
          <NotesPanel
            matchId={matchId}
            initialNotes={deskNotes}
            entityType={dossierId ? "player" : undefined}
            entityId={dossierId || undefined}
            entityLabel={
              dossierId ? squad.find((s) => s.id === dossierId)?.name : undefined
            }
            homePlayerIds={homePlayers.map((p) => p.id)}
            awayPlayerIds={awayPlayers.map((p) => p.id)}
            homeClubId={homeClubId}
            awayClubId={awayClubId}
            externalFilter={notesFilter}
            onFilterChange={setNotesFilter}
            fillHeight
            compact={Boolean(dossierId)}
            playerNameById={Object.fromEntries(squad.map((p) => [p.id, p.name]))}
          />
        </aside>

        <section className="relative min-h-0 flex flex-col overflow-hidden order-1 lg:order-2">
          <div className="min-h-0 flex-1">
            <PitchBoard
              homeName={homeName}
              awayName={awayName}
              homeColor={homeColor}
              awayColor={awayColor}
              homeFormation={homeForm}
              awayFormation={awayForm}
              homePlayers={homeEnriched}
              awayPlayers={awayEnriched}
              homeCoach={homeCoach}
              awayCoach={awayCoach}
              referee={referee}
              lineupStatus={lineupStatus}
              onPlayerClick={openPlayer}
              onSlotDrop={onSlotDrop}
              onSlotClick={onSlotClick}
              onClearSlot={onClearSlot}
              placingPlayerId={placing?.id}
              placingSide={placing?.side}
              locked={false}
              compact
              formationOptions={Object.keys(FORMATIONS)}
              onFormationChange={changeFormation}
              formationBusy={busy}
              lineupHintText={
                starterCount === 0
                  ? "Empty pitch — Sync, then click player → slot"
                  : lineupHint(lineupStatus)
              }
              onResetOfficial={
                lineupStatus === "confirmed" && apiFootballFixtureId
                  ? () => sync(false)
                  : undefined
              }
            />
          </div>

          {/* On-air drawer — overlays pitch, does not steal permanent height */}
          {onAirOpen && (
            <div className="absolute inset-x-0 bottom-0 z-30 max-h-[min(42%,280px)] rounded-t-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-950/95 backdrop-blur shadow-2xl overflow-hidden flex flex-col">
              <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-slate-100 dark:border-slate-800">
                <Radio className="h-3.5 w-3.5 text-rose-500" />
                <span className="text-xs font-bold uppercase tracking-wide">On-air</span>
                <span className="text-[10px] text-slate-500">
                  {events.length} events
                  {status === "Live" ? ` · ${minute}'` : ""}
                </span>
                <button
                  type="button"
                  className="ml-auto text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  onClick={() => setOnAirOpen(false)}
                >
                  Close
                </button>
              </div>
              <div className="min-h-0 flex-1 grid md:grid-cols-2 gap-2 p-2 overflow-hidden">
                <div className="min-h-0 overflow-hidden flex flex-col">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 px-1 mb-1">
                    Timeline
                  </div>
                  <EventTimeline
                    events={events}
                    highlightIds={flashEventIds}
                    compact
                    maxHeightClass="max-h-[200px]"
                  />
                </div>
                <div className="min-h-0 overflow-y-auto">
                  <EventComposer
                    matchId={matchId}
                    homeName={homeName}
                    awayName={awayName}
                    homeScore={homeScore}
                    awayScore={awayScore}
                    minute={minute || 1}
                    players={squad.map((p) => ({
                      id: p.id,
                      name: p.name,
                      shirtNumber: p.shirtNumber,
                      side: p.side,
                      team: p.team,
                    }))}
                    compact
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        <aside className="min-h-0 overflow-hidden order-3">
          <SquadRail
            players={squad}
            homeName={homeName}
            awayName={awayName}
            homeColor={homeColor}
            awayColor={awayColor}
            locked={locked}
            selectedId={selected?.id || dossierId}
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

      {dossierId && (
        <PlayerDossier
          matchId={matchId}
          playerId={dossierId}
          onClose={() => {
            setDossierId(null);
            setSelected(null);
          }}
        />
      )}
    </div>
  );

}
