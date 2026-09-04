"use client";

import { useState, type DragEvent } from "react";
import { X } from "lucide-react";
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
  nationality?: string | null;
  age?: number | null;
  /** Compact card facts (goals/assists/cards from events or season) */
  goals?: number;
  assists?: number;
  yellowCards?: number;
  redCards?: number;
  matchGoals?: number;
  matchAssists?: number;
  matchYellow?: boolean;
  matchRed?: boolean;
  subbedOff?: boolean;
};

type Coach = { name: string; nationality: string; age: number | null };

function lineupBadgeLabel(status?: string) {
  if (status === "confirmed") return "Official (editable)";
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
  onSlotClick,
  onClearSlot,
  placingPlayerId,
  placingSide,
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
  /** Click-to-place: tap a formation slot while placing */
  onSlotClick?: (args: {
    side: "home" | "away";
    slotId: string;
    occupantId?: string | null;
  }) => void;
  /** Remove occupant from XI (× button) */
  onClearSlot?: (args: {
    side: "home" | "away";
    slotId: string;
    playerId: string;
  }) => void;
  placingPlayerId?: string | null;
  placingSide?: "home" | "away" | null;
  locked?: boolean;
  compact?: boolean;
}) {
  const homeSlots = slotsFor(homeFormation);
  const awaySlots = slotsFor(awayFormation);
  const badge = lineupBadgeLabel(lineupStatus);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);

  function placeLandscape(
    players: PitchPlayer[],
    slots: ReturnType<typeof slotsFor>,
    side: "home" | "away"
  ) {
    const assigned = new Set<string>();
    const placed = slots.map((slot) => {
      const p = players.find(
        (pl) =>
          pl.formationSlot === slot.id &&
          (pl.onPitch || pl.isStarter) &&
          !assigned.has(pl.id)
      );
      if (p) assigned.add(p.id);
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
      return { slot, player: p as PitchPlayer | undefined, x, y, side };
    });

    // Orphans only fill EMPTY slots — never steal a good slot match.
    // Only consider players whose formationSlot is missing or not in this formation.
    const validIds = new Set(slots.map((s) => s.id));
    const orphans = players.filter(
      (pl) =>
        (pl.isStarter || pl.onPitch) &&
        !assigned.has(pl.id) &&
        (!pl.formationSlot || !validIds.has(pl.formationSlot))
    );
    let oi = 0;
    for (const row of placed) {
      if (row.player) continue;
      if (oi >= orphans.length) break;
      row.player = orphans[oi++];
      assigned.add(row.player.id);
    }
    return placed;
  }

  const homePlaced = placeLandscape(homePlayers, homeSlots, "home");
  const awayPlaced = placeLandscape(awayPlayers, awaySlots, "away");
  const all = [...homePlaced, ...awayPlaced];
  const placing = Boolean(placingPlayerId && !locked);

  function handleDragOver(e: DragEvent, key: string) {
    if (locked || !onSlotDrop) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverSlot(key);
  }

  function handleDragLeave(key: string) {
    setDragOverSlot((cur) => (cur === key ? null : cur));
  }

  function handleDrop(
    e: DragEvent,
    side: "home" | "away",
    slotId: string
  ) {
    if (locked || !onSlotDrop) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOverSlot(null);
    let payload: { playerId?: string; side?: string } = {};
    try {
      payload = JSON.parse(
        e.dataTransfer.getData("application/pitchline-player") || "{}"
      );
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
        compact ? "h-full" : "",
        placing && "ring-2 ring-sky-400/70"
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
          const key = `${side}-${slot.id}`;
          const isDragOver = dragOverSlot === key;
          const sideOk = !placingSide || placingSide === side;
          const highlightPlace = placing && sideOk;
          const isPlacingHere =
            placing && player?.id === placingPlayerId;

          return (
            <div
              key={key}
              className={cn(
                "absolute z-10 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center",
                !locked && onSlotDrop ? "drop-target" : ""
              )}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              {/* Invisible ~46px hit target for drag + click */}
              <div
                className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[6px] h-11 w-11 sm:h-12 sm:w-12 rounded-full z-0"
                style={{ touchAction: "manipulation" }}
                onDragOver={(e) => handleDragOver(e, key)}
                onDragLeave={() => handleDragLeave(key)}
                onDrop={(e) => handleDrop(e, side, slot.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (placing && onSlotClick && !locked) {
                    if (!sideOk) return;
                    onSlotClick({
                      side,
                      slotId: slot.id,
                      occupantId: player?.id ?? null,
                    });
                    return;
                  }
                  if (player) onPlayerClick?.(player);
                }}
                onContextMenu={(e) => {
                  if (locked || !player || !onClearSlot) return;
                  e.preventDefault();
                  onClearSlot({
                    side,
                    slotId: slot.id,
                    playerId: player.id,
                  });
                }}
                onDoubleClick={(e) => {
                  if (locked || !onClearSlot) return;
                  e.preventDefault();
                  if (player) {
                    onClearSlot({
                      side,
                      slotId: slot.id,
                      playerId: player.id,
                    });
                  }
                }}
              />

              {/* Ghost ring on dragover / placing mode */}
              {(isDragOver || highlightPlace) && (
                <div
                  className={cn(
                    "pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[6px] h-11 w-11 sm:h-12 sm:w-12 rounded-full border-2 z-[1]",
                    isDragOver
                      ? "border-sky-300 bg-sky-400/25 shadow-[0_0_12px_rgba(56,189,248,0.55)]"
                      : "border-white/50 border-dashed bg-white/10"
                  )}
                />
              )}

              <button
                type="button"
                title={
                  player
                    ? placing
                      ? isPlacingHere
                        ? `Clear ${player.name} from XI`
                        : `Place here (swap ${player.name})`
                      : `${player.name} · click dossier · right-click remove`
                    : locked
                      ? slot.label
                      : placing
                        ? `Tap to place · ${slot.label}`
                        : `Drop / tap slot · ${slot.label}`
                }
                className={cn(
                  "relative z-[2] flex flex-col items-center",
                  player ? "cursor-pointer" : ""
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  if (placing && onSlotClick && !locked) {
                    if (!sideOk) return;
                    onSlotClick({
                      side,
                      slotId: slot.id,
                      occupantId: player?.id ?? null,
                    });
                    return;
                  }
                  if (player) onPlayerClick?.(player);
                }}
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
                {player ? (
                  <span
                    className={cn(
                      "group relative flex min-w-[58px] max-w-[72px] flex-col items-center rounded-lg bg-black/75 backdrop-blur-sm px-1.5 py-1 shadow-lg ring-1 ring-white/45",
                      isPlacingHere && "ring-2 ring-amber-300",
                      "hover:ring-teal-300",
                      player.subbedOff && "opacity-45 grayscale-[30%]"
                    )}
                    title={[
                      player.name,
                      player.isCaptain ? "Captain" : null,
                      player.position || null,
                      player.matchGoals
                        ? `${player.matchGoals} goal(s) this match`
                        : player.goals
                          ? `${player.goals} season goals`
                          : null,
                      player.matchYellow || player.matchRed
                        ? `Cards${player.matchYellow ? " Y" : ""}${player.matchRed ? " R" : ""}`
                        : null,
                      player.subbedOff ? "Subbed off" : null,
                      player.nationality || null,
                      player.age != null ? `Age ${player.age}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  >
                    <span className="flex items-center gap-1">
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white shadow ring-1 ring-white/50"
                        style={{ backgroundColor: color }}
                      >
                        {player.shirtNumber}
                      </span>
                      <span className="max-w-[40px] truncate text-[9px] font-semibold text-white leading-tight">
                        {player.isCaptain ? "© " : ""}
                        {player.name.split(" ").slice(-1)[0]}
                      </span>
                    </span>
                    <span className="mt-0.5 flex max-w-full flex-wrap items-center justify-center gap-0.5 text-[8px] leading-none text-white/95">
                      {player.matchGoals ? (
                        <span className="rounded bg-emerald-600/95 px-0.5 font-bold">
                          {player.matchGoals}G
                        </span>
                      ) : player.goals ? (
                        <span className="rounded bg-emerald-700/80 px-0.5">
                          {player.goals}G
                        </span>
                      ) : null}
                      {player.matchAssists ? (
                        <span className="rounded bg-sky-600/95 px-0.5 font-bold">
                          {player.matchAssists}A
                        </span>
                      ) : player.assists ? (
                        <span className="rounded bg-sky-700/80 px-0.5">
                          {player.assists}A
                        </span>
                      ) : null}
                      {player.matchYellow ||
                      (player.yellowCards && player.yellowCards > 0) ? (
                        <span
                          className="h-2.5 w-1.5 rounded-[1px] bg-yellow-400 ring-1 ring-black/20"
                          title="Yellow"
                        />
                      ) : null}
                      {player.matchRed ||
                      (player.redCards && player.redCards > 0) ? (
                        <span
                          className="h-2.5 w-1.5 rounded-[1px] bg-rose-600 ring-1 ring-black/20"
                          title="Red"
                        />
                      ) : null}
                      {player.subbedOff ? (
                        <span className="rounded bg-slate-500/90 px-0.5">OUT</span>
                      ) : null}
                      {!player.matchGoals &&
                      !player.goals &&
                      !player.matchAssists &&
                      !player.assists &&
                      !player.matchYellow &&
                      !player.matchRed &&
                      !player.subbedOff &&
                      player.position ? (
                        <span className="opacity-80">{player.position}</span>
                      ) : null}
                    </span>
                    <span className="pointer-events-none absolute -top-8 left-1/2 z-30 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-950/95 px-1.5 py-0.5 text-[9px] text-white shadow-lg group-hover:block">
                      {[
                        `#${player.shirtNumber} ${player.name}`,
                        player.isCaptain ? "©" : null,
                        player.position,
                        player.matchGoals ? `${player.matchGoals}G` : null,
                        player.nationality,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                ) : (
                  <span
                    className={cn(
                      "flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full text-[9px] sm:text-[10px] font-bold text-white/80 shadow ring-2 ring-white/25 border border-dashed border-white/40 bg-black/25",
                      highlightPlace && "ring-sky-200/80"
                    )}
                  >
                    {slot.label}
                  </span>
                )}
              </button>

              {player && !locked && onClearSlot && (
                <button
                  type="button"
                  aria-label={`Remove ${player.name} from XI`}
                  className="absolute -right-2 -top-1 z-[3] flex h-4 w-4 items-center justify-center rounded-full bg-slate-900/85 text-white hover:bg-rose-600 shadow"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearSlot({
                      side,
                      slotId: slot.id,
                      playerId: player.id,
                    });
                  }}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
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
