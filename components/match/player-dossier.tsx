"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { NotesPanel, type NoteRow } from "@/components/notes/notes-panel";
import { EventTimeline } from "@/components/match/event-timeline";
import { cn } from "@/lib/utils";

type DossierPayload = {
  player: {
    id: string;
    name: string;
    shirtNumber: number;
    position: string;
    nationality: string;
    age: number | null;
    heightCm: number | null;
    weightKg: number | null;
    birthDate: string | null;
    photoUrl: string | null;
    preferredFoot: string | null;
    isCaptain: boolean;
    goals: number;
    assists: number;
    appearances: number;
    cleanSheets: number;
    yellowCards: number;
    redCards: number;
    apiFootballPlayerId: number | null;
    club: { id: string; name: string; shortName: string; primaryColor: string };
    seasonScorer: { goals: number; assists: number; rank: number } | null;
    seasonKeeper: {
      cleanSheets: number;
      saves: number;
      appearances: number;
      rank: number;
    } | null;
  };
  notes: NoteRow[];
  events: {
    id: string;
    type: string;
    minute: number;
    description: string;
    teamSide: string | null;
  }[];
  afStats: {
    player?: {
      photo?: string;
      height?: string;
      weight?: string;
      nationality?: string;
      birth?: { date?: string };
      age?: number;
    };
    statistics?: {
      league?: { name?: string; season?: number };
      games?: {
        appearences?: number | null;
        lineups?: number | null;
        minutes?: number | null;
        position?: string | null;
      };
      goals?: {
        total?: number | null;
        assists?: number | null;
        conceded?: number | null;
        saves?: number | null;
      };
      cards?: { yellow?: number | null; red?: number | null };
    }[];
  } | null;
  afStub: string | null;
};

type Tab = "overview" | "stats" | "notes" | "events";

export function PlayerDossier({
  matchId,
  playerId,
  onClose,
}: {
  matchId: string;
  playerId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<DossierPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTab("overview");
    fetch(`/api/players/${playerId}?matchId=${encodeURIComponent(matchId)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Failed to load");
        if (!cancelled) setData(j);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [playerId, matchId]);

  const p = data?.player;
  const afRows = data?.afStats?.statistics || [];
  const af = afRows[0];
  const photo =
    p?.photoUrl ||
    data?.afStats?.player?.photo ||
    (p?.apiFootballPlayerId
      ? `https://media.api-sports.io/football/players/${p.apiFootballPlayerId}.png`
      : null);

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "stats", label: "Stats" },
    { key: "notes", label: "Notes" },
    { key: "events", label: "Events" },
  ];

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md shadow-2xl border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col">
      <div className="flex items-start justify-between gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5 min-w-0">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt=""
              className="h-12 w-12 rounded-full object-cover ring-2 ring-slate-200 dark:ring-slate-700 bg-slate-100"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div
              className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: p?.club.primaryColor || "#0d9488" }}
            >
              {p ? p.shirtNumber : "?"}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">
              {p ? p.name : "Player dossier"}
            </div>
            {p && (
              <div className="text-[11px] text-slate-500">
                #{p.shirtNumber} · {p.club.shortName} · {p.position}
                {p.isCaptain ? " · ©" : ""}
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
          onClick={onClose}
          aria-label="Close dossier"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="shrink-0 flex gap-1 px-3 py-2 border-b border-slate-100 dark:border-slate-800 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-full px-3 py-1 text-[11px] font-semibold border whitespace-nowrap",
              tab === t.key
                ? "bg-teal-600 text-white border-teal-600"
                : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            )}
          >
            {t.label}
            {t.key === "notes" && data
              ? ` (${data.notes.length})`
              : t.key === "events" && data
                ? ` (${data.events.length})`
                : ""}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading dossier…
          </div>
        )}
        {error && <p className="text-xs text-rose-600">{error}</p>}
        {p && tab === "overview" && (
          <>
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
                Profile
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Fact label="Nationality" value={p.nationality} />
                <Fact label="Age" value={p.age != null ? String(p.age) : "—"} />
                <Fact
                  label="Height"
                  value={p.heightCm != null ? `${p.heightCm} cm` : "—"}
                />
                <Fact
                  label="Weight"
                  value={p.weightKg != null ? `${p.weightKg} kg` : "—"}
                />
                <Fact label="Born" value={p.birthDate || "—"} />
                <Fact label="Foot" value={p.preferredFoot || "—"} />
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
                Season snapshot
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Fact label="Apps" value={String(p.appearances)} />
                <Fact label="G / A" value={`${p.goals} / ${p.assists}`} />
                {p.position === "GK" && (
                  <Fact label="Clean sheets" value={String(p.cleanSheets)} />
                )}
                <Fact label="Cards" value={`Y${p.yellowCards} R${p.redCards}`} />
              </div>
            </div>
            {data?.afStub && (
              <p className="text-[10px] text-amber-700 dark:text-amber-300 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/80 dark:bg-amber-950/30 px-2 py-1.5">
                {data.afStub}
              </p>
            )}
          </>
        )}

        {p && tab === "stats" && (
          <div className="space-y-3">
            {(p.seasonScorer || p.seasonKeeper) && (
              <div className="rounded-xl border border-slate-100 dark:border-slate-800 p-3 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Club season
                </div>
                {p.seasonScorer && (
                  <p className="text-xs">
                    Scorer rank #{p.seasonScorer.rank}:{" "}
                    <strong>
                      {p.seasonScorer.goals}G {p.seasonScorer.assists}A
                    </strong>
                  </p>
                )}
                {p.seasonKeeper && (
                  <p className="text-xs">
                    Keeper rank #{p.seasonKeeper.rank}:{" "}
                    <strong>
                      {p.seasonKeeper.cleanSheets} CS · {p.seasonKeeper.saves}{" "}
                      saves · {p.seasonKeeper.appearances} apps
                    </strong>
                  </p>
                )}
              </div>
            )}
            {afRows.length === 0 && !p.seasonScorer && !p.seasonKeeper && (
              <p className="text-xs text-slate-500">
                No season stats yet — Sync to load from API-Football.
              </p>
            )}
            {afRows.map((row, i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-100 dark:border-slate-800 p-3 text-xs space-y-1"
              >
                <div className="font-semibold text-slate-700 dark:text-slate-200">
                  {row.league?.name || "League"}
                  {row.league?.season ? ` · ${row.league.season}` : ""}
                </div>
                <div>
                  Apps {row.games?.appearences ?? "—"} · Lineups{" "}
                  {row.games?.lineups ?? "—"} · Minutes{" "}
                  {row.games?.minutes ?? "—"}
                </div>
                <div>
                  Goals {row.goals?.total ?? "—"} · Assists{" "}
                  {row.goals?.assists ?? "—"}
                  {row.goals?.saves != null ? ` · Saves ${row.goals.saves}` : ""}
                  {row.goals?.conceded != null
                    ? ` · Conceded ${row.goals.conceded}`
                    : ""}
                </div>
                <div>
                  Cards Y{row.cards?.yellow ?? 0} R{row.cards?.red ?? 0}
                </div>
              </div>
            ))}
            {af && (
              <p className="text-[10px] text-slate-400">
                Primary league row used for Overview snapshot.
              </p>
            )}
          </div>
        )}

        {p && tab === "notes" && (
          <NotesPanel
            matchId={matchId}
            initialNotes={data?.notes || []}
            entityType="player"
            entityId={p.id}
            entityLabel={p.name}
          />
        )}

        {p && tab === "events" && (
          <div className="rounded-xl border border-slate-100 dark:border-slate-800 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
              This match
            </div>
            <EventTimeline
              events={data?.events || []}
              compact
              emptyLabel="No match events for this player yet."
              maxHeightClass="max-h-[60vh]"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn("rounded-lg bg-slate-50 dark:bg-slate-900/60 px-2 py-1.5")}>
      <div className="text-[9px] uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="font-semibold truncate">{value}</div>
    </div>
  );
}
