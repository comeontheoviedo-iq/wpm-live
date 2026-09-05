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
  appearances?: number;
  yellowCards?: number;
  redCards?: number;
  matchGoals?: number;
  matchAssists?: number;
  matchYellow?: boolean;
  matchRed?: boolean;
  subbedOff?: boolean;
  /** Optional 1-line hook from pinned player note title */
  noteHook?: string | null;
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
  formationOptions,
  onFormationChange,
  formationBusy,
  lineupHintText,
  onResetOfficial,
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
  formationOptions?: string[];
  onFormationChange?: (side: "home" | "away", formation: string) => void;
  formationBusy?: boolean;
  lineupHintText?: string;
  onResetOfficial?: () => void;
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

        <div className="absolute top-1 left-1.5 right-1.5 z-20 flex items-start justify-between gap-1.5 pointer-events-none">
          <div className="rounded-md bg-black/55 backdrop-blur px-1.5 py-0.5 text-white text-[10px] flex items-center gap-1 pointer-events-auto">
            <span className="font-semibold truncate max-w-[5.5rem]">{homeName}</span>
            {formationOptions && onFormationChange ? (
              <select
                className="rounded bg-black/40 border border-white/25 px-1 py-0 text-[10px] font-semibold max-w-[4.5rem]"
                value={homeFormation}
                disabled={formationBusy || locked}
                onChange={(e) => onFormationChange("home", e.target.value)}
                aria-label="Home formation"
              >
                {formationOptions.map((k) => (
                  <option key={k} value={k} className="text-slate-900">
                    {k}
                  </option>
                ))}
              </select>
            ) : (
              <span className="opacity-80">{homeFormation}</span>
            )}
          </div>
          <div className="flex flex-col items-center gap-0.5 pointer-events-none">
            {badge && (
              <div
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white",
                  lineupStatus === "confirmed"
                    ? "bg-emerald-600/95"
                    : lineupStatus === "predicted"
                      ? "bg-sky-600/95"
                      : "bg-amber-500/95"
                )}
                title={lineupHintText}
              >
                {badge}
              </div>
            )}
            {lineupHintText && (
              <span className="rounded bg-black/45 px-1.5 py-px text-[8px] text-white/90 max-w-[12rem] truncate" title={lineupHintText}>
                {lineupHintText}
              </span>
            )}
            {onResetOfficial && (
              <button
                type="button"
                className="pointer-events-auto text-[8px] font-semibold text-emerald-200 hover:text-white underline"
                disabled={formationBusy}
                onClick={onResetOfficial}
              >
                Reset official
              </button>
            )}
          </div>
          <div className="rounded-md bg-black/55 backdrop-blur px-1.5 py-0.5 text-white text-[10px] flex items-center gap-1 justify-end pointer-events-auto">
            {formationOptions && onFormationChange ? (
              <select
                className="rounded bg-black/40 border border-white/25 px-1 py-0 text-[10px] font-semibold max-w-[4.5rem]"
                value={awayFormation}
                disabled={formationBusy || locked}
                onChange={(e) => onFormationChange("away", e.target.value)}
                aria-label="Away formation"
              >
                {formationOptions.map((k) => (
                  <option key={k} value={k} className="text-slate-900">
                    {k}
                  </option>
                ))}
              </select>
            ) : (
              <span className="opacity-80">{awayFormation}</span>
            )}
            <span className="font-semibold truncate max-w-[5.5rem]">{awayName}</span>
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

          const shortName = player
            ? player.name.split(" ").slice(-1)[0]
            : "";
          const seasonGa =
            player && (player.goals || player.assists)
              ? [
                  player.goals ? `${player.goals}G` : null,
                  player.assists ? `${player.assists}A` : null,
                ]
                  .filter(Boolean)
                  .join(" ")
              : null;
          const appsLabel =
            player && player.appearances && player.appearances > 0
              ? `${player.appearances}apps`
              : null;
          const factsLine = [
            player?.matchGoals ? `${player.matchGoals}G` : null,
            player?.matchAssists ? `${player.matchAssists}A` : null,
            !player?.matchGoals && !player?.matchAssists ? seasonGa : null,
            appsLabel && !player?.matchGoals ? appsLabel : null,
          ]
            .filter(Boolean)
            .join(" · ");

          function slotActivate() {
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
          }

          return (
            <div
              key={key}
              className={cn(
                "absolute z-10 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center",
                !locked && onSlotDrop ? "drop-target" : ""
              )}
              style={{ left: `${x}%`, top: `${y}%` }}
              onDragOver={(e) => handleDragOver(e, key)}
              onDragLeave={() => handleDragLeave(key)}
              onDrop={(e) => handleDrop(e, side, slot.id)}
            >
              {/* ~44px hit target — receives drops even when token button is present */}
              <div
                className={cn(
                  "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-11 w-11 rounded-lg z-0",
                  isDragOver && "bg-sky-400/20"
                )}
                style={{ touchAction: "manipulation" }}
                onDragOver={(e) => handleDragOver(e, key)}
                onDragLeave={() => handleDragLeave(key)}
                onDrop={(e) => handleDrop(e, side, slot.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  slotActivate();
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

              {(isDragOver || highlightPlace) && (
                <div
                  className={cn(
                    "pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-11 w-11 rounded-lg border-2 z-[1]",
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
                      : `${player.name} · click dossier · drag to swap · right-click remove`
                    : locked
                      ? slot.label
                      : placing
                        ? `Tap to place · ${slot.label}`
                        : `Drop / tap slot · ${slot.label}`
                }
                className={cn(
                  "relative z-[2] flex flex-col items-center min-h-[44px] min-w-[44px] justify-center",
                  player ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  slotActivate();
                }}
                draggable={Boolean(player && !locked && onSlotDrop)}
                onDragStart={(e) => {
                  if (!player || locked) {
                    e.preventDefault();
                    return;
                  }
                  e.dataTransfer.setData(
                    "application/pitchline-player",
                    JSON.stringify({ playerId: player.id, side })
                  );
                  e.dataTransfer.setData("text/plain", player.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => handleDragOver(e, key)}
                onDragLeave={() => handleDragLeave(key)}
                onDrop={(e) => handleDrop(e, side, slot.id)}
                onContextMenu={(e) => {
                  if (locked || !player || !onClearSlot) return;
                  e.preventDefault();
                  onClearSlot({
                    side,
                    slotId: slot.id,
                    playerId: player.id,
                  });
                }}
              >
                {player ? (
                  <span
                    className={cn(
                      "group relative flex w-[52px] flex-col items-center gap-px",
                      isPlacingHere && "drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]",
                      player.subbedOff && "opacity-45 grayscale-[30%]"
                    )}
                    title={[
                      player.name,
                      player.isCaptain ? "Captain" : null,
                      player.position || slot.label,
                      factsLine || null,
                      player.matchYellow || player.matchRed
                        ? `Cards${player.matchYellow ? " Y" : ""}${player.matchRed ? " R" : ""}`
                        : null,
                      player.subbedOff ? "Subbed off" : null,
                      player.noteHook || null,
                      player.nationality || null,
                      player.age != null ? `Age ${player.age}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  >
                    <span className="relative">
                      <span
                        className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full text-[9px] sm:text-[10px] font-bold text-white shadow ring-1 ring-white/60"
                        style={{ backgroundColor: color }}
                      >
                        {player.shirtNumber}
                      </span>
                      <span className="absolute -right-2 -top-1.5 flex items-center gap-px">
                        {player.matchGoals ||
                        (!player.matchGoals && player.goals) ? (
                          <span className="rounded bg-emerald-600 px-0.5 text-[7px] font-bold text-white leading-none">
                            {player.matchGoals || player.goals}G
                          </span>
                        ) : null}
                        {player.matchAssists ||
                        (!player.matchAssists &&
                          player.assists &&
                          player.assists > 0) ? (
                          <span className="rounded bg-sky-600 px-0.5 text-[7px] font-bold text-white leading-none">
                            {player.matchAssists || player.assists}A
                          </span>
                        ) : null}
                        {player.matchYellow ||
                        (player.yellowCards && player.yellowCards > 0) ? (
                          <span className="h-2 w-1.5 rounded-[1px] bg-yellow-400" />
                        ) : null}
                        {player.matchRed ||
                        (player.redCards && player.redCards > 0) ? (
                          <span className="h-2 w-1.5 rounded-[1px] bg-rose-600" />
                        ) : null}
                      </span>
                    </span>
                    <span className="max-w-[52px] truncate rounded bg-black/75 px-0.5 text-[8px] font-semibold leading-tight text-white">
                      {player.isCaptain ? "© " : ""}
                      {shortName}
                    </span>
                    <span className="max-w-[52px] truncate text-[7px] font-medium leading-none text-white/85 drop-shadow">
                      {slot.label}
                      {player.position && player.position !== slot.label
                        ? ` · ${player.position}`
                        : ""}
                    </span>
                    {factsLine ? (
                      <span className="max-w-[52px] truncate rounded bg-black/55 px-0.5 text-[7px] font-semibold leading-none text-emerald-200">
                        {factsLine}
                      </span>
                    ) : null}
                    {player.noteHook ? (
                      <span className="max-w-[56px] truncate rounded bg-violet-900/80 px-0.5 text-[6px] font-medium leading-tight text-violet-100">
                        {player.noteHook}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <span
                    className={cn(
                      "flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full text-[8px] font-bold text-white/80 shadow ring-1 ring-white/30 border border-dashed border-white/40 bg-black/25",
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
                  className="absolute -right-2 -top-1 z-[3] flex h-4 w-4 items-center justify-center rounded-full bg-slate-900/85 text-white hover:bg-rose-600 shadow opacity-80"
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
