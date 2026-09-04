"use client";

import { slotsFor } from "@/lib/formations";
import { cn } from "@/lib/utils";

type Player = {
  id: string;
  name: string;
  shirtNumber: number;
  formationSlot: string | null;
  isCaptain?: boolean;
  isStarter: boolean;
  onPitch?: boolean;
};

type Coach = { name: string; nationality: string; age: number | null };

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
}: {
  homeName: string;
  awayName: string;
  homeColor: string;
  awayColor: string;
  homeFormation: string;
  awayFormation: string;
  homePlayers: Player[];
  awayPlayers: Player[];
  homeCoach?: Coach | null;
  awayCoach?: Coach | null;
  referee?: string;
  lineupStatus?: string;
  onPlayerClick?: (player: Player) => void;
}) {
  const homeSlots = slotsFor(homeFormation);
  const awaySlots = slotsFor(awayFormation);

  function place(players: Player[], slots: ReturnType<typeof slotsFor>, flip: boolean) {
    return slots.map((slot) => {
      const p = players.find(
        (pl) =>
          pl.formationSlot === slot.id &&
          (pl.onPitch || pl.isStarter)
      );
      const x = flip ? 100 - slot.x : slot.x;
      const y = flip ? 100 - slot.y : slot.y;
      const mappedY = flip ? y * 0.48 : 52 + y * 0.48;
      return { slot, player: p, x, y: mappedY };
    });
  }

  const homePlaced = place(homePlayers, homeSlots, false);
  const awayPlaced = place(awayPlayers, awaySlots, true);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-emerald-900/40 shadow-inner">
      <div
        className="relative aspect-[3/4] sm:aspect-[4/5] lg:aspect-[3/4] w-full"
        style={{
          background:
            "repeating-linear-gradient(90deg, #15803d 0 12.5%, #16a34a 12.5% 25%)",
        }}
      >
        <div className="absolute inset-3 sm:inset-4 border-2 border-white/70 rounded-sm pointer-events-none">
          <div className="absolute left-0 right-0 top-1/2 h-0 border-t-2 border-white/70" />
          <div className="absolute left-1/2 top-1/2 h-20 w-20 sm:h-28 sm:w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/70" />
          <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80" />
          <div className="absolute left-1/2 top-0 h-[18%] w-[55%] -translate-x-1/2 border-2 border-t-0 border-white/70" />
          <div className="absolute left-1/2 bottom-0 h-[18%] w-[55%] -translate-x-1/2 border-2 border-b-0 border-white/70" />
          <div className="absolute left-1/2 top-0 h-[8%] w-[28%] -translate-x-1/2 border-2 border-t-0 border-white/70" />
          <div className="absolute left-1/2 bottom-0 h-[8%] w-[28%] -translate-x-1/2 border-2 border-b-0 border-white/70" />
        </div>

        <div className="absolute top-2 left-2 right-2 z-10 flex items-start justify-between gap-2">
          <div className="rounded-lg bg-black/50 backdrop-blur px-2 py-1 text-white text-xs">
            <div className="font-semibold">{homeName}</div>
            <div className="opacity-80">{homeFormation}</div>
          </div>
          {lineupStatus && (
            <div
              className={cn(
                "rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white",
                lineupStatus === "confirmed" ? "bg-emerald-600/90" : "bg-amber-500/90"
              )}
            >
              {lineupStatus === "confirmed" ? "Confirmed XI" : "Predicted XI"}
            </div>
          )}
          <div className="rounded-lg bg-black/50 backdrop-blur px-2 py-1 text-white text-xs text-right">
            <div className="font-semibold">{awayName}</div>
            <div className="opacity-80">{awayFormation}</div>
          </div>
        </div>

        {[...homePlaced, ...awayPlaced].map(({ slot, player, x, y }, i) => {
          const isHome = i < homePlaced.length;
          const color = isHome ? homeColor : awayColor;
          return (
            <button
              type="button"
              key={`${isHome ? "h" : "a"}-${slot.id}`}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
              style={{ left: `${x}%`, top: `${y}%` }}
              title={player?.name || slot.label}
              onClick={() => player && onPlayerClick?.(player)}
            >
              <div
                className={cn(
                  "flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full text-[10px] sm:text-xs font-bold text-white shadow-lg ring-2 ring-white/50",
                  player && onPlayerClick ? "cursor-pointer hover:ring-teal-300" : ""
                )}
                style={{ backgroundColor: color }}
              >
                {player ? player.shirtNumber : slot.label}
              </div>
              <span className="mt-0.5 max-w-[64px] truncate rounded bg-black/55 px-1 text-[9px] sm:text-[10px] text-white font-medium">
                {player
                  ? `${player.isCaptain ? "© " : ""}${player.name.split(" ").slice(-1)[0]}`
                  : slot.label}
              </span>
            </button>
          );
        })}

        {referee && (
          <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 flex flex-col items-center pointer-events-none">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-yellow-400 text-[9px] font-bold text-slate-900 ring-2 ring-white/60">
              REF
            </div>
            <span className="mt-0.5 rounded bg-black/55 px-1 text-[9px] text-white">
              {referee}
            </span>
          </div>
        )}

        {(homeCoach || awayCoach) && (
          <div className="absolute bottom-2 left-2 right-2 z-10 flex justify-between gap-2 pointer-events-none">
            {homeCoach && (
              <div className="rounded-lg bg-black/55 backdrop-blur px-2 py-1 text-[10px] text-white max-w-[45%]">
                <div className="font-semibold truncate">{homeCoach.name}</div>
                <div className="opacity-80">
                  {homeCoach.nationality}
                  {homeCoach.age ? ` · ${homeCoach.age}y` : ""}
                </div>
              </div>
            )}
            {awayCoach && (
              <div className="rounded-lg bg-black/55 backdrop-blur px-2 py-1 text-[10px] text-white text-right max-w-[45%] ml-auto">
                <div className="font-semibold truncate">{awayCoach.name}</div>
                <div className="opacity-80">
                  {awayCoach.nationality}
                  {awayCoach.age ? ` · ${awayCoach.age}y` : ""}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
