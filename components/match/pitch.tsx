"use client";

import type { DragEvent } from "react";
import { slotsFor } from "@/lib/formations";
import { cn } from "@/lib/utils";

export type PitchPlayer = {
  id: string;
  name: string;
  shirtNumber: number;
  formationSlot: string | null;
  isCaptain?: boolean;
  isStarter: boolean;
  onPitch?: boolean;
  position?: string;
};

type Coach = { name: string; nationality: string; age: number | null };

function lineupBadgeLabel(status?: string) {
  if (status === "confirmed") return "Official";
  if (status === "predicted") return "Your predicted XI";
  if (status === "expected") return "Expected (last XI)";
  return status ? status : null;
}

/**
 * Landscape pitch: longer horizontal axis.
 * Home attacks left→right (left half), away attacks right→left (right half).
 */
export function PitchBoard({
  homeName,
  awayName,
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
  onPlayerClick,
  onSlotDrop,
  locked,
  compact,
}: {
  homeName: string;
  awayName: string;
  homeColor: string;
  awayColor: string;
  homeFormation: string;
  awayFormation: string;
  homePlayers: PitchPlayer[];
  awayPlayers: PitchPlayer[];
  homeCoach?: Coach | null;
  awayCoach?: Coach | null;
  referee?: string;
  lineupStatus?: string;
  onPlayerClick?: (player: PitchPlayer) => void;
  /** DnD: drop a squad player onto a formation slot */
  onSlotDrop?: (args: {
    side: "home" | "away";
    slotId: string;
    playerId: string;
  }) => void;
  locked?: boolean;
  compact?: boolean;
}) {
  const homeSlots = slotsFor(homeFormation);
  const awaySlots = slotsFor(awayFormation);
  const badge = lineupBadgeLabel(lineupStatus);

  function placeLandscape(
    players: PitchPlayer[],
    slots: ReturnType<typeof slotsFor>,
    side: "home" | "away"
  ) {
    return slots.map((slot) => {
      const p = players.find(
        (pl) =>
          pl.formationSlot === slot.id && (pl.onPitch || pl.isStarter)
      );
      // slot.y: 92 GK → 18 ST (own goal → attack). Map to horizontal depth.
      // slot.x: 0–100 width → vertical on landscape pitch.
      const depth = (100 - slot.y) / 100; // 0 at GK, ~0.8 at ST
      const width = slot.x; // 0 left touch → 100 right touch
      let x: number;
      let y: number;
      if (side === "home") {
        x = 4 + depth * 42; // left goal → midfield
        y = width;
      } else {
        x = 96 - depth * 42; // right goal → midfield
        y = 100 - width;
      }
      return { slot, player: p, x, y, side };
    });
  }

  const homePlaced = placeLandscape(homePlayers, homeSlots, "home");
  const awayPlaced = placeLandscape(awayPlayers, awaySlots, "away");
  const all = [...homePlaced, ...awayPlaced];

  function handleDragOver(e: DragEvent) {
    if (locked || !onSlotDrop) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(
    e: DragEvent,
    side: "home" | "away",
    slotId: string
  ) {
    if (locked || !onSlotDrop) return;
    e.preventDefault();
    e.stopPropagation();
    let payload: { playerId?: string; side?: string } = {};
    try {
      payload = JSON.parse(e.dataTransfer.getData("application/pitchline-player") || "{}");
    } catch {
      payload = {};
    }
    const playerId =
      payload.playerId || e.dataTransfer.getData("text/plain");
    if (!playerId) return;
    if (payload.side && payload.side !== side) return;
    onSlotDrop({ side, slotId, playerId });
  }

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl border border-emerald-900/40 shadow-inner",
        compact ? "h-full" : ""
      )}
    >
      <div
        className={cn(
          "relative w-full",
          compact ? "h-full min-h-[220px]" : "aspect-[16/9]"
        )}
        style={{
          background:
            "repeating-linear-gradient(0deg, #15803d 0 12.5%, #16a34a 12.5% 25%)",
        }}
      >
        {/* Pitch markings — landscape goals left/right */}
        <div className="absolute inset-2 sm:inset-3 border-2 border-white/70 rounded-sm pointer-events-none">
          <div className="absolute top-0 bottom-0 left-1/2 w-0 border-l-2 border-white/70" />
          <div className="absolute left-1/2 top-1/2 h-16 w-16 sm:h-24 sm:w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/70" />
          <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80" />
          <div className="absolute top-1/2 left-0 h-[55%] w-[14%] -translate-y-1/2 border-2 border-l-0 border-white/70" />
          <div className="absolute top-1/2 right-0 h-[55%] w-[14%] -translate-y-1/2 border-2 border-r-0 border-white/70" />
          <div className="absolute top-1/2 left-0 h-[28%] w-[6%] -translate-y-1/2 border-2 border-l-0 border-white/70" />
          <div className="absolute top-1/2 right-0 h-[28%] w-[6%] -translate-y-1/2 border-2 border-r-0 border-white/70" />
        </div>

        <div className="absolute top-1.5 left-2 right-2 z-20 flex items-start justify-between gap-2 pointer-events-none">
          <div className="rounded-md bg-black/55 backdrop-blur px-2 py-0.5 text-white text-[10px] sm:text-xs">
            <span className="font-semibold">{homeName}</span>
            <span className="opacity-80 ml-1">{homeFormation}</span>
          </div>
          {badge && (
            <div
              className={cn(
                "rounded-md px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wide text-white",
                lineupStatus === "confirmed"
                  ? "bg-emerald-600/95"
                  : lineupStatus === "predicted"
                    ? "bg-sky-600/95"
                    : "bg-amber-500/95"
              )}
            >
              {badge}
            </div>
          )}
          <div className="rounded-md bg-black/55 backdrop-blur px-2 py-0.5 text-white text-[10px] sm:text-xs text-right">
            <span className="font-semibold">{awayName}</span>
            <span className="opacity-80 ml-1">{awayFormation}</span>
          </div>
        </div>

        {all.map(({ slot, player, x, y, side }) => {
          const color = side === "home" ? homeColor : awayColor;
          return (
            <div
              key={`${side}-${slot.id}`}
              className={cn(
                "absolute z-10 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center",
                !locked && onSlotDrop ? "drop-target" : ""
              )}
              style={{ left: `${x}%`, top: `${y}%` }}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, side, slot.id)}
            >
              <button
                type="button"
                title={
                  player
                    ? `${player.name} · click for notes`
                    : locked
                      ? slot.label
                      : `Drop player → ${slot.label}`
                }
                className={cn(
                  "flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full text-[9px] sm:text-[10px] font-bold text-white shadow-lg ring-2",
                  player
                    ? "ring-white/60 cursor-pointer hover:ring-teal-300"
                    : "ring-white/25 border border-dashed border-white/40 bg-black/25"
                )}
                style={player ? { backgroundColor: color } : undefined}
                onClick={() => player && onPlayerClick?.(player)}
                draggable={Boolean(player && !locked && onSlotDrop)}
                onDragStart={(e) => {
                  if (!player || locked) return;
                  e.dataTransfer.setData(
                    "application/pitchline-player",
                    JSON.stringify({ playerId: player.id, side })
                  );
                  e.dataTransfer.setData("text/plain", player.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
              >
                {player ? player.shirtNumber : slot.label}
              </button>
              <span className="mt-0.5 max-w-[56px] truncate rounded bg-black/55 px-1 text-[8px] sm:text-[9px] text-white font-medium leading-tight">
                {player
                  ? `${player.isCaptain ? "© " : ""}${player.name.split(" ").slice(-1)[0]}`
                  : slot.label}
              </span>
            </div>
          );
        })}

        {referee && (
          <div className="absolute bottom-1.5 left-1/2 z-10 -translate-x-1/2 flex flex-col items-center pointer-events-none">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400 text-[8px] font-bold text-slate-900 ring-2 ring-white/60">
              REF
            </div>
            <span className="mt-0.5 rounded bg-black/55 px-1 text-[8px] text-white">
              {referee}
            </span>
          </div>
        )}

        {(homeCoach || awayCoach) && (
          <div className="absolute bottom-1 left-2 right-2 z-10 flex justify-between gap-2 pointer-events-none">
            {homeCoach && (
              <div className="rounded bg-black/55 px-1.5 py-0.5 text-[8px] sm:text-[9px] text-white max-w-[40%]">
                <div className="font-semibold truncate">{homeCoach.name}</div>
              </div>
            )}
            {awayCoach && (
              <div className="rounded bg-black/55 px-1.5 py-0.5 text-[8px] sm:text-[9px] text-white text-right max-w-[40%] ml-auto">
                <div className="font-semibold truncate">{awayCoach.name}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
