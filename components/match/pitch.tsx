"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { User, X, SlidersHorizontal } from "lucide-react";
import { slotsFor } from "@/lib/formations";
import { cn } from "@/lib/utils";
import {
  dualNationalities,
  flagUrl,
  formatFoot,
  formatHeight,
  formatRating,
  formatWeight,
  lastNameOf,
  playerPhotoUrl,
  posCode,
} from "@/lib/flags";
import {
  type FieldSettings,
  DEFAULT_FIELD_SETTINGS,
  scaleFactor,
  clampPct,
} from "@/lib/field-settings";
import {
  CARD_GAP_PX,
  estimateCardSizePx,
  fitMarkerPctForContainer,
  resolveCardOverlaps,
} from "@/lib/pitch-layout";

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
  birthCountry?: string | null;
  age?: number | null;
  photoUrl?: string | null;
  apiFootballPlayerId?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  preferredFoot?: string | null;
  /** Season */
  goals?: number;
  assists?: number;
  appearances?: number;
  rating?: number | string | null;
  saves?: number;
  yellowCards?: number;
  redCards?: number;
  cleanSheets?: number;
  /** Match-level */
  matchGoals?: number;
  matchAssists?: number;
  matchYellow?: boolean;
  matchRed?: boolean;
  matchSaves?: number;
  subbedOff?: boolean;
  subMinute?: number | null;
  /** Optional 1-line hook from pinned player note title */
  noteHook?: string | null;
  /** Match-scoped overrides */
  displayName?: string | null;
  pronunciation?: string | null;
  /** primary | secondary | both | specific nationality label */
  pitchFlag?: string | null;
  jerseyNumber?: number | null;
};

type Coach = { name: string; nationality: string; age: number | null };

function lineupBadgeLabel(status?: string) {
  if (status === "confirmed") return "Official (editable)";
  if (status === "predicted") return "Your predicted XI";
  if (status === "expected") return "Expected (last XI)";
  return status ? status : null;
}

function StatCell({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="min-w-0 text-center leading-none">
      <div className="text-[6px] font-semibold uppercase tracking-wide text-slate-500 truncate">
        {label}
      </div>
      <div className="text-[9px] font-bold tabular-nums text-slate-900 truncate">
        {value}
      </div>
    </div>
  );
}

function FlagImg({ nationality, className }: { nationality?: string | null; className?: string }) {
  const src = flagUrl(nationality, 20);
  if (!src) {
    return (
      <span
        className={cn(
          "inline-block h-2.5 w-3.5 rounded-[1px] bg-slate-300/80",
          className
        )}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={cn("h-2.5 w-3.5 object-cover rounded-[1px] shadow-sm", className)}
      loading="lazy"
    />
  );
}

function resolvePitchFlags(
  player: PitchPlayer
): string[] {
  const dual = dualNationalities(player.nationality, player.birthCountry);
  const mode = (player.pitchFlag || "both").trim().toLowerCase();
  if (!dual.length) {
    return player.nationality ? [player.nationality] : [];
  }
  if (mode === "primary" || mode === "first") return [dual[0]];
  if (mode === "secondary" || mode === "second") return [dual[1] || dual[0]];
  if (mode === "both" || mode === "dual") return dual;
  // specific nationality string
  const hit = dual.find(
    (n) => n.toLowerCase() === mode || n.toLowerCase().includes(mode)
  );
  if (hit) return [hit];
  return dual;
}

function SportsComToken({
  player,
  side,
  teamColor,
  slotLabel,
  selected,
  placing,
  cardSettings = DEFAULT_FIELD_SETTINGS,
  markerPct = 0,
}: {
  player: PitchPlayer;
  side: "home" | "away";
  teamColor: string;
  slotLabel: string;
  selected?: boolean;
  placing?: boolean;
  cardSettings?: FieldSettings;
  markerPct?: number;
}) {
  const isHome = side === "home";
  const isGk =
    posCode(player.position, slotLabel) === "GK" ||
    (player.position || "").toUpperCase() === "GK";
  const fieldName = (player.displayName || lastNameOf(player.name)).toUpperCase();
  const pos = posCode(player.position, slotLabel);
  const flagNats = resolvePitchFlags(player);
  const flagTitle = flagNats.length
    ? flagNats.join(" / ")
    : player.nationality || null;
  const photo = playerPhotoUrl({
    photoUrl: player.photoUrl,
    apiFootballPlayerId: player.apiFootballPlayerId,
  });
  const shirt =
    player.jerseyNumber != null && Number.isFinite(player.jerseyNumber)
      ? Number(player.jerseyNumber)
      : player.shirtNumber;
  const apps = player.appearances ?? 0;
  const seasonG = player.goals ?? 0;
  const seasonA = player.assists ?? 0;
  const rating = formatRating(player.rating);
  const age = player.age != null ? String(player.age) : "—";
  const matchG = player.matchGoals ?? 0;
  const matchA = player.matchAssists ?? 0;
  const sub =
    player.subMinute != null
      ? `${player.subMinute}'`
      : player.subbedOff
        ? "OUT"
        : "-";

  const band = isHome
    ? "bg-[#1a1a1a] text-white"
    : "bg-white text-slate-900";
  const borderStyle = isHome
    ? { borderColor: "#ffffff" }
    : { borderColor: teamColor };

  const cols = cardSettings.fieldsPerRow;
  const namePx = 9 * scaleFactor(cardSettings.nameSizePct);
  const markerScale = scaleFactor(markerPct);
  const baseW = 76;

  const outfieldRow1: [string, string | number][] =
    cols === 3
      ? [
          ["APP", apps || "—"],
          ["GOL", seasonG],
          ["AST", seasonA],
        ]
      : cols === 5
        ? [
            ["APP", apps || "—"],
            ["GOL", seasonG],
            ["AST", seasonA],
            ["RTG", rating],
            ["AGE", age],
          ]
        : [
            ["APP", apps || "—"],
            ["GOL", seasonG],
            ["AST", seasonA],
            ["RTG", rating],
          ];
  const outfieldRow2: [string, string | number][] | null =
    cardSettings.dataRows === 2
      ? cols === 3
        ? [
            ["AGE", age],
            ["GOL", matchG],
            ["SUB", sub],
          ]
        : cols === 5
          ? [
              ["AGE", age],
              ["GOL", matchG],
              ["AST", matchA],
              ["SUB", sub],
              ["RTG", rating],
            ]
          : [
              ["AGE", age],
              ["GOL", matchG],
              ["AST", matchA],
              ["SUB", sub],
            ]
      : null;

  const gkRow1: [string, string | number][] =
    cols === 3
      ? [
          ["AGE", age],
          ["HGT", formatHeight(player.heightCm)],
          ["SV", player.matchSaves ?? player.saves ?? 0],
        ]
      : cols === 5
        ? [
            ["AGE", age],
            ["HGT", formatHeight(player.heightCm)],
            ["WGT", formatWeight(player.weightKg)],
            ["FOT", formatFoot(player.preferredFoot)],
            ["SV", player.matchSaves ?? player.saves ?? 0],
          ]
        : [
            ["AGE", age],
            ["HGT", formatHeight(player.heightCm)],
            ["WGT", formatWeight(player.weightKg)],
            ["FOT", formatFoot(player.preferredFoot)],
          ];
  const gkRow2: [string, string | number][] | null =
    cardSettings.dataRows === 2
      ? cols === 3
        ? [
            ["CS", player.cleanSheets ?? 0],
            ["APP", apps || "—"],
            ["RTG", rating],
          ]
        : cols === 5
          ? [
              ["SV", player.matchSaves ?? player.saves ?? 0],
              ["CS", player.cleanSheets ?? 0],
              ["APP", apps || "—"],
              ["RTG", rating],
              ["AGE", age],
            ]
          : [
              ["SV", player.matchSaves ?? player.saves ?? 0],
              ["CS", player.cleanSheets ?? 0],
              ["APP", apps || "—"],
              ["RTG", rating],
            ]
      : null;

  const row1 = isGk ? gkRow1 : outfieldRow1;
  const row2 = isGk ? gkRow2 : outfieldRow2;

  return (
    <span
      className="inline-flex"
      data-pitch-token="1"
      style={{
        transform: `scale(${markerScale})`,
        transformOrigin: "center center",
      }}
    >
      <span
        className={cn(
          "group relative flex flex-col overflow-hidden rounded-md border-[1.5px] shadow-md",
          band,
          selected &&
            "ring-[3px] ring-blue-500 shadow-[0_0_14px_rgba(37,99,235,0.85)]",
          placing && "ring-2 ring-amber-400",
          player.subbedOff && "opacity-50 grayscale-[25%]"
        )}
        style={{ ...borderStyle, width: baseW }}
        title={[
          player.displayName || player.name,
          player.isCaptain ? "Captain" : null,
          pos,
          flagTitle,
          player.age != null ? `Age ${player.age}` : null,
          player.pronunciation ? `🔊 ${player.pronunciation}` : null,
          player.noteHook || null,
        ]
          .filter(Boolean)
          .join(" · ")}
      >
        {/* Header: # + flag/pos */}
        <div
          className={cn(
            "flex items-start justify-between gap-0.5 px-1 pt-0.5",
            isHome ? "bg-[#1a1a1a]" : "bg-white"
          )}
        >
          <span
            className={cn(
              "text-[15px] sm:text-[17px] font-black leading-none tabular-nums",
              isHome ? "text-white" : "text-slate-900"
            )}
          >
            {shirt}
          </span>
          <div className="flex flex-col items-end gap-px pt-0.5">
            <div className="flex items-center gap-px" title={flagTitle || undefined}>
              {flagNats.length ? (
                flagNats.map((n) => <FlagImg key={n} nationality={n} />)
              ) : (
                <FlagImg nationality={player.nationality} />
              )}
            </div>
            <span
              className={cn(
                "text-[7px] font-bold uppercase leading-none tracking-wide",
                isHome ? "text-white/90" : "text-slate-700"
              )}
            >
              {pos}
            </span>
          </div>
        </div>

        {/* Photo + name */}
        <div
          className={cn(
            "flex flex-col items-center px-1 pb-1 pt-0.5",
            isHome ? "bg-[#1a1a1a]" : "bg-neutral-50"
          )}
        >
          <span
            className={cn(
              "relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center overflow-hidden rounded-sm",
              isHome ? "bg-black/40 ring-1 ring-white/20" : "bg-slate-200 ring-1 ring-slate-300"
            )}
          >
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo}
                alt=""
                className="h-full w-full object-cover object-top"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  const sib = (e.target as HTMLImageElement)
                    .nextElementSibling as HTMLElement | null;
                  if (sib) sib.style.display = "flex";
                }}
              />
            ) : null}
            <span
              className={cn(
                "absolute inset-0 items-center justify-center",
                photo ? "hidden" : "flex",
                isHome ? "text-white/50" : "text-slate-400"
              )}
            >
              <User className="h-5 w-5" strokeWidth={1.5} />
            </span>
          </span>
          <span
            className={cn(
              "mt-0.5 w-full truncate text-center font-extrabold uppercase leading-tight tracking-wide",
              isHome ? "text-white" : "text-slate-900"
            )}
            style={{ fontSize: `${namePx}px` }}
          >
            {player.isCaptain ? "© " : ""}
            {fieldName}
          </span>
        </div>

        {/* Cream stats table */}
        <div className="bg-[#FFF8E7] px-0.5 py-0.5 border-t border-black/10">
          <div
            className="grid gap-px"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {row1.map(([label, value]) => (
              <StatCell key={`r1-${label}`} label={label} value={value} />
            ))}
          </div>
          {row2 ? (
            <div
              className="mt-0.5 grid gap-px border-t border-black/5 pt-0.5"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
              {row2.map(([label, value]) => (
                <StatCell key={`r2-${label}`} label={label} value={value} />
              ))}
            </div>
          ) : null}
        </div>

        {(player.matchYellow || player.matchRed) && (
          <span className="absolute left-0.5 top-[22px] flex flex-col gap-px">
            {player.matchYellow ? (
              <span className="h-2 w-1.5 rounded-[1px] bg-yellow-400 shadow" />
            ) : null}
            {player.matchRed ? (
              <span className="h-2 w-1.5 rounded-[1px] bg-rose-600 shadow" />
            ) : null}
          </span>
        )}
      </span>
    </span>
  );
}

function CoachChip({
  coach,
  side,
  teamColor,
}: {
  coach: Coach;
  side: "home" | "away";
  teamColor: string;
}) {
  const isHome = side === "home";
  return (
    <div
      className={cn(
        "pointer-events-none flex items-center gap-1 rounded-md border bg-white/95 shadow px-1 py-0.5 max-w-[9rem]",
        isHome ? "border-slate-800" : ""
      )}
      style={!isHome ? { borderColor: teamColor } : undefined}
    >
      <FlagImg nationality={coach.nationality} className="h-3 w-4" />
      <div className="min-w-0">
        <div className="text-[8px] text-slate-500 leading-none">
          {coach.age != null ? `${coach.age}y` : "Coach"}
        </div>
        <div
          className={cn(
            "truncate text-[9px] font-bold leading-tight",
            isHome ? "text-slate-900" : ""
          )}
          style={!isHome ? { color: teamColor } : undefined}
        >
          {coach.name}
        </div>
      </div>
    </div>
  );
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
  refereeNationality,
  lineupStatus,
  onPlayerClick,
  onSlotDrop,
  onSlotClick,
  onClearSlot,
  placingPlayerId,
  placingSide,
  selectedPlayerId,
  locked,
  compact,
  formationOptions,
  onFormationChange,
  formationBusy,
  lineupHintText,
  onResetOfficial,
  homeScore,
  awayScore,
  matchStatus,
  homeAbbr,
  awayAbbr,
  cardSettings,
  markerPct,
  onOpenFieldSettings,
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
  refereeNationality?: string | null;
  lineupStatus?: string;
  onPlayerClick?: (player: PitchPlayer) => void;
  onSlotDrop?: (args: {
    side: "home" | "away";
    slotId: string;
    playerId: string;
  }) => void;
  onSlotClick?: (args: {
    side: "home" | "away";
    slotId: string;
    occupantId?: string | null;
  }) => void;
  onClearSlot?: (args: {
    side: "home" | "away";
    slotId: string;
    playerId: string;
  }) => void;
  placingPlayerId?: string | null;
  placingSide?: "home" | "away" | null;
  selectedPlayerId?: string | null;
  locked?: boolean;
  compact?: boolean;
  formationOptions?: string[];
  onFormationChange?: (side: "home" | "away", formation: string) => void;
  formationBusy?: boolean;
  lineupHintText?: string;
  onResetOfficial?: () => void;
  homeScore?: number;
  awayScore?: number;
  matchStatus?: string;
  homeAbbr?: string;
  awayAbbr?: string;
  cardSettings?: FieldSettings;
  markerPct?: number;
  onOpenFieldSettings?: () => void;
}) {
  const homeSlots = slotsFor(homeFormation);
  const awaySlots = slotsFor(awayFormation);
  const resolvedSettings = cardSettings || DEFAULT_FIELD_SETTINGS;
  const resolvedMarkerPct = markerPct ?? resolvedSettings.markerSizePct;
  const badge = lineupBadgeLabel(lineupStatus);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const pitchRef = useRef<HTMLDivElement | null>(null);
  const [pitchSize, setPitchSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = pitchRef.current;
    if (!el) return;
    const apply = () => {
      // Measure the actual pitch box (not notes/squad columns).
      const r = el.getBoundingClientRect();
      setPitchSize({ w: Math.round(r.width), h: Math.round(r.height) });
    };
    const applySoon = () => {
      apply();
      // Fullscreen / flex reflow often settles a frame late.
      requestAnimationFrame(() => {
        apply();
        requestAnimationFrame(apply);
      });
    };
    apply();
    const ro = new ResizeObserver(() => applySoon());
    ro.observe(el);
    document.addEventListener("fullscreenchange", applySoon);
    document.addEventListener("webkitfullscreenchange", applySoon as EventListener);
    window.addEventListener("resize", applySoon);
    return () => {
      ro.disconnect();
      document.removeEventListener("fullscreenchange", applySoon);
      document.removeEventListener(
        "webkitfullscreenchange",
        applySoon as EventListener
      );
      window.removeEventListener("resize", applySoon);
    };
  }, []);

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
      const depth = (100 - slot.y) / 100;
      const width = slot.x;
      let x: number;
      let y: number;
      // Expanded depth bands (~46% span): home 2→48, away 52→98.
      // Gives formation lines real horizontal room for ~76×152 cards.
      if (side === "home") {
        x = 2 + depth * 46;
        y = width;
      } else {
        x = 98 - depth * 46;
        y = 100 - width;
      }
      return { slot, player: p as PitchPlayer | undefined, x, y, side };
    });

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

  const rawPlaced = useMemo(() => {
    const homePlaced = placeLandscape(homePlayers, homeSlots, "home");
    const awayPlaced = placeLandscape(awayPlayers, awaySlots, "away");
    return [...homePlaced, ...awayPlaced];
  }, [homePlayers, awayPlayers, homeSlots, awaySlots]);

  // Fit marker to the measured pitch box first (auto-fit when user has not
  // touched Field Settings). Once userAdjusted, honor the slider exactly so
  // −40…+40 is visible — collision still preserves formation depth bands.
  const layoutFittedPct = useMemo(() => {
    if (resolvedSettings.userAdjusted) {
      return clampPct(resolvedMarkerPct);
    }
    return fitMarkerPctForContainer(
      pitchSize.w,
      pitchSize.h,
      resolvedMarkerPct,
      resolvedSettings,
      rawPlaced
    );
  }, [pitchSize.w, pitchSize.h, resolvedMarkerPct, resolvedSettings, rawPlaced]);

  // DOM truth: if real card boxes still overlap after paint, shrink by 5%
  // until clean or floor (-40). Skipped when user owns the size slider.
  const [domShrinkPct, setDomShrinkPct] = useState(0);
  useEffect(() => {
    setDomShrinkPct(0);
  }, [layoutFittedPct, pitchSize.w, pitchSize.h, rawPlaced, resolvedSettings]);

  const fittedMarkerPct = clampPct(layoutFittedPct + domShrinkPct);
  const cardPx = estimateCardSizePx(fittedMarkerPct, resolvedSettings);
  const all = useMemo(() => {
    if (!pitchSize.w || !pitchSize.h) return rawPlaced;
    return resolveCardOverlaps(
      rawPlaced,
      pitchSize.w,
      pitchSize.h,
      cardPx.w,
      cardPx.h,
      CARD_GAP_PX
    );
  }, [rawPlaced, pitchSize.w, pitchSize.h, cardPx.w, cardPx.h]);

  useEffect(() => {
    const root = pitchRef.current;
    if (!root || !pitchSize.w || !pitchSize.h) return;
    let cancelled = false;

    const measureAndShrink = () => {
      if (cancelled) return;
      // User-controlled marker size must not be silently crushed by DOM shrink.
      if (resolvedSettings.userAdjusted) return;
      const nodes = [
        ...root.querySelectorAll('[data-pitch-card="1"]'),
      ] as HTMLElement[];
      if (nodes.length < 2) return;

      const rects = nodes.map((el) => {
        // Prefer the scaled SportsCom token, not the large hit-target button.
        const token =
          (el.querySelector("[data-pitch-token]") as HTMLElement | null) ||
          (el.querySelector("button span.inline-flex") as HTMLElement | null) ||
          (el.querySelector("button") as HTMLElement | null) ||
          el;
        return token.getBoundingClientRect();
      });

      let overlaps = 0;
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i];
          const b = rects[j];
          const hit =
            a.left < b.right - 0.5 &&
            a.right > b.left + 0.5 &&
            a.top < b.bottom - 0.5 &&
            a.bottom > b.top + 0.5;
          if (hit) overlaps++;
        }
      }

      if (overlaps === 0) return;
      setDomShrinkPct((prev) => {
        const nextAbs = clampPct(layoutFittedPct + prev - 5);
        if (nextAbs <= -40 && layoutFittedPct + prev <= -40) return prev;
        const nextShrink = nextAbs - layoutFittedPct;
        if (nextShrink === prev) return prev;
        return nextShrink;
      });
    };

    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(measureAndShrink);
    });
    const t = window.setTimeout(measureAndShrink, 120);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [
    all,
    fittedMarkerPct,
    layoutFittedPct,
    pitchSize.w,
    pitchSize.h,
    resolvedSettings.dataRows,
    resolvedSettings.userAdjusted,
  ]);

  const placing = Boolean(placingPlayerId && !locked);

  const showScore =
    homeScore != null &&
    awayScore != null &&
    (matchStatus === "Live" ||
      matchStatus === "Full Time" ||
      homeScore > 0 ||
      awayScore > 0);

  const statusShort =
    matchStatus === "Full Time"
      ? "FT"
      : matchStatus === "Live"
        ? "LIVE"
        : matchStatus === "Half Time"
          ? "HT"
          : null;

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

  const homeCode = (homeAbbr || homeName).slice(0, 3).toUpperCase();
  const awayCode = (awayAbbr || awayName).slice(0, 3).toUpperCase();

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl border border-emerald-900/40 shadow-inner",
        compact ? "h-full" : "",
        placing && "ring-2 ring-sky-400/70"
      )}
    >
      <div
        ref={pitchRef}
        className={cn(
          "relative w-full",
          compact ? "h-full min-h-[220px]" : "aspect-[16/9]"
        )}
        style={{
          background:
            "repeating-linear-gradient(90deg, #1a7a3c 0 8%, #1f8a44 8% 16%)",
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

        {/* Top chrome: formation | scoreboard | formation */}
        <div className="absolute top-1 left-1.5 right-1.5 z-20 flex items-start justify-between gap-1.5 pointer-events-none">
          <div className="flex flex-col gap-1 items-start pointer-events-auto">
            <div className="rounded bg-white/95 border border-slate-300 shadow px-1.5 py-0.5 text-[10px] flex items-center gap-1 text-slate-800">
              {formationOptions && onFormationChange ? (
                <select
                  className="bg-transparent font-semibold max-w-[4.5rem] outline-none"
                  value={homeFormation}
                  disabled={formationBusy || locked}
                  onChange={(e) => onFormationChange("home", e.target.value)}
                  aria-label="Home formation"
                >
                  {formationOptions.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="font-semibold">{homeFormation}</span>
              )}
            </div>
            {homeCoach && (
              <CoachChip coach={homeCoach} side="home" teamColor={homeColor} />
            )}
          </div>

          <div className="flex flex-col items-center gap-0.5 pointer-events-none">
            {showScore && (
              <div className="flex items-center gap-1.5 rounded-full bg-white/95 shadow-md border border-slate-200 px-2.5 py-1">
                <span className="text-[10px] font-bold text-slate-700 tracking-wide">
                  {homeCode}
                </span>
                <span className="text-sm font-black tabular-nums text-slate-900">
                  {homeScore}-{awayScore}
                </span>
                <span className="text-[10px] font-bold text-slate-700 tracking-wide">
                  {awayCode}
                </span>
              </div>
            )}
            {statusShort && (
              <span className="rounded bg-black/55 px-1.5 py-px text-[8px] font-bold text-white tracking-wider">
                {statusShort}
              </span>
            )}
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
              <span
                className="rounded bg-black/45 px-1.5 py-px text-[8px] text-white/90 max-w-[12rem] truncate"
                title={lineupHintText}
              >
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

          <div className="flex flex-col gap-1 items-end pointer-events-auto">
            {onOpenFieldSettings && (
              <button
                type="button"
                onClick={onOpenFieldSettings}
                className="inline-flex items-center gap-1 rounded-md bg-white/95 border border-slate-300 shadow px-1.5 py-0.5 text-[10px] font-semibold text-slate-800 hover:bg-white"
                title="Field Settings · Pitch Card"
                aria-label="Field Settings"
              >
                <SlidersHorizontal className="h-3 w-3" />
                Field
              </button>
            )}
            <div
              className="rounded shadow px-1.5 py-0.5 text-[10px] flex items-center gap-1 text-white border"
              style={{ backgroundColor: awayColor, borderColor: awayColor }}
            >
              {formationOptions && onFormationChange ? (
                <select
                  className="bg-transparent font-semibold max-w-[4.5rem] outline-none"
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
                <span className="font-semibold">{awayFormation}</span>
              )}
            </div>
            {awayCoach && (
              <CoachChip coach={awayCoach} side="away" teamColor={awayColor} />
            )}
          </div>
        </div>

        {all.map(({ slot, player, x, y, side }) => {
          const color = side === "home" ? homeColor : awayColor;
          const key = `${side}-${slot.id}`;
          const isDragOver = dragOverSlot === key;
          const sideOk = !placingSide || placingSide === side;
          const highlightPlace = placing && sideOk;
          const isPlacingHere = placing && player?.id === placingPlayerId;
          const isSelected = Boolean(
            player && selectedPlayerId && player.id === selectedPlayerId
          );

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
              data-pitch-card={player ? "1" : "0"}
              data-pitch-side={side}
              data-pitch-slot={slot.id}
              style={{ left: `${x}%`, top: `${y}%` }}
              onDragOver={(e) => handleDragOver(e, key)}
              onDragLeave={() => handleDragLeave(key)}
              onDrop={(e) => handleDrop(e, side, slot.id)}
            >
              <div
                className={cn(
                  "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md z-0",
                  isDragOver && "bg-sky-400/20"
                )}
                style={{
                  touchAction: "manipulation",
                  width: cardPx.w,
                  height: cardPx.h,
                }}
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
                    "pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md border-2 z-[1]",
                    isDragOver
                      ? "border-sky-300 bg-sky-400/25 shadow-[0_0_12px_rgba(56,189,248,0.55)]"
                      : "border-white/50 border-dashed bg-white/10"
                  )}
                  style={{ width: cardPx.w, height: cardPx.h }}
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
                  <SportsComToken
                    player={player}
                    side={side}
                    teamColor={color}
                    slotLabel={slot.label}
                    selected={isSelected}
                    placing={isPlacingHere}
                    cardSettings={resolvedSettings}
                    markerPct={fittedMarkerPct}
                  />
                ) : (
                  <span
                    className={cn(
                      "flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-md text-[8px] font-bold text-white/80 shadow ring-1 ring-white/30 border border-dashed border-white/40 bg-black/25",
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
                  className="absolute -right-1.5 -top-1 z-[3] flex h-4 w-4 items-center justify-center rounded-full bg-slate-900/85 text-white hover:bg-rose-600 shadow opacity-70 hover:opacity-100"
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
            <div className="flex flex-col items-center overflow-hidden rounded-md border border-sky-700 bg-white shadow w-[52px]">
              <div className="w-full bg-sky-700 px-1 py-0.5 flex justify-center">
                <FlagImg nationality={refereeNationality} className="h-2.5 w-3.5" />
              </div>
              <div className="flex h-7 w-full items-center justify-center bg-slate-100">
                <User className="h-4 w-4 text-slate-400" strokeWidth={1.5} />
              </div>
              <div className="w-full truncate bg-sky-700 px-0.5 py-0.5 text-center text-[7px] font-bold text-white">
                {lastNameOf(referee)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
