"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { PitchPlayer } from "@/components/match/pitch";
import { Search, Plus } from "lucide-react";

export type SquadPlayer = PitchPlayer & {
  side: "home" | "away";
  team: string;
  noteCount?: number;
};

export function SquadRail({
  players,
  homeName,
  awayName,
  homeColor,
  awayColor,
  locked,
  selectedId,
  placingId,
  onPlayerClick,
  onRemoveFromXi,
  matchId,
  manualMode = false,
  onPlayerAdded,
}: {
  players: SquadPlayer[];
  homeName: string;
  awayName: string;
  homeColor: string;
  awayColor: string;
  locked?: boolean;
  selectedId?: string | null;
  placingId?: string | null;
  onPlayerClick?: (p: SquadPlayer) => void;
  onRemoveFromXi?: (p: SquadPlayer) => void;
  matchId?: string;
  /** Blank canvas / Manual XI — show add-player form for thin squads */
  manualMode?: boolean;
  onPlayerAdded?: () => void;
}) {
  const [q, setQ] = useState("");
  const [side, setSide] = useState<"all" | "home" | "away">("all");
  const [addSide, setAddSide] = useState<"home" | "away">("home");
  const [addName, setAddName] = useState("");
  const [addNumber, setAddNumber] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addMsg, setAddMsg] = useState<string | null>(null);

  async function addManualPlayer() {
    if (!matchId || !addName.trim()) return;
    setAddBusy(true);
    setAddMsg(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/manual-player`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          side: addSide,
          name: addName.trim(),
          shirtNumber: addNumber.trim() ? Number(addNumber) : undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAddMsg(json.error || "Add failed");
        return;
      }
      setAddMsg(json.created ? "Added to squad" : "Found in squad");
      setAddName("");
      setAddNumber("");
      onPlayerAdded?.();
    } catch {
      setAddMsg("Add failed");
    } finally {
      setAddBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return players
      .filter((p) => (side === "all" ? true : p.side === side))
      .filter((p) =>
        !needle
          ? true
          : p.name.toLowerCase().includes(needle) ||
            String(p.shirtNumber).includes(needle) ||
            (p.position || "").toLowerCase().includes(needle)
      )
      .sort((a, b) => a.shirtNumber - b.shirtNumber);
  }, [players, q, side]);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden">
      <div className="shrink-0 border-b border-slate-100 dark:border-slate-800 px-2.5 py-2 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Squad
          </div>
          {!locked && (
            <div className="text-[9px] text-slate-400">
              Click to place · drag OK
            </div>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter name / #"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent pl-7 pr-2 py-1 text-xs"
          />
        </div>
        <div className="flex gap-1">
          {(
            [
              ["all", "All"],
              ["home", homeName],
              ["away", awayName],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSide(key)}
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] border truncate max-w-[33%]",
                side === key
                  ? "bg-teal-600 text-white border-teal-600"
                  : "border-slate-200 dark:border-slate-700"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-0.5">
        {filtered.length === 0 && (
          <p className="text-[11px] text-slate-500 px-2 py-3">
            No squad players yet. Hit Sync to pull squads from the live feed.
          </p>
        )}
        {filtered.map((p) => {
          const onXi = Boolean(p.formationSlot && (p.isStarter || p.onPitch));
          const color = p.side === "home" ? homeColor : awayColor;
          const isPlacing = placingId === p.id;
          return (
            <div
              key={p.id}
              draggable={!locked}
              onDragStart={(e) => {
                if (locked) {
                  e.preventDefault();
                  return;
                }
                e.dataTransfer.setData(
                  "application/pitchline-player",
                  JSON.stringify({ playerId: p.id, side: p.side })
                );
                e.dataTransfer.setData("text/plain", p.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onClick={() => onPlayerClick?.(p)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-1.5 py-1 text-xs cursor-pointer border border-transparent hover:bg-slate-50 dark:hover:bg-slate-900",
                (selectedId === p.id || isPlacing) &&
                  "border-teal-400 bg-teal-50/80 dark:bg-teal-950/40",
                isPlacing && "ring-1 ring-sky-400",
                !locked && "active:cursor-grabbing"
              )}
              title={
                locked
                  ? "Official XI locked — open notes"
                  : isPlacing
                    ? "Placing — tap a pitch slot"
                    : "Click to place on pitch · drag also works"
              }
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: color }}
              >
                {p.shirtNumber || "–"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium leading-tight">{p.displayName || p.name}</div>
                <div className="text-[9px] text-slate-400 truncate">
                  {p.position || "—"}
                  {onXi ? ` · ${p.formationSlot}` : ""}
                </div>
              </div>
              {p.noteCount ? (
                <span
                  className="accent-secondary-chip shrink-0"
                  title={`${p.noteCount} note${p.noteCount === 1 ? "" : "s"} · open dossier from pitch`}
                >
                  {p.noteCount}n
                </span>
              ) : null}
              {onXi && (
                <span className="text-[8px] font-bold uppercase text-teal-600 shrink-0">
                  XI
                </span>
              )}
              {isPlacing && onXi && !locked && onRemoveFromXi && (
                <button
                  type="button"
                  className="text-[9px] font-semibold text-rose-600 hover:underline shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFromXi(p);
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          );
        })}
      </div>
      {manualMode && matchId && !locked && (
        <div className="shrink-0 border-t border-slate-100 dark:border-slate-800 px-2 py-2 space-y-1.5 bg-fuchsia-50/60 dark:bg-fuchsia-950/30">
          <div className="text-[9px] font-black uppercase tracking-wide text-fuchsia-800 dark:text-fuchsia-200">
            Add player · Manual XI
          </div>
          <div className="flex gap-1">
            {(["home", "away"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setAddSide(s)}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] border",
                  addSide === s
                    ? "bg-fuchsia-700 text-white border-fuchsia-700"
                    : "border-slate-200 dark:border-slate-700"
                )}
              >
                {s === "home" ? homeName : awayName}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            <input
              value={addNumber}
              onChange={(e) => setAddNumber(e.target.value.replace(/\D/g, "").slice(0, 2))}
              placeholder="#"
              className="w-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-1.5 py-1 text-xs tabular-nums"
            />
            <input
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="Type name / search club roster"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addManualPlayer();
                }
              }}
            />
            <button
              type="button"
              disabled={addBusy || !addName.trim()}
              onClick={() => void addManualPlayer()}
              className="inline-flex items-center gap-0.5 rounded-lg bg-fuchsia-700 px-2 py-1 text-[10px] font-bold text-white disabled:opacity-50"
              title="Add to this club squad (reuses name match if already in DB)"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          </div>
          {addMsg && (
            <div className="text-[9px] font-semibold text-fuchsia-800 dark:text-fuchsia-200">
              {addMsg}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
