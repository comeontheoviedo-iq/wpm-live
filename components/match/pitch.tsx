"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { User, X, SlidersHorizontal, ArrowLeftRight } from "lucide-react";
import { slotsFor } from "@/lib/formations";
import { cn } from "@/lib/utils";
import { formatPitchClockBadge } from "@/lib/live-clock";
import {
  dualNationalities,
  flagUrl,
  formatFoot,
  formatRating,
  formatWeight,
  lastNameOf,
  playerPhotoUrl,
  posCode,
} from "@/lib/flags";
import {
  type FieldSettings,
  type FieldSettingsTab,
  type CardStatField,
  DEFAULT_FIELD_SETTINGS,
  scaleFactor,
  clampPct,
  pickVisibleFields,
  formatHeightValue,
  formatMarketValue,
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
  /** Season — competition (desk league) */
  goals?: number;
  assists?: number;
  /** Season — all club competitions (AF sum) */
  goalsAllComps?: number;
  assistsAllComps?: number;
  appearances?: number;
  rating?: number | string | null;
  saves?: number;
  yellowCards?: number;
  redCards?: number;
  cleanSheets?: number;
  /** Market value in EUR (AF), converted for display currency when shown */
  marketValue?: number | null;
  /** Match-level */
  matchGoals?: number;
  matchAssists?: number;
  matchYellow?: boolean;
  matchRed?: boolean;
  matchSaves?: number;
  subbedOff?: boolean;
  subMinute?: number | null;
  /** 1 if started or came on; 0 otherwise */
  matchApps?: number;
  /** Estimated minutes this match */
  matchMinutes?: number | null;
  /** Optional 1-line hook from pinned player note title */
  noteHook?: string | null;
  /** Match-scoped overrides */
  displayName?: string | null;
  pronunciation?: string | null;
  /** primary | secondary | both | specific nationality label */
  pitchFlag?: string | null;
  jerseyNumber?: number | null;
  /** Free-move landscape % (0–100) — overrides slot geometry when set */
  pitchX?: number | null;
  pitchY?: number | null;
};

type Coach = {
  name: string;
  nationality: string;
  age: number | null;
  photoUrl?: string | null;
};

function lineupBadgeLabel(status?: string) {
  if (status === "confirmed") return "Official (editable)";
  if (status === "predicted") return "Your predicted XI";
  if (status === "expected") return "Expected (last XI)";
  return status ? status : null;
}

function StatCell({
  label,
  value,
  title,
  emphasize,
}: {
  label: string;
  value: string | number;
  title?: string;
  /** Highlight live match tallies (e.g. M GOL after a goal). */
  emphasize?: boolean;
}) {
  return (
    <div className="min-w-0 px-px text-center leading-none" title={title || label}>
      <div className="truncate text-[5.5px] font-semibold uppercase tracking-[0.05em] text-slate-500/85">
        {label}
      </div>
      <div
        className={cn(
          "mt-px truncate text-[9px] font-extrabold tabular-nums tracking-tight",
          emphasize
            ? "text-emerald-700 dark:text-emerald-800"
            : "text-slate-900"
        )}
      >
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

function PitchCardToken({
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
    ? "bg-[#141414] text-white"
    : "bg-white text-slate-900";
  const borderStyle = isHome
    ? { borderColor: "#ffffff" }
    : { borderColor: teamColor };

  const cols = cardSettings.fieldsPerRow;
  const namePx = 9 * scaleFactor(cardSettings.nameSizePct);
  const markerScale = scaleFactor(markerPct);
  const baseW = 76;

  // Build cells from Field Settings visibility (S = season, M = match).
  type StatTuple = [string, string | number, string?, boolean?];
  const valueFor = (id: CardStatField): StatTuple => {
    switch (id) {
      case "APP":
        return ["APP", apps || "—", "Season appearances"];
      case "S_GOL":
        return ["S GOL", seasonG, "Season goals"];
      case "S_AST":
        return ["S AST", seasonA, "Season assists"];
      case "M_APP": {
        const mApp = player.matchApps ?? 0;
        return ["M APP", mApp || "—", "Appeared this match", mApp > 0];
      }
      case "M_MIN": {
        const mMin = player.matchMinutes;
        return [
          "M MIN",
          mMin != null && Number.isFinite(mMin) ? mMin : "—",
          "Minutes this match",
          Boolean(mMin && mMin > 0),
        ];
      }
      case "M_GOL":
        return ["M GOL", matchG, "Goals this match", matchG > 0];
      case "M_AST":
        return ["M AST", matchA, "Assists this match", matchA > 0];
      case "RTG":
        return ["RTG", rating, "Season rating"];
      case "AGE":
        return ["AGE", age, "Age"];
      case "SUB":
        return ["SUB", sub, "Sub minute / out"];
      case "HGT":
        return [
          "HGT",
          formatHeightValue(player.heightCm, cardSettings.heightUnit),
          "Height",
        ];
      case "WGT":
        return ["WGT", formatWeight(player.weightKg), "Weight"];
      case "FOT":
        return ["FOT", formatFoot(player.preferredFoot), "Preferred foot"];
      case "SV":
        return [
          "SV",
          player.matchSaves ?? player.saves ?? 0,
          "Saves this match",
        ];
      case "CS":
        return ["CS", player.cleanSheets ?? 0, "Season clean sheets"];
      case "VAL":
        return [
          "VAL",
          formatMarketValue(player.marketValue, cardSettings.currency),
          "Market value",
        ];
      default:
        return ["—", "—"];
    }
  };
  const picked = pickVisibleFields(cardSettings, isGk ? "gk" : "outfield");
  const cells = picked.map(valueFor);
  const row1: StatTuple[] = cells.slice(0, cols);
  const row2Slice = cells.slice(cols, cols * 2);
  const row2: StatTuple[] | null =
    cardSettings.dataRows === 2 && row2Slice.length ? row2Slice : null;


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
          "group relative flex flex-col overflow-hidden rounded-[7px] border shadow-[0_2px_10px_rgba(0,0,0,0.32),0_0_0_1px_rgba(0,0,0,0.06)]",
          band,
          selected &&
            "ring-[3px] ring-blue-500 shadow-[0_0_14px_rgba(37,99,235,0.85)]",
          placing && "ring-2 ring-amber-400",
          player.subbedOff && "opacity-50 grayscale-[25%]"
        )}
        style={{ ...borderStyle, width: baseW, borderWidth: 1.5 }}
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
            "flex items-center justify-between gap-0.5 px-1 pb-px pt-0.5",
            isHome ? "bg-[#141414]" : "bg-white"
          )}
        >
          <span
            className={cn(
              "text-[15px] sm:text-[16px] font-black leading-none tabular-nums tracking-tight",
              isHome ? "text-white" : "text-slate-900"
            )}
          >
            {shirt}
          </span>
          <div className="flex flex-col items-end gap-[1px]">
            <div className="flex items-center gap-px" title={flagTitle || undefined}>
              {flagNats.length ? (
                flagNats.map((n) => <FlagImg key={n} nationality={n} />)
              ) : (
                <FlagImg nationality={player.nationality} />
              )}
            </div>
            <span
              className={cn(
                "text-[6.5px] font-bold uppercase leading-none tracking-[0.06em]",
                isHome ? "text-white/75" : "text-slate-500"
              )}
            >
              {pos}
            </span>
          </div>
        </div>

        {/* Photo + name */}
        <div
          className={cn(
            "flex flex-col items-center px-1 pb-0.5 pt-0.5",
            isHome ? "bg-[#141414]" : "bg-[#f7f7f5]"
          )}
        >
          <span
            className={cn(
              "relative flex h-8 w-8 sm:h-[34px] sm:w-[34px] items-center justify-center overflow-hidden rounded-[5px]",
              isHome ? "bg-black/50 ring-1 ring-white/15" : "bg-slate-200/80 ring-1 ring-slate-300/80"
            )}
          >
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo}
                alt=""
                className="h-full w-full object-cover object-[center_18%]"
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
              <User className="h-4 w-4" strokeWidth={1.5} />
            </span>
          </span>
          <span
            className={cn(
              "mt-0.5 w-full truncate text-center font-extrabold uppercase leading-[1.05] tracking-[0.02em]",
              isHome ? "text-white" : "text-slate-900"
            )}
            style={{ fontSize: `${namePx}px` }}
          >
            {player.isCaptain ? "© " : ""}
            {fieldName}
          </span>
          {player.age != null && Number.isFinite(player.age) ? (
            <span
              className={cn(
                "mt-px text-[6.5px] font-semibold leading-none tabular-nums tracking-wide",
                isHome ? "text-white/70" : "text-slate-500"
              )}
            >
              {Math.round(player.age)} y/o
            </span>
          ) : null}
        </div>

        {/* Cream stats table */}
        <div className="border-t border-black/10 bg-[#F4EFE3] px-0.5 py-[3px]">
          <div
            className="grid gap-y-0.5"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {row1.map(([label, value, tip, emph]) => (
              <StatCell
                key={`r1-${label}`}
                label={label}
                value={value}
                title={tip}
                emphasize={emph}
              />
            ))}
          </div>
          {row2 ? (
            <div
              className="mt-[3px] grid gap-y-0.5 border-t border-black/[0.06] pt-[3px]"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
              {row2.map(([label, value, tip, emph]) => (
                <StatCell
                  key={`r2-${label}`}
                  label={label}
                  value={value}
                  title={tip}
                  emphasize={emph}
                />
              ))}
            </div>
          ) : null}
        </div>

        {(player.matchYellow || player.matchRed) && (
          <span className="absolute left-0.5 top-[20px] flex flex-col gap-px">
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
  onClick,
  compact,
  chrome,
}: {
  coach: Coach;
  side: "home" | "away";
  teamColor: string;
  onClick?: () => void;
  /** One-line avatar + name — less corner height. */
  compact?: boolean;
  chrome?: FieldSettings["coach"];
}) {
  const isHome = side === "home";
  const Comp = onClick ? "button" : "div";
  const showPhoto = chrome?.showPhoto !== false;
  const showFlag = chrome?.showFlag !== false;
  const showAge = Boolean(chrome?.showAge);
  const namePct = chrome?.nameSizePct ?? 0;
  // Only AF-stored photoUrl — never invent a media URL from coach id.
  const photo = showPhoto ? coach.photoUrl?.trim() || null : null;
  const tip = [
    coach.name,
    "Coach",
    coach.age != null ? `${coach.age}y` : null,
    coach.nationality || null,
  ]
    .filter(Boolean)
    .join(" · ");
  const namePx = (compact ? 10 : 11) * scaleFactor(namePct);
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      title={onClick ? `Open ${coach.name} profile · ${tip}` : tip}
      className={cn(
        "pitch-overlay-chip flex items-center text-left",
        compact
          ? "max-w-[11rem] gap-1 px-1 py-0.5"
          : "max-w-[13.5rem] gap-1.5 px-1.5 py-1",
        isHome ? "border-slate-800/70" : "",
        onClick && "pointer-events-auto cursor-pointer hover:ring-2 hover:ring-teal-400/50"
      )}
      style={!isHome ? { borderColor: teamColor } : undefined}
    >
      {showPhoto ? (
        <span
          className={cn(
            "relative flex shrink-0 items-center justify-center overflow-hidden rounded",
            compact ? "h-5 w-5 rounded-sm" : "h-9 w-9 rounded-md",
            "bg-slate-200/90 ring-1 ring-slate-300/80"
          )}
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt=""
              className="h-full w-full object-cover object-[center_15%]"
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
              "absolute inset-0 items-center justify-center text-slate-400",
              photo ? "hidden" : "flex"
            )}
          >
            <User className={compact ? "h-3 w-3" : "h-5 w-5"} strokeWidth={1.5} />
          </span>
        </span>
      ) : null}
      <div className="min-w-0 flex-1 flex items-center gap-1 pr-0.5">
        {showFlag ? (
          <FlagImg
            nationality={coach.nationality}
            className={compact ? "h-2.5 w-3.5" : "h-3 w-[1.05rem]"}
          />
        ) : null}
        <div
          className={cn(
            "truncate whitespace-nowrap font-bold leading-none tracking-tight",
            isHome ? "text-slate-900" : ""
          )}
          style={{
            fontSize: `${namePx}px`,
            ...(!isHome ? { color: teamColor } : {}),
          }}
        >
          {coach.name}
          {showAge && coach.age != null && Number.isFinite(coach.age)
            ? ` · ${Math.round(coach.age)}y`
            : ""}
        </div>
      </div>
    </Comp>
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
  homeSubWindows,
  awaySubWindows,
  lineupHintText,
  onResetOfficial,
  homeScore,
  awayScore,
  minute,
  minuteExtra,
  matchStatus,
  homeAbbr,
  awayAbbr,
  homeLogoUrl,
  awayLogoUrl,
  leagueLogoUrl,
  onHomeLogoClick,
  onAwayLogoClick,
  onLeagueLogoClick,
  cardSettings,
  markerPct,
  onOpenFieldSettings,
  homeOnLeft = true,
  onToggleHomeOnLeft,
  liveCompact,
  onAirMode,
  onFreePlace,
  onCoachClick,
  hasCustomPlacements,
  onResetPlacements,
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
  homeSubWindows?: { used: number; max: number; label: string; windows: number[]; windowsHeuristic?: boolean } | null;
  awaySubWindows?: { used: number; max: number; label: string; windows: number[]; windowsHeuristic?: boolean } | null;
  lineupHintText?: string;
  onResetOfficial?: () => void;
  homeScore?: number;
  awayScore?: number;
  /** AF elapsed minute for live clock */
  minute?: number | null;
  /** AF stoppage/injury time (status.extra) when provided */
  minuteExtra?: number | null;
  matchStatus?: string;
  homeAbbr?: string;
  awayAbbr?: string;
  homeLogoUrl?: string | null;
  awayLogoUrl?: string | null;
  leagueLogoUrl?: string | null;
  onHomeLogoClick?: () => void;
  onAwayLogoClick?: () => void;
  onLeagueLogoClick?: () => void;
  cardSettings?: FieldSettings;
  markerPct?: number;
  onOpenFieldSettings?: (tab?: FieldSettingsTab) => void;
  /** Home team on left of screen (kick L→R). False = home on right. */
  homeOnLeft?: boolean;
  onToggleHomeOnLeft?: () => void;
  /** LIVE: prefer smaller cards / less chrome. */
  liveCompact?: boolean;
  /** On-air presentation: hide secondary pitch badges / tools. */
  onAirMode?: boolean;
  /** Drop anywhere on pitch (free-move, not slot snap). */
  onFreePlace?: (args: {
    side: "home" | "away";
    playerId: string;
    pitchX: number;
    pitchY: number;
  }) => void;
  onCoachClick?: (side: "home" | "away") => void;
  hasCustomPlacements?: boolean;
  onResetPlacements?: () => void;
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
    side: "home" | "away",
    /** When false, this team's geometry is mirrored to the opposite half. */
    onLeft: boolean
  ) {
    const assigned = new Set<string>();
    const eligible = (pl: PitchPlayer) =>
      !pl.subbedOff && (pl.onPitch || pl.isStarter);
    const placed = slots.map((slot) => {
      // Prefer current on-pitch occupant of the slot (sub-ons), then starter.
      const candidates = players.filter(
        (pl) =>
          pl.formationSlot === slot.id &&
          eligible(pl) &&
          !assigned.has(pl.id)
      );
      const p =
        candidates.find((pl) => pl.onPitch) ||
        candidates[0] ||
        undefined;
      if (p) assigned.add(p.id);
      const depth = (100 - slot.y) / 100;
      const width = slot.x;
      let x: number;
      let y: number;
      // Expanded depth bands (~46% span): left half 2→48, right half 52→98.
      if (onLeft) {
        x = 2 + depth * 46;
        y = width;
      } else {
        x = 98 - depth * 46;
        y = 100 - width;
      }
      // Manual free-move overrides formation geometry
      if (p && p.pitchX != null && Number.isFinite(p.pitchX)) x = p.pitchX;
      if (p && p.pitchY != null && Number.isFinite(p.pitchY)) y = p.pitchY;
      return { slot, player: p as PitchPlayer | undefined, x, y, side };
    });

    const validIds = new Set(slots.map((s) => s.id));
    const orphans = players.filter(
      (pl) =>
        eligible(pl) &&
        !assigned.has(pl.id) &&
        (!pl.formationSlot || !validIds.has(pl.formationSlot))
    );
    let oi = 0;
    for (const row of placed) {
      if (row.player) continue;
      if (oi >= orphans.length) break;
      row.player = orphans[oi++];
      assigned.add(row.player.id);
      if (row.player.pitchX != null && Number.isFinite(row.player.pitchX))
        row.x = row.player.pitchX;
      if (row.player.pitchY != null && Number.isFinite(row.player.pitchY))
        row.y = row.player.pitchY;
    }
    // Free-placed players still not assigned (custom coords only)
    for (const pl of orphans.slice(oi)) {
      if (pl.pitchX == null || pl.pitchY == null) continue;
      if (assigned.has(pl.id)) continue;
      placed.push({
        slot: { id: `free-${pl.id}`, label: "·", x: 50, y: 50 },
        player: pl,
        x: pl.pitchX,
        y: pl.pitchY,
        side,
      });
      assigned.add(pl.id);
    }
    return placed;
  }

  const rawPlaced = useMemo(() => {
    const homePlaced = placeLandscape(
      homePlayers,
      homeSlots,
      "home",
      homeOnLeft
    );
    const awayPlaced = placeLandscape(
      awayPlayers,
      awaySlots,
      "away",
      !homeOnLeft
    );
    return [...homePlaced, ...awayPlaced];
  }, [homePlayers, awayPlayers, homeSlots, awaySlots, homeOnLeft]);

  // Fit marker to the measured pitch box first (auto-fit when user has not
  // touched Field Settings). Once userAdjusted, honor the slider exactly —
  // size only changes card width/height; anchors stay on formation slots.
  // LIVE desk: quieter default cards only when the user has NOT touched Field
  // Settings. Never clamp userAdjusted markerSizePct (slider −40…+40 must show).
  const liveDesiredPct =
    liveCompact && !resolvedSettings.userAdjusted
      ? Math.min(resolvedMarkerPct, -35)
      : resolvedMarkerPct;
  // Keep dataRows from Field Settings (default 2) so M GOL / M AST stay visible
  // on LIVE — only shrink marker size for quieter cards when unset by user.
  const liveSettings = useMemo(() => {
    if (!liveCompact) return resolvedSettings;
    if (resolvedSettings.userAdjusted) return resolvedSettings;
    return {
      ...resolvedSettings,
      markerSizePct: liveDesiredPct,
    };
  }, [liveCompact, resolvedSettings, liveDesiredPct]);

  const layoutFittedPct = useMemo(() => {
    if (liveSettings.userAdjusted) {
      // Use the user's marker % (and prop/effectiveMarkerPct), never the LIVE cap.
      return clampPct(resolvedMarkerPct);
    }
    return fitMarkerPctForContainer(
      pitchSize.w,
      pitchSize.h,
      liveDesiredPct,
      liveSettings,
      rawPlaced,
      homeOnLeft
    );
  }, [pitchSize.w, pitchSize.h, liveDesiredPct, liveSettings, rawPlaced, homeOnLeft, resolvedMarkerPct]);

  // DOM truth: if real card boxes still overlap after paint, shrink by 5%
  // until clean or floor (-40). Skipped when user owns the size slider.
  const [domShrinkPct, setDomShrinkPct] = useState(0);
  useEffect(() => {
    setDomShrinkPct(0);
  }, [layoutFittedPct, pitchSize.w, pitchSize.h, rawPlaced, liveSettings]);

  const fittedMarkerPct = clampPct(layoutFittedPct + domShrinkPct);
  const cardPx = estimateCardSizePx(fittedMarkerPct, liveSettings);
  const all = useMemo(() => {
    if (!pitchSize.w || !pitchSize.h) return rawPlaced;
    // CRITICAL: marker size must NOT reposition the XI. When the user owns
    // the slider, keep formation slot centres (rawPlaced). Prefer overlap /
    // clip over pushing cards into the wrong depth band or lateral slot.
    if (liveSettings.userAdjusted) return rawPlaced;
    return resolveCardOverlaps(
      rawPlaced,
      pitchSize.w,
      pitchSize.h,
      cardPx.w,
      cardPx.h,
      CARD_GAP_PX,
      homeOnLeft
    );
  }, [
    rawPlaced,
    pitchSize.w,
    pitchSize.h,
    cardPx.w,
    cardPx.h,
    liveSettings.userAdjusted,
    homeOnLeft,
  ]);

  useEffect(() => {
    const root = pitchRef.current;
    if (!root || !pitchSize.w || !pitchSize.h) return;
    let cancelled = false;

    const measureAndShrink = () => {
      if (cancelled) return;
      // User-controlled marker size must not be silently crushed by DOM shrink.
      if (liveSettings.userAdjusted) return;
      const nodes = [
        ...root.querySelectorAll('[data-pitch-card="1"]'),
      ] as HTMLElement[];
      if (nodes.length < 2) return;

      const rects = nodes.map((el) => {
        // Prefer the scaled pitch card token, not the large hit-target button.
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
    liveSettings.dataRows,
    liveSettings.userAdjusted,
  ]);

  const placing = Boolean(placingPlayerId && !locked);

  const showScore =
    homeScore != null &&
    awayScore != null &&
    (matchStatus === "Live" ||
      matchStatus === "Full Time" ||
      homeScore > 0 ||
      awayScore > 0);

  const statusShortBase =
    matchStatus === "Full Time"
      ? "FT"
      : matchStatus === "Live"
        ? "LIVE"
        : matchStatus === "Half Time"
          ? "HT"
          : null;
  const statusShort = formatPitchClockBadge(
    minute,
    minuteExtra,
    statusShortBase
  );

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
    // Alt/Option = free-move at drop point instead of slot snap
    if (e.altKey && onFreePlace && pitchRef.current) {
      const rect = pitchRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const pitchX = Math.max(
          0,
          Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)
        );
        const pitchY = Math.max(
          0,
          Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)
        );
        onFreePlace({
          side: (payload.side as "home" | "away") || side,
          playerId,
          pitchX,
          pitchY,
        });
        return;
      }
    }
    onSlotDrop({ side, slotId, playerId });
  }

  function handlePitchFreeDrop(e: DragEvent) {
    if (locked || !onFreePlace || !pitchRef.current) return;
    // Only when dropping on the pitch itself (not a slot — those stopPropagation)
    e.preventDefault();
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
    const side = (payload.side as "home" | "away") || null;
    if (!side) return;
    const rect = pitchRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const pitchX = Math.max(
      0,
      Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)
    );
    const pitchY = Math.max(
      0,
      Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)
    );
    onFreePlace({ side, playerId, pitchX, pitchY });
  }

  const homeCode = (homeAbbr || homeName).slice(0, 3).toUpperCase();
  const awayCode = (awayAbbr || awayName).slice(0, 3).toUpperCase();
  const leftCode = homeOnLeft ? homeCode : awayCode;
  const rightCode = homeOnLeft ? awayCode : homeCode;
  const leftScore = homeOnLeft ? homeScore : awayScore;
  const rightScore = homeOnLeft ? awayScore : homeScore;

  const leftChrome = homeOnLeft
    ? {
        side: "home" as const,
        formation: homeFormation,
        coach: homeCoach,
        color: homeColor,
        light: true,
      }
    : {
        side: "away" as const,
        formation: awayFormation,
        coach: awayCoach,
        color: awayColor,
        light: false,
      };
  const rightChrome = homeOnLeft
    ? {
        side: "away" as const,
        formation: awayFormation,
        coach: awayCoach,
        color: awayColor,
        light: false,
      }
    : {
        side: "home" as const,
        formation: homeFormation,
        coach: homeCoach,
        color: homeColor,
        light: true,
      };

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
            "linear-gradient(180deg, rgba(0,0,0,0.12), transparent 18%, transparent 82%, rgba(0,0,0,0.14)), linear-gradient(90deg, rgba(0,0,0,0.08), transparent 10%, transparent 90%, rgba(0,0,0,0.08)), repeating-linear-gradient(90deg, #176f38 0 7.5%, #1c8240 7.5% 15%)",
        }}
       onDragOver={(e) => { if (!locked && onFreePlace) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } }} onDrop={handlePitchFreeDrop} title={onFreePlace ? "Drop on grass for free place · Alt+drop on slot also free-moves" : undefined}>
        {/* S / M legend — season vs match card stats */}
        {!onAirMode && (
          <div className="pointer-events-none absolute bottom-1.5 right-1.5 z-20 rounded bg-black/45 px-1.5 py-0.5 text-[7px] font-semibold tracking-wide text-white/80 whitespace-nowrap">
            S = season · M = this match
          </div>
        )}

        {/* Pitch markings — landscape goals left/right */}
        <div className="pointer-events-none absolute inset-2 rounded-sm border-2 border-white/55 sm:inset-3">
          <div className="absolute top-0 bottom-0 left-1/2 w-0 border-l-2 border-white/55" />
          <div className="absolute left-1/2 top-1/2 h-16 w-16 sm:h-24 sm:w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/55" />
          <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" />
          <div className="absolute top-1/2 left-0 h-[55%] w-[14%] -translate-y-1/2 border-2 border-l-0 border-white/55" />
          <div className="absolute top-1/2 right-0 h-[55%] w-[14%] -translate-y-1/2 border-2 border-r-0 border-white/55" />
          <div className="absolute top-1/2 left-0 h-[28%] w-[6%] -translate-y-1/2 border-2 border-l-0 border-white/55" />
          <div className="absolute top-1/2 right-0 h-[28%] w-[6%] -translate-y-1/2 border-2 border-r-0 border-white/55" />
        </div>

        {/* Top chrome: slim formation+SUB+coach | scoreboard | mirror */}
        <div className="pointer-events-none absolute left-2 right-2 top-2 z-20 flex items-start justify-between gap-3">
          {([leftChrome, rightChrome] as const).map((chrome, idx) => {
            const alignEnd = idx === 1;
            const sw =
              chrome.side === "home" ? homeSubWindows : awaySubWindows;
            return (
              <div
                key={chrome.side + (alignEnd ? "-R" : "-L")}
                className={cn(
                  "pointer-events-auto flex max-w-[42%] flex-col gap-0.5",
                  alignEnd ? "items-end" : "items-start"
                )}
              >
                <div
                  className={cn(
                    "flex flex-wrap items-center gap-0.5",
                    alignEnd && "justify-end"
                  )}
                >
                  <div
                    className={cn(
                      "pitch-overlay-chip flex items-center gap-0.5 px-1 py-px text-[9px] leading-none",
                      chrome.light
                        ? "bg-white/95 border-slate-300 text-slate-800"
                        : "text-white"
                    )}
                    style={
                      chrome.light
                        ? undefined
                        : {
                            backgroundColor: chrome.color,
                            borderColor: chrome.color,
                          }
                    }
                  >
                    {formationOptions && onFormationChange ? (
                      <select
                        className={cn(
                          "bg-transparent font-semibold max-w-[6.25rem] outline-none",
                          !chrome.light && "text-white"
                        )}
                        value={chrome.formation}
                        disabled={formationBusy || locked}
                        onChange={(e) =>
                          onFormationChange(chrome.side, e.target.value)
                        }
                        aria-label={`${chrome.side} formation`}
                      >
                        {formationOptions.map((k) => (
                          <option key={k} value={k} className="text-slate-900">
                            {k}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-semibold">{chrome.formation}</span>
                    )}
                  </div>
                  {sw && sw.max > 0 ? (
                    <div
                      className="pitch-overlay-chip-dark flex items-center gap-0.5 px-1 py-px text-[7.5px] font-semibold tracking-wide text-white leading-none"
                      title={
                        sw.windowsHeuristic
                          ? "Sub windows estimated from event minutes"
                          : "Substitutions used / allowance"
                      }
                    >
                      <span className="tabular-nums">
                        SUB {sw.used}/{sw.max}
                      </span>
                      {sw.windows?.length ? (
                        <span className="opacity-90 flex gap-px">
                          {sw.windows.map((n, i) => (
                            <span
                              key={i}
                              className="rounded bg-white/20 px-0.5 tabular-nums"
                            >
                              {n}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {chrome.coach ? (
                  <CoachChip
                    coach={chrome.coach}
                    side={chrome.side}
                    teamColor={chrome.color}
                    compact
                    chrome={liveSettings.coach}
                    onClick={
                      onCoachClick
                        ? () => onCoachClick(chrome.side)
                        : onOpenFieldSettings
                          ? () => onOpenFieldSettings("coach")
                          : undefined
                    }
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Center scoreboard — kept clear of corner chrome */}
        <div className="pointer-events-none absolute left-1/2 top-2 z-20 flex w-[min(46%,22rem)] -translate-x-1/2 flex-col items-center gap-1">
          {showScore && (
            <div className="pitch-overlay-chip pointer-events-auto flex items-center gap-2 rounded-full px-2.5 py-1">
              {leagueLogoUrl ? (
                <button
                  type="button"
                  onClick={onLeagueLogoClick}
                  className="shrink-0 rounded-sm overflow-hidden hover:ring-2 hover:ring-teal-500"
                  title="League notes"
                  aria-label="Open league notes"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={leagueLogoUrl}
                    alt=""
                    className="h-6 w-6 object-contain"
                  />
                </button>
              ) : null}
              {(() => {
                const leftLogo = homeOnLeft ? homeLogoUrl : awayLogoUrl;
                const rightLogo = homeOnLeft ? awayLogoUrl : homeLogoUrl;
                const onLeft = homeOnLeft ? onHomeLogoClick : onAwayLogoClick;
                const onRight = homeOnLeft ? onAwayLogoClick : onHomeLogoClick;
                const leftTitle = homeOnLeft
                  ? "Home club notes"
                  : "Away club notes";
                const rightTitle = homeOnLeft
                  ? "Away club notes"
                  : "Home club notes";
                return (
                  <>
                    {leftLogo ? (
                      <button
                        type="button"
                        onClick={onLeft}
                        className="shrink-0 rounded-sm overflow-hidden hover:ring-2 hover:ring-teal-500"
                        title={leftTitle}
                        aria-label={leftTitle}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={leftLogo}
                          alt=""
                          className="h-6 w-6 object-contain"
                        />
                      </button>
                    ) : (
                      <span className="text-[11px] font-bold text-slate-700 tracking-wide">
                        {leftCode}
                      </span>
                    )}
                    <span className="text-base font-black tabular-nums text-slate-900 leading-none">
                      {leftScore}-{rightScore}
                    </span>
                    {rightLogo ? (
                      <button
                        type="button"
                        onClick={onRight}
                        className="shrink-0 rounded-sm overflow-hidden hover:ring-2 hover:ring-teal-500"
                        title={rightTitle}
                        aria-label={rightTitle}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={rightLogo}
                          alt=""
                          className="h-6 w-6 object-contain"
                        />
                      </button>
                    ) : (
                      <span className="text-[11px] font-bold text-slate-700 tracking-wide">
                        {rightCode}
                      </span>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* Compact tools: clock + swap + field (desk also has Field/Full) */}
          <div className="pointer-events-auto flex items-center gap-0.5">
            {statusShort && (
              <span className="pitch-overlay-chip-dark rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-white tabular-nums">
                {statusShort}
              </span>
            )}
            {(onToggleHomeOnLeft || onOpenFieldSettings) && !onAirMode && (
              <div className="pitch-overlay-chip inline-flex items-center gap-px p-0.5">
                {onToggleHomeOnLeft && (
                  <button
                    type="button"
                    onClick={onToggleHomeOnLeft}
                    className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-800 hover:bg-white/90"
                    title={
                      homeOnLeft
                        ? "Swap sides · home moves to right"
                        : "Swap sides · home moves to left"
                    }
                    aria-label="Swap sides"
                  >
                    <ArrowLeftRight className="h-3 w-3" />
                  </button>
                )}
                {onOpenFieldSettings && (
                  <button
                    type="button"
                    onClick={() => onOpenFieldSettings("player")}
                    className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-800 hover:bg-white/90"
                    title="Field Settings · Pitch Card"
                    aria-label="Field Settings"
                  >
                    <SlidersHorizontal className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
            {onToggleHomeOnLeft && onAirMode && (
              <button
                type="button"
                onClick={onToggleHomeOnLeft}
                className="pitch-overlay-chip inline-flex h-5 w-5 items-center justify-center text-slate-800 hover:bg-white"
                title={
                  homeOnLeft
                    ? "Swap sides · home moves to right"
                    : "Swap sides · home moves to left"
                }
                aria-label="Swap sides"
              >
                <ArrowLeftRight className="h-3 w-3" />
              </button>
            )}
          </div>

          {!onAirMode && badge && (
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
          {!onAirMode && !badge && lineupHintText && (
            <span
              className="rounded bg-black/45 px-1.5 py-px text-[8px] text-white/90 max-w-[12rem] truncate"
              title={lineupHintText}
            >
              {lineupHintText}
            </span>
          )}
          {!onAirMode && (hasCustomPlacements || onResetOfficial) && (
            <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1">
              {hasCustomPlacements && (
                <span
                  className="rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white shadow-sm"
                  title="Manual pitch positions — survive Sync until Reset"
                >
                  Custom positions
                </span>
              )}
              {hasCustomPlacements && onResetPlacements && (
                <button
                  type="button"
                  className="pitch-overlay-chip border-amber-400/80 px-1.5 py-0.5 text-[8px] font-semibold text-amber-900 hover:bg-amber-50"
                  disabled={formationBusy}
                  onClick={onResetPlacements}
                  title="Clear manual placements and restore official AF XI"
                >
                  Reset placements
                </button>
              )}
              {onResetOfficial && (
                <button
                  type="button"
                  className="pitch-overlay-chip px-1.5 py-0.5 text-[8px] font-semibold text-slate-800 hover:bg-white"
                  disabled={formationBusy}
                  onClick={onResetOfficial}
                >
                  Reset official
                </button>
              )}
            </div>
          )}
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
                "group/card absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center",
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
                  <PitchCardToken
                    player={player}
                    side={side}
                    teamColor={color}
                    slotLabel={slot.label}
                    selected={isSelected}
                    placing={isPlacingHere}
                    cardSettings={liveSettings}
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
                  className="absolute -right-1 -top-1 z-[3] flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-900/80 text-white opacity-0 shadow transition-opacity hover:bg-rose-600 group-hover/card:opacity-90 focus-visible:opacity-100"
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
          <div className="absolute bottom-1.5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5">
            {(() => {
              const rc = liveSettings.referee;
              const showFlag = rc.showFlag !== false;
              const showPrefix = rc.showPrefix !== false;
              const namePx = 9 * scaleFactor(rc.nameSizePct ?? 0);
              const Comp = onOpenFieldSettings ? "button" : "div";
              return (
                <Comp
                  type={onOpenFieldSettings ? "button" : undefined}
                  onClick={
                    onOpenFieldSettings
                      ? () => onOpenFieldSettings("referee")
                      : undefined
                  }
                  title={
                    onOpenFieldSettings
                      ? `Edit referee card · ${referee}`
                      : referee
                  }
                  className={cn(
                    "pitch-overlay-chip-dark flex max-w-[16rem] items-center gap-1.5 rounded-full px-2 py-1",
                    onOpenFieldSettings &&
                      "pointer-events-auto cursor-pointer hover:ring-2 hover:ring-teal-400/50"
                  )}
                >
                  {showFlag ? (
                    <FlagImg
                      nationality={refereeNationality}
                      className="h-3 w-[1.05rem]"
                    />
                  ) : null}
                  <span
                    className="truncate font-semibold tracking-wide text-white"
                    style={{ fontSize: `${namePx}px` }}
                  >
                    {showPrefix ? "Ref · " : ""}
                    {referee}
                  </span>
                </Comp>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
