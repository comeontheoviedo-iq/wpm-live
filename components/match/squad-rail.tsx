"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { PitchPlayer } from "@/components/match/pitch";
import { Search } from "lucide-react";

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
  onPlayerClick,
}: {
  players: SquadPlayer[];
  homeName: string;
  awayName: string;
  homeColor: string;
  awayColor: string;
  locked?: boolean;
  selectedId?: string | null;
  onPlayerClick?: (p: SquadPlayer) => void;
}) {
  const [q, setQ] = useState("");
  const [side, setSide] = useState<"all" | "home" | "away">("all");

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
            <div className="text-[9px] text-slate-400">Drag onto pitch</div>
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
            No squad players yet. Hit Sync to pull squads from API-Football.
          </p>
        )}
        {filtered.map((p) => {
          const onXi = Boolean(p.formationSlot && (p.isStarter || p.onPitch));
          const color = p.side === "home" ? homeColor : awayColor;
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
                selectedId === p.id && "border-teal-400 bg-teal-50/80 dark:bg-teal-950/40",
                !locked && "active:cursor-grabbing"
              )}
              title={
                locked
                  ? "Official XI locked — open notes"
                  : "Drag to pitch slot · click for notes"
              }
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: color }}
              >
                {p.shirtNumber || "–"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium leading-tight">{p.name}</div>
                <div className="text-[9px] text-slate-400 truncate">
                  {p.position || "—"}
                  {onXi ? ` · ${p.formationSlot}` : ""}
                  {p.noteCount ? ` · ${p.noteCount} notes` : ""}
                </div>
              </div>
              {onXi && (
                <span className="text-[8px] font-bold uppercase text-teal-600 shrink-0">
                  XI
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
