"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Maximize2,
  Minimize2,
  X,
  Pin,
  SlidersHorizontal,
  History,
} from "lucide-react";
import { PitchBoard, type PitchPlayer } from "@/components/match/pitch";
import { SquadRail, type SquadPlayer } from "@/components/match/squad-rail";
import {
  NotesPanel,
  type NoteRow,
  type NotesFilterScope,
} from "@/components/notes/notes-panel";
import { defaultNotesBucket, noteMatchesCoachCard } from "@/lib/notes-buckets";
import {
  RELEVANT_CAP,
  RELEVANT_TTL_MS,
  armTriggersFromNotes,
  clearRelevant,
  expireRelevant,
  fireTriggers,
  mergeRelevant,
  type ArmedTrigger,
  type RelevantEntry,
} from "@/lib/relevance-engine";
import { PlayerDossier } from "@/components/match/player-dossier";
import { ClubDossier } from "@/components/match/club-dossier";
import { FieldSettingsModal } from "@/components/match/field-settings-modal";
import { EventTimeline } from "@/components/match/event-timeline";
import { EventComposer } from "@/components/live/event-composer";
import { Button } from "@/components/ui/button";
import { FORMATIONS } from "@/lib/formations"
import { summarizeSubWindows } from "@/lib/sub-windows";
import { leagueIdForCompetition } from "@/lib/competitions";
import { deskVenueName } from "@/lib/venue-name";
import { VerdictBlock } from "@/components/match/verdict-block";
import { namesLooselyMatch, parseSubDescription } from "@/lib/player-name";
import { cn } from "@/lib/utils";
import { formatLiveClock } from "@/lib/live-clock";
import { ordinal, seasonOrdinal } from "@/lib/season-tally";
import { bindDeskHotkeys } from "@/lib/desk-hotkeys";
import { enrichFlashLines, momentFingerprint, shouldEmitMomentFlash } from "@/lib/flash-enrich";
import {
  evaluateMomentumProxy,
  evaluatePlayerThresholds,
  type LivePlayerStatRow,
} from "@/lib/live-stat-triggers";
import {
  classifyGameState,
  scoreNotesAgainstGameState,
  type GameStateEvent,
} from "@/lib/game-state-notes";
import {
  DataVizFlashCard,
  type ShotPoint,
  type VizFlashKind,
} from "@/components/match/data-viz-flash";
import {
  pickViz,
  type MomentumSample,
  type VizPayload,
} from "@/lib/viz-build";
import { DeskLiveExtras } from "@/components/match/world-class/desk-live-extras";
import { StatsStoryStrip } from "@/components/match/world-class/stats-story-strip";
import {
  type FieldSettings,
  type FieldSettingsTab,
  DEFAULT_FIELD_SETTINGS,
  loadFieldSettings,
  saveFieldSettings,
  effectiveMarkerPct,
} from "@/lib/field-settings";
import {
  hasManualPlacement,
  type PlayerOverrideRow,
} from "@/lib/player-overrides";

type Coach = {
  id?: string;
  name: string;
  nationality: string;
  age: number | null;
  role?: string | null;
  photoUrl?: string | null;
};

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

type OnAirSuggestion = {
  id: string;
  eventKey: string;
  minute: number;
  eventType: string;
  eventLabel: string;
  text: string;
  source: "note" | "af_stat";
  noteId?: string;
  playerId?: string | null;
  playerName?: string | null;
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

function findPlayerLoose(
  players: PitchPlayer[],
  opts: { id?: string | null; name?: string | null }
): PitchPlayer | undefined {
  if (opts.id) {
    const byId = players.find((p) => p.id === opts.id);
    if (byId) return byId;
  }
  if (opts.name) {
    const exact = players.find(
      (p) => p.name.toLowerCase() === opts.name!.toLowerCase()
    );
    if (exact) return exact;
    return players.find((p) => namesLooselyMatch(p.name, opts.name));
  }
  return undefined;
}

/**
 * Apply AF live sub events onto the XI for display:
 * OFF leaves the slot; ON inherits it. Does not invent names.
 */
function applyLiveSubsToXi(
  players: PitchPlayer[],
  events: MatchEventRow[]
): PitchPlayer[] {
  const byId = new Map(players.map((p) => [p.id, { ...p }]));
  const list = () => [...byId.values()];

  const subs = events
    .filter((e) => e.type === "sub")
    .slice()
    .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));

  for (const e of subs) {
    const { outName, inName } = parseSubDescription(e.description || "");
    const outP = findPlayerLoose(list(), { id: e.playerId, name: outName });
    if (!outP) continue;
    const inheritedSlot = outP.formationSlot;
    const outNext = {
      ...byId.get(outP.id)!,
      subbedOff: true,
      subMinute: e.minute ?? outP.subMinute ?? null,
      onPitch: false,
      // Keep isStarter for squad history, but clear slot so placeLandscape skips
      formationSlot: null as string | null,
    };
    byId.set(outP.id, outNext);

    if (!inName) continue;
    const inP = findPlayerLoose(list(), { name: inName });
    if (!inP || inP.id === outP.id) continue;
    const slot = inheritedSlot || inP.formationSlot;
    byId.set(inP.id, {
      ...byId.get(inP.id)!,
      onPitch: true,
      isStarter: true,
      formationSlot: slot,
      subbedOff: false,
      subMinute: e.minute ?? null,
    });
  }
  return list();
}

/** Scorer name from AF desc: "Normal Goal — Milan Škriniar (Assist Name)". */
function parseGoalScorerName(description: string): string | null {
  const m = description.match(/—\s*([^(\n]+)/);
  return m?.[1]?.trim() || null;
}

function parseAssistName(description: string): string | null {
  const m = description.match(/\(([^)]+)\)\s*$/);
  const name = m?.[1]?.trim() || null;
  if (!name) return null;
  // Subs also use parentheses — ignore non-goal contexts upstream.
  return name;
}

function eventInvolvesPlayer(e: MatchEventRow, p: PitchPlayer): boolean {
  if (e.playerId && e.playerId === p.id) return true;
  if (!e.description) return false;
  const scorer = parseGoalScorerName(e.description);
  if (scorer && namesLooselyMatch(p.name, scorer)) return true;
  const { outName, inName } = parseSubDescription(e.description);
  if (outName && namesLooselyMatch(p.name, outName)) return true;
  if (inName && namesLooselyMatch(p.name, inName)) return true;
  return false;
}

function enrichPlayers(
  players: PitchPlayer[],
  events: MatchEventRow[]
): PitchPlayer[] {
  const withMatchStats = players.map((p) => {
    const goalTypes = new Set(["goal", "penalty_goal", "own_goal"]);
    // Dedupe AF goal rows that reappear when assist text is appended.
    const goalKeys = new Set<string>();
    let matchGoals = 0;
    for (const e of events) {
      if (!goalTypes.has(e.type)) continue;
      const scorer =
        (e.playerId && e.playerId === p.id) ||
        namesLooselyMatch(p.name, parseGoalScorerName(e.description || ""));
      if (!scorer) continue;
      const key = `${e.minute}|${e.type}|${e.playerId || p.id}`;
      if (goalKeys.has(key)) continue;
      goalKeys.add(key);
      matchGoals += 1;
    }
    let matchAssists = 0;
    const assistKeys = new Set<string>();
    for (const e of events) {
      if (!goalTypes.has(e.type)) continue;
      const assistName = parseAssistName(e.description || "");
      if (!assistName || !namesLooselyMatch(p.name, assistName)) continue;
      const key = `${e.minute}|assist|${assistName.toLowerCase()}`;
      if (assistKeys.has(key)) continue;
      assistKeys.add(key);
      matchAssists += 1;
    }
    const mine = events.filter((e) => eventInvolvesPlayer(e, p));
    const matchYellow = mine.some((e) => e.type === "yellow");
    const matchRed = mine.some((e) => e.type === "red");
    return {
      ...p,
      matchGoals: matchGoals || undefined,
      matchAssists: matchAssists || undefined,
      matchYellow: matchYellow || undefined,
      matchRed: matchRed || undefined,
    };
  });
  const withSubs = applyLiveSubsToXi(withMatchStats, events);
  // Match minutes / apps from THIS fixture lineup + sub events (not season).
  const matchEnd = 90;
  return withSubs.map((p) => {
    // After applyLiveSubsToXi: starters who stayed have isStarter+onPitch;
    // subbed-off have subbedOff; sub-ons have subMinute + onPitch.
    const cameOn = p.subMinute != null && !p.subbedOff && Boolean(p.onPitch || p.isStarter);
    const wentOff = Boolean(p.subbedOff);
    const subMin = p.subMinute;
    let matchMinutes: number | null = null;
    let matchApps = 0;
    if (wentOff && subMin != null) {
      matchApps = 1;
      matchMinutes = Math.max(0, subMin);
    } else if (cameOn && subMin != null) {
      matchApps = 1;
      matchMinutes = Math.max(0, matchEnd - subMin);
    } else if (p.onPitch || (p.isStarter && p.formationSlot)) {
      matchApps = 1;
      matchMinutes = matchEnd;
    }
    return {
      ...p,
      matchApps,
      matchMinutes,
    };
  });
}

export function MatchDesk({
  matchId,
  homeName,
  awayName,
  homeFullName,
  awayFullName,
  homeAbbr,
  awayAbbr,
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
  apiFootballFixtureId,
  lastFeedSyncAt,
  status,
  kickoffLabel,
  kickoffAt = null,
  competition,
  homeScore,
  awayScore,
  minute,
  minuteExtra = null,
  period: periodProp = null,
  notes,
  injuryCount,
  predictionsAdvice,
  predictionsJson,
  h2hSummary,
  packCount,
  venueName,
  venueCity,
  venueCapacity,
  attendance = null,
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
  homeTeamAfId = null,
  awayTeamAfId = null,
  playerOverrides: initialOverrides = [],
}: {
  matchId: string;
  homeName: string;
  awayName: string;
  homeFullName: string;
  awayFullName: string;
  homeAbbr?: string;
  awayAbbr?: string;
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
  lineupStatus: string;
  apiFootballFixtureId: number | null;
  lastFeedSyncAt: string | Date | null;
  status: string;
  kickoffLabel: string;
  /** ISO kickoff for tonight vs prematch default bucket */
  kickoffAt?: string | Date | null;
  competition: string;
  homeScore: number;
  awayScore: number;
  minute: number;
  /** AF status.extra stoppage — null when feed omits it */
  minuteExtra?: number | null;
  /** AF/synced period — often "HT" while status stays "Live" (mapAfStatus). */
  period?: string | null;
  notes: NoteRow[];
  injuryCount: number;
  predictionsAdvice: string | null;
  predictionsJson: string | null;
  h2hSummary: string | null;
  packCount: number;
  venueName?: string | null;
  venueCity?: string | null;
  venueCapacity?: number | null;
  /** Live/FT attendance when AF provides it */
  attendance?: number | null;
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
  homeTeamAfId?: number | null;
  awayTeamAfId?: number | null;
  playerOverrides?: PlayerOverrideRow[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<SquadPlayer | null>(null);
  const [placing, setPlacing] = useState<SquadPlayer | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  type LivePopup = {
    id: string;
    kind: "goal" | "sub" | "fact";
    title: string;
    subtitle?: string;
    lines: string[];
    scoreline?: string;
    pinned?: boolean;
    createdAt: number;
    viz?: VizPayload | null;
  };
  const [livePopups, setLivePopups] = useState<LivePopup[]>([]);
  /** Passive archive of dismissed/expired live intel — newest first, capped */
  const INTEL_HISTORY_CAP = 40;
  const [intelHistory, setIntelHistory] = useState<LivePopup[]>([]);
  const [intelHistoryOpen, setIntelHistoryOpen] = useState(false);
  const [coachSide, setCoachSide] = useState<"home" | "away" | null>(null);
  const seenEventKeysRef = useRef<Set<string>>(new Set());
  const livePopupsRef = useRef<LivePopup[]>([]);
  const intelHistoryRef = useRef<LivePopup[]>([]);
  livePopupsRef.current = livePopups;
  intelHistoryRef.current = intelHistory;
  const [configured, setConfigured] = useState<boolean | null>(null);
  const locked = false;
  const [homeForm, setHomeForm] = useState(homeFormation);
  const [awayForm, setAwayForm] = useState(awayFormation);
  const [notesFilter, setNotesFilter] = useState<NotesFilterScope>(() =>
    defaultNotesBucket(status, kickoffAt ?? null)
  );
  const [relevantNoteIds, setRelevantNoteIds] = useState<string[]>([]);
  const [relevantLoading, setRelevantLoading] = useState(false);
  const relevantFetchedAtRef = useRef(0);
  const relevantInFlightRef = useRef(false);
  const armedTriggersRef = useRef<ArmedTrigger[]>([]);
  const relevantEntriesRef = useRef<RelevantEntry[]>([]);
  const [dossierId, setDossierId] = useState<string | null>(null);
  const [clubDossierId, setClubDossierId] = useState<string | null>(null);
  const [onAirOpen, setOnAirOpen] = useState(false);
  /** Presentation mode: collapse notes/squad chrome → slim Relevant+last-event strip */
  const [onAirMode, setOnAirMode] = useState(false);
  const [hotkeyHelpOpen, setHotkeyHelpOpen] = useState(false);
  const sanitizePollError = (raw: unknown): string => {
    const s = typeof raw === "string" ? raw : String(raw || "Sync failed");
    if (/Unknown argument [`']?minuteExtra[`']?/i.test(s)) {
      return "Schema drift — restart after prisma generate";
    }
    if (/TURBOPACK|__TURBOPACK__|Invalid `prisma|prisma\.|at\s+\S+\s+\(/i.test(s) || s.length > 120) {
      return "Sync failed";
    }
    return s;
  };

  const [pollError, setPollError] = useState<string | null>(null);
  const lastGoalPopupRef = useRef<{
    kind: "goal" | "sub" | "fact";
    title: string;
    subtitle?: string;
    lines: string[];
    scoreline?: string;
  } | null>(null);
  const momentFpRef = useRef<string | null>(null);
  /** Once-per-crossing keys for live stat / momentum flashes */
  const firedStatTriggersRef = useRef<Set<string>>(new Set());
  const htVizEmittedRef = useRef(false);
  const ftVizPreviewRef = useRef(false);
  const possessionSamplesRef = useRef<number[]>([]);
  const momentumSamplesRef = useRef<MomentumSample[]>([]);
  const livePlayerStatsRef = useRef<LivePlayerStatRow[]>([]);
  const recentVizKindsRef = useRef<VizFlashKind[]>([]);
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const scoreSampleRef = useRef({ home: homeScore, away: awayScore });
  scoreSampleRef.current = { home: homeScore, away: awayScore };
  const advStatsCacheRef = useRef<{
    homeXg: number | null;
    awayXg: number | null;
    shots: ShotPoint[];
    at: number;
  } | null>(null);
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const relevantNoteIdsRef = useRef(relevantNoteIds);
  relevantNoteIdsRef.current = relevantNoteIds;

  const applyRelevantEntries = useCallback((entries: RelevantEntry[]) => {
    const next = expireRelevant(entries);
    relevantEntriesRef.current = next;
    setRelevantNoteIds(next.map((e) => e.noteId));
  }, []);

  // Arm relevance triggers whenever desk notes change (post-organise / refresh)
  useEffect(() => {
    armedTriggersRef.current = armTriggersFromNotes(notes);
  }, [notes]);

  // TTL: drop expired relevant notes
  useEffect(() => {
    const id = window.setInterval(() => {
      const cur = relevantEntriesRef.current;
      if (!cur.length) return;
      const next = expireRelevant(cur);
      if (next.length !== cur.length) applyRelevantEntries(next);
    }, 15_000);
    return () => window.clearInterval(id);
  }, [applyRelevantEntries]);
  const statisticsRef = useRef(statistics);
  statisticsRef.current = statistics;
  // Sample home possession % + momentum proxy (cap length — no spam)
  useEffect(() => {
    const poss = statistics.find((s) => /possession/i.test(s.label));
    const shots =
      statistics.find((s) => /^shots$/i.test(s.label) || /total shots/i.test(s.label)) ||
      null;
    const parse = (v: string | number | null | undefined) => {
      if (v == null) return null;
      const n = Number(String(v).replace("%", "").replace(/[^\d.-]/g, ""));
      return Number.isFinite(n) ? n : null;
    };
    const hPoss = poss ? parse(poss.homeValue) : null;
    if (hPoss != null) {
      const arr = possessionSamplesRef.current;
      const last = arr[arr.length - 1];
      if (last == null || Math.abs(last - hPoss) >= 1) {
        possessionSamplesRef.current = [...arr, hPoss].slice(-24);
      }
    }
    const hShots = shots ? parse(shots.homeValue) : null;
    const aShots = shots ? parse(shots.awayValue) : null;
    if (hPoss != null || (hShots != null && aShots != null)) {
      const mom = momentumSamplesRef.current;
      const prev = mom[mom.length - 1];
      const same =
        prev &&
        prev.homePoss === hPoss &&
        prev.homeShots === hShots &&
        prev.awayShots === aShots &&
        prev.homeScore === scoreSampleRef.current.home &&
        prev.awayScore === scoreSampleRef.current.away;
      if (!same) {
        momentumSamplesRef.current = [
          ...mom,
          {
            at: Date.now(),
            homePoss: hPoss,
            homeShots: hShots,
            awayShots: aShots,
            homeScore: scoreSampleRef.current.home,
            awayScore: scoreSampleRef.current.away,
          },
        ].slice(-24);
      }
    }
  }, [statistics]);
  const [suggestions, setSuggestions] = useState<OnAirSuggestion[]>([]);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<string[]>([]);
  const [intelOpen, setIntelOpen] = useState(false);
  const [flashEventIds, setFlashEventIds] = useState<string[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const deskRootRef = useRef<HTMLDivElement>(null);
  const [fieldSettings, setFieldSettings] = useState<FieldSettings>(
    DEFAULT_FIELD_SETTINGS
  );
  const [fieldSettingsOpen, setFieldSettingsOpen] = useState(false);
  const [fieldSettingsTab, setFieldSettingsTab] =
    useState<FieldSettingsTab>("player");
  const openFieldSettings = useCallback((tab: FieldSettingsTab = "player") => {
    setFieldSettingsTab(tab);
    setFieldSettingsOpen(true);
  }, []);
  const [overrides, setOverrides] = useState<PlayerOverrideRow[]>(initialOverrides);
  const [homeOnLeft, setHomeOnLeft] = useState(true);
  const isLive = status === "Live" || status === "Half Time";
  /** Prep only: click-to-place rail. LIVE/FT → Squad tab instead. */
  const hideSquadRail =
    status === "Live" || status === "Half Time" || status === "Full Time";

  useEffect(() => {
    const onFs = () => {
      // Whole-page fullscreen (documentElement) — any FS element counts as active
      const active = Boolean(
        document.fullscreenElement ||
        // Safari
        (document as Document & { webkitFullscreenElement?: Element | null })
          .webkitFullscreenElement
      );
      setIsFullscreen(active);
    };
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs as EventListener);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener(
        "webkitfullscreenchange",
        onFs as EventListener
      );
    };
  }, []);

  useEffect(() => {
    setFieldSettings(loadFieldSettings());
  }, []);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`pitchline.homeOnLeft.${matchId}`);
      if (raw === "0") setHomeOnLeft(false);
      else if (raw === "1") setHomeOnLeft(true);
    } catch {
      /* ignore */
    }
  }, [matchId]);

  const toggleHomeOnLeft = useCallback(() => {
    setHomeOnLeft((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(
          `pitchline.homeOnLeft.${matchId}`,
          next ? "1" : "0"
        );
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [matchId]);


  useEffect(() => {
    setOverrides(initialOverrides);
  }, [initialOverrides]);

  const updateFieldSettings = useCallback((next: FieldSettings) => {
    setFieldSettings(next);
    saveFieldSettings(next);
  }, []);

  const markerPct = effectiveMarkerPct(fieldSettings, isFullscreen);

  // When CSS fullscreen class toggles desk height, force a window resize so
  // PitchBoard's observers remeasure the true pitch box (not notes/squad).
  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });
    return () => window.cancelAnimationFrame(id);
  }, [isFullscreen]);

  const applyOverride = useCallback((row: PlayerOverrideRow | null, playerId: string) => {
    setOverrides((prev) => {
      const rest = prev.filter((o) => o.playerId !== playerId);
      if (!row) return rest;
      return [...rest, row];
    });
  }, []);

  const toggleFullscreen = useCallback(async () => {
    type FsEl = HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    type FsDoc = Document & {
      webkitExitFullscreen?: () => Promise<void> | void;
      webkitFullscreenElement?: Element | null;
    };
    const doc = document as FsDoc;
    const active = Boolean(
      document.fullscreenElement || doc.webkitFullscreenElement
    );
    try {
      if (active) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
      } else {
        const node = document.documentElement as FsEl;
        if (node.requestFullscreen) await node.requestFullscreen();
        else if (node.webkitRequestFullscreen) await node.webkitRequestFullscreen();
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Fullscreen unavailable");
    }
  }, []);

  useEffect(() => {
    setHomeForm(homeFormation);
    setAwayForm(awayFormation);
  }, [homeFormation, awayFormation]);

  const preds = useMemo(
    () => parsePredictions(predictionsJson),
    [predictionsJson]
  );

  const noteHookByPlayer = useMemo(() => {
    function hookText(n: NoteRow): string | null {
      const title = (n.title || "").trim();
      const body = (n.body || "").trim();
      // Prefer a spoken hook line from body (pack hooks often bullet/quoted)
      const line = body
        .split(/\n+/)
        .map((l) =>
          l
            .replace(/^[-*•]+\s*/, "")
            .replace(/^"+|"+$/g, "")
            .replace(/^\*\*?\s*/, "")
            .replace(/\*\*?$/g, "")
            .trim()
        )
        .find((l) => l.length > 12 && !/^profile:/i.test(l));
      if (line) return line.length > 42 ? `${line.slice(0, 40)}…` : line;
      // Clean "Name — Hooks/Bio" titles
      const cleaned = title
        .replace(/^.*?\s*[—-]\s*/u, "")
        .replace(/\s*—\s*(Hooks|Bio)$/i, "")
        .trim();
      if (cleaned && !/^(hooks|bio)$/i.test(cleaned)) {
        return cleaned.length > 42 ? `${cleaned.slice(0, 40)}…` : cleaned;
      }
      return null;
    }
    const map = new Map<string, string>();
    // Prefer Hook category, then pinned, then any player note
    const ranked = [...notes].sort((a, b) => {
      const score = (n: NoteRow) =>
        (n.pinned ? 4 : 0) +
        (/hook/i.test(n.category || "") ? 2 : 0) +
        (/hook/i.test(n.title || "") ? 1 : 0);
      return score(b) - score(a);
    });
    for (const n of ranked) {
      if (!n.entityId) continue;
      if (n.entityType && n.entityType !== "player") continue;
      if (map.has(n.entityId)) continue;
      const hook = hookText(n);
      if (hook) map.set(n.entityId, hook);
    }
    return map;
  }, [notes]);

  const overrideById = useMemo(() => {
    const m = new Map<string, PlayerOverrideRow>();
    for (const o of overrides) m.set(o.playerId, o);
    return m;
  }, [overrides]);

  const homeEnriched = useMemo(
    () =>
      enrichPlayers(homePlayers, events).map((p) => {
        const o = overrideById.get(p.id);
        return {
          ...p,
          // Slot override wins for display until Reset official
          formationSlot: o?.formationSlot || p.formationSlot,
          noteHook: noteHookByPlayer.get(p.id) || null,
          displayName: o?.displayName ?? null,
          pronunciation: o?.pronunciation ?? null,
          pitchFlag: o?.pitchFlag ?? null,
          jerseyNumber: o?.jerseyNumber ?? null,
          pitchX: o?.pitchX ?? null,
          pitchY: o?.pitchY ?? null,
        };
      }),
    [homePlayers, events, noteHookByPlayer, overrideById]
  );
  const awayEnriched = useMemo(
    () =>
      enrichPlayers(awayPlayers, events).map((p) => {
        const o = overrideById.get(p.id);
        return {
          ...p,
          formationSlot: o?.formationSlot || p.formationSlot,
          noteHook: noteHookByPlayer.get(p.id) || null,
          displayName: o?.displayName ?? null,
          pronunciation: o?.pronunciation ?? null,
          pitchFlag: o?.pitchFlag ?? null,
          jerseyNumber: o?.jerseyNumber ?? null,
          pitchX: o?.pitchX ?? null,
          pitchY: o?.pitchY ?? null,
        };
      }),
    [awayPlayers, events, noteHookByPlayer, overrideById]
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

  const squadRef = useRef(squad);
  squadRef.current = squad;
  const noteHookByPlayerRef = useRef<Record<string, string>>({});
  noteHookByPlayerRef.current = Object.fromEntries(noteHookByPlayer.entries());
  const scoreRef = useRef({ home: homeScore, away: awayScore });
  scoreRef.current = { home: homeScore, away: awayScore };

  const [liveMinute, setLiveMinute] = useState(minute);
  const [liveMinuteExtra, setLiveMinuteExtra] = useState<number | null>(
    minuteExtra ?? null
  );
  useEffect(() => {
    setLiveMinute(minute);
  }, [minute]);
  useEffect(() => {
    setLiveMinuteExtra(minuteExtra ?? null);
  }, [minuteExtra]);
  const clockLabel = formatLiveClock(liveMinute, liveMinuteExtra, {
    status,
  });

  useEffect(() => {
    if (!placing) return;
    const fresh = squad.find((p) => p.id === placing.id);
    if (fresh) setPlacing(fresh);
    else setPlacing(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squad]);



  useEffect(() => {
    return bindDeskHotkeys({
      onFocusNotesSearch: () => {
        // NotesPanel also binds `/` — dispatch focus via query
        const el = document.querySelector<HTMLInputElement>(
          '[data-pitchline-notes-search="1"]'
        );
        el?.focus();
      },
      onReopenLastGoal: () => {
        const g = lastGoalPopupRef.current;
        if (!g) {
          setMsg("No recent goal card to re-open");
          return;
        }
        const id = `goal-reopen|${Date.now()}`;
        setLivePopups((prev) =>
          [
            ...prev,
            { ...g, id, createdAt: Date.now(), pinned: true },
          ].slice(-5)
        );
      },
      onSwapSides: () => toggleHomeOnLeft(),
      onToggleOnAirMode: () => setOnAirMode((v) => !v),
      onToggleHelp: () => setHotkeyHelpOpen((v) => !v),
      onOpenShirt: (shirt) => {
        const onPitch = squad.filter((p) => p.onPitch || p.isStarter);
        const pool = onPitch.length ? onPitch : squad;
        const hit =
          pool.find((p) => p.shirtNumber === shirt) ||
          squad.find((p) => p.shirtNumber === shirt);
        if (hit) {
          setSelected(hit);
          setDossierId(hit.id);
        } else {
          setMsg(`No shirt #${shirt} on this desk`);
        }
      },
    });
  }, [toggleHomeOnLeft, squad]);

  const starterCount =
    homeEnriched.filter((p) => p.isStarter || p.onPitch).length +
    awayEnriched.filter((p) => p.isStarter || p.onPitch).length;

  const fetchAdvancedViz = useCallback(async () => {
    const cached = advStatsCacheRef.current;
    if (cached && Date.now() - cached.at < 60_000) return cached;
    try {
      const res = await fetch(`/api/matches/${matchId}/advanced-stats`, {
        cache: "no-store",
      });
      if (!res.ok) return null;
      const json = await res.json();
      const payload = {
        homeXg: json.homeXg ?? null,
        awayXg: json.awayXg ?? null,
        shots: (json.shots || []) as ShotPoint[],
        at: Date.now(),
      };
      advStatsCacheRef.current = payload;
      return payload;
    } catch {
      return null;
    }
  }, [matchId]);

  const attachVizToPopup = useCallback(
    async (
      popupId: string,
      prefer: VizFlashKind | null,
      context: string = "default",
      extra?: { focusStat?: string | null; focusAfPlayerId?: number | null }
    ) => {
      const adv = await fetchAdvancedViz();
      const bags = {
        shots: adv?.shots || [],
        homeXg: adv?.homeXg ?? null,
        awayXg: adv?.awayXg ?? null,
        homeGoals: scoreSampleRef.current.home,
        awayGoals: scoreSampleRef.current.away,
        possessionSamples: [...possessionSamplesRef.current],
        statistics: statisticsRef.current,
        events: eventsRef.current.map((e) => ({
          minute: e.minute,
          type: e.type,
          teamSide: e.teamSide,
          description: e.description,
        })),
        livePlayerStats: livePlayerStatsRef.current,
        momentumSamples: [...momentumSamplesRef.current],
        focusStat: extra?.focusStat ?? null,
        focusAfPlayerId: extra?.focusAfPlayerId ?? null,
      };
      const viz = pickViz({
        prefer,
        context,
        bags,
        recentKinds: recentVizKindsRef.current,
      });
      if (!viz) return;
      recentVizKindsRef.current = [...recentVizKindsRef.current, viz.kind].slice(-6);
      setLivePopups((prev) =>
        prev.map((p) => (p.id === popupId ? { ...p, viz } : p))
      );
    },
    [fetchAdvancedViz]
  );

  const pushIntelHistory = useCallback((popup: LivePopup) => {
    setIntelHistory((prev) => {
      if (prev.some((p) => p.id === popup.id)) return prev;
      return [{ ...popup, pinned: false }, ...prev].slice(0, INTEL_HISTORY_CAP);
    });
  }, []);

  /** Strip trailing |Date.now() / |reopen|Date.now() so the same event cannot re-fire. */
  const normalizeLivePopupKey = useCallback((id: string) => {
    return id.replace(/\|reopen\|\d+$/, "").replace(/\|\d+$/, "");
  }, []);

  /** Remove a live popup and archive it (skip archive if still pinned unless force). */
  const dismissLivePopup = useCallback(
    (id: string, opts?: { force?: boolean }) => {
      setLivePopups((prev) => {
        const hit = prev.find((p) => p.id === id);
        if (!hit) return prev;
        if (hit.pinned && !opts?.force) return prev;
        // Capture current payload (incl. viz) before removal
        queueMicrotask(() => pushIntelHistory(hit));
        return prev.filter((p) => p.id !== id);
      });
    },
    [pushIntelHistory]
  );

  /** Force-dismiss every live intel flash (Esc / Clear). Also clears RELEVANT. */
  const clearAllLivePopups = useCallback(() => {
    setLivePopups((prev) => {
      if (prev.length === 0) return prev;
      for (const hit of prev) {
        queueMicrotask(() => pushIntelHistory({ ...hit, pinned: false }));
      }
      return [];
    });
    relevantEntriesRef.current = clearRelevant();
    setRelevantNoteIds([]);
    // Also clear sticky live banners (one-away / VAR) via DeskLiveExtras listener
    try {
      window.dispatchEvent(new CustomEvent("pitchline:clear-live-banners"));
    } catch {
      /* soft-fail */
    }
  }, [pushIntelHistory]);

  const pushLivePopup = useCallback(
    (popup: Omit<LivePopup, "id" | "createdAt" | "pinned"> & { id?: string }, ttlMs: number) => {
      const id = popup.id || `live|${Date.now()}`;
      const baseKey = normalizeLivePopupKey(id);
      const alreadyLive = livePopupsRef.current.some(
        (p) => normalizeLivePopupKey(p.id) === baseKey
      );
      const alreadyHist = intelHistoryRef.current.some(
        (p) => normalizeLivePopupKey(p.id) === baseKey
      );
      if (alreadyLive || alreadyHist) {
        return id;
      }
      const full: LivePopup = {
        ...popup,
        id,
        createdAt: Date.now(),
        pinned: false,
      };
      setLivePopups((prev) => {
        // Re-check inside updater in case of concurrent pushes
        if (prev.some((p) => normalizeLivePopupKey(p.id) === baseKey)) {
          return prev;
        }
        const next = [...prev, full];
        if (next.length > 5) {
          const overflow = next.slice(0, next.length - 5);
          for (const o of overflow) {
            queueMicrotask(() => pushIntelHistory(o));
          }
          return next.slice(-5);
        }
        return next;
      });
      if (ttlMs > 0) {
        // force:true so pinned cards still expire (or auto-unpin via force dismiss)
        window.setTimeout(() => dismissLivePopup(id, { force: true }), ttlMs);
      }
      return id;
    },
    [dismissLivePopup, pushIntelHistory, normalizeLivePopupKey]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setPlacing(null);
      setMsg(null);
      clearAllLivePopups();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearAllLivePopups]);

  const reopenIntelHistory = useCallback(
    (item: LivePopup) => {
      const id = `${item.id}|reopen|${Date.now()}`;
      setLivePopups((prev) =>
        [
          ...prev,
          {
            ...item,
            id,
            createdAt: Date.now(),
            pinned: true,
          },
        ].slice(-5)
      );
      setIntelHistoryOpen(false);
      setMsg(`Reopened: ${item.title}`);
    },
    []
  );

    const loadSuggestions = useCallback(
    async (
      news?: {
        type: string;
        minute: number;
        description: string;
        playerId?: string | null;
      }[]
    ) => {
      try {
        const res = await fetch(`/api/matches/${matchId}/suggest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events: news || [] }),
        });
        const json = await res.json();
        if (!res.ok) return;
        const list = (json.suggestions || []) as OnAirSuggestion[];
        if (!list.length) return;
        setSuggestions((prev) => {
          const seen = new Set(prev.map((s) => s.id + s.text));
          const merged = [...prev];
          for (const s of list) {
            const k = s.id + s.text;
            if (seen.has(k)) continue;
            seen.add(k);
            merged.push(s);
          }
          return merged.slice(-24);
        });
        // Do not auto-expand On-air over the pitch — Chris opens via header.
      } catch {
        /* ignore */
      }
    },
    [matchId]
  );

  const notesFilterRef = useRef(notesFilter);
  notesFilterRef.current = notesFilter;

  const loadRelevantNotes = useCallback(
    async (
      news?: {
        type: string;
        minute: number;
        description: string;
        playerId?: string | null;
        teamSide?: string | null;
      }[],
      opts?: { force?: boolean; autoSwitch?: boolean }
    ) => {
      if (status !== "Live" && status !== "Full Time" && !opts?.force) return;
      const now = Date.now();
      // Throttle: skip if fetched < 45s ago unless forced by a live event
      if (!opts?.force && now - relevantFetchedAtRef.current < 45_000) {
        return;
      }
      if (relevantInFlightRef.current) return;
      relevantInFlightRef.current = true;
      setRelevantLoading(true);
      try {
        const trigger = (news && news[0]) || null;
        const gsEvents: GameStateEvent[] = (news || []).map((e) => ({
          type: e.type,
          minute: e.minute,
          description: e.description,
          playerId: e.playerId,
          teamSide: e.teamSide ?? null,
        }));
        const gameState = {
          minute: liveMinute,
          status,
          homeScore: scoreRef.current.home,
          awayScore: scoreRef.current.away,
          homeName,
          awayName,
          trigger,
          tags: classifyGameState({
            minute: liveMinute,
            status,
            homeScore: scoreRef.current.home,
            awayScore: scoreRef.current.away,
            homeName,
            awayName,
            trigger,
            events: gsEvents,
          }),
        };
        const res = await fetch(`/api/matches/${matchId}/notes/relevant`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            events: news || [],
            limit: RELEVANT_CAP,
            gameState,
          }),
        });
        const json = await res.json();
        if (!res.ok) return;
        const ids = (json.noteIds || []) as string[];
        const merged = mergeRelevant(
          relevantEntriesRef.current,
          ids.slice(0, RELEVANT_CAP).map((noteId) => ({
            noteId,
            reason: "api",
          })),
          Date.now(),
          { cap: RELEVANT_CAP, ttlMs: RELEVANT_TTL_MS }
        );
        relevantEntriesRef.current = merged;
        setRelevantNoteIds(merged.map((e) => e.noteId));
        relevantFetchedAtRef.current = Date.now();
        const f = notesFilterRef.current;
        if (opts?.autoSwitch && merged.length && (f === "all" || f === "relevant" || f === "prematch" || f === "tonight")) {
          setNotesFilter("relevant");
        }
      } catch {
        /* ignore */
      } finally {
        relevantInFlightRef.current = false;
        setRelevantLoading(false);
      }
    },
    [matchId, status, liveMinute, homeName, awayName]
  );

  const pinSuggestion = useCallback(
    async (s: OnAirSuggestion) => {
      try {
        await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matchId,
            title: s.eventLabel || "On-air suggestion",
            body: s.text,
            category: "Match",
            entityType: s.playerId ? "player" : "match",
            entityId: s.playerId || matchId,
            pinned: true,
          }),
        });
        setDismissedSuggestions((d) => [...d, s.id]);
        router.refresh();
      } catch {
        setMsg("Could not pin suggestion");
      }
    },
    [matchId, router]
  );

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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: silent ? "live" : "full" }),
        });
        const json = await res.json();
        if (!res.ok) {
          const err = sanitizePollError(json.error || "Sync failed");
          setMsg(err);
          setPollError(err);
        } else {
          setPollError(null);
          const syncedHome =
            typeof json.homeScore === "number"
              ? json.homeScore
              : typeof json.match?.homeScore === "number"
                ? json.match.homeScore
                : null;
          const syncedAway =
            typeof json.awayScore === "number"
              ? json.awayScore
              : typeof json.match?.awayScore === "number"
                ? json.match.awayScore
                : null;
          if (syncedHome != null && syncedAway != null) {
            scoreRef.current = { home: syncedHome, away: syncedAway };
          }
          const syncedMinute =
            typeof json.match?.minute === "number"
              ? json.match.minute
              : typeof json.minute === "number"
                ? json.minute
                : null;
          if (syncedMinute != null) setLiveMinute(syncedMinute);
          if ("minuteExtra" in (json.match || {}) || "minuteExtra" in json) {
            const ex =
              json.match?.minuteExtra ?? json.minuteExtra ?? null;
            setLiveMinuteExtra(
              typeof ex === "number" && Number.isFinite(ex) ? ex : null
            );
          }
          const news = (json.newEvents || []) as {
            type: string;
            minute: number;
            description: string;
            playerId?: string | null;
            seasonLines?: string[];
            assistSeasonLines?: string[];
          }[];
          if (news.length) {
            const top = news
              .slice(0, 3)
              .map((e) => `${e.minute}' ${e.description}`)
              .join(" · ");
            setFlash(`${news.length} new: ${top}`);
            setTimeout(() => setFlash(null), 8000);
            const actionable = news.filter((e) =>
              /goal|yellow|red|sub|penalty/i.test(e.type || "")
            );
            if (actionable.length) {
              // Local relevance engine: fire armed triggers immediately
              const localHits: { noteId: string; reason: string }[] = [];
              for (const ev of actionable) {
                const fired = fireTriggers(armedTriggersRef.current, ev, {
                  limit: RELEVANT_CAP,
                });
                for (const h of fired) {
                  localHits.push({ noteId: h.noteId, reason: h.reason });
                }
              }
              if (localHits.length) {
                const merged = mergeRelevant(
                  relevantEntriesRef.current,
                  localHits,
                  Date.now(),
                  { cap: RELEVANT_CAP, ttlMs: RELEVANT_TTL_MS }
                );
                relevantEntriesRef.current = merged;
                setRelevantNoteIds(merged.map((e) => e.noteId));
                const f = notesFilterRef.current;
                if (
                  /goal|sub/i.test(actionable.map((a) => a.type).join(" ")) &&
                  (f === "all" ||
                    f === "relevant" ||
                    f === "prematch" ||
                    f === "tonight")
                ) {
                  setNotesFilter("relevant");
                }
              }
              void loadSuggestions(actionable);
              void loadRelevantNotes(actionable, {
                force: true,
                autoSwitch: /goal|sub/i.test(
                  actionable.map((a) => a.type).join(" ")
                ),
              });
            }
            // Rich goal / sub popups — commentary desk cards (stackable)
            for (const e of news) {
              const key = `${e.minute}|${e.type}|${e.description}`;
              if (seenEventKeysRef.current.has(key)) continue;
              seenEventKeysRef.current.add(key);

              const pushPopup = (
                popup: Omit<LivePopup, "id" | "createdAt" | "pinned">
              ) => {
                const id = `${key}|${Date.now()}`;
                pushLivePopup(
                  { ...popup, id },
                  popup.kind === "goal" ? 15_000 : 12_000
                );
              };

              const newsPlayerId =
                (e as { playerId?: string | null }).playerId || null;

              if (/goal|penalty_goal|own_goal/i.test(e.type || "")) {
                const scorerName = parseGoalScorerName(e.description || "");
                const assistName = parseAssistName(e.description || "");
                const scorer =
                  squadRef.current.find(
                    (p) =>
                      (newsPlayerId && newsPlayerId === p.id) ||
                      namesLooselyMatch(p.name, scorerName)
                  ) || null;
                const assister =
                  (assistName &&
                    squadRef.current.find((p) =>
                      namesLooselyMatch(p.name, assistName)
                    )) ||
                  null;
                const hook = scorer
                  ? noteHookByPlayerRef.current[scorer.id] || null
                  : null;
                const isOwn = /own_goal/i.test(e.type || "");
                const serverSeason = (e as { seasonLines?: string[] }).seasonLines;
                const serverAssist = (e as { assistSeasonLines?: string[] })
                  .assistSeasonLines;
                const seasonBits: string[] = [];
                if (!isOwn) {
                  if (serverSeason?.length) {
                    seasonBits.push(...serverSeason);
                  } else if (scorer) {
                    // Client fallback from synced competition + all-comp fields
                    const matchGoals =
                      (scorer.matchGoals || 0) > 0
                        ? scorer.matchGoals!
                        : 1;
                    const afComp = scorer.goals ?? null;
                    const afAll =
                      (scorer as { goalsAllComps?: number }).goalsAllComps ??
                      afComp;
                    const nth = seasonOrdinal(
                      afComp,
                      matchGoals,
                      matchGoals,
                      status
                    );
                    if (nth != null) {
                      seasonBits.push(
                        `${ordinal(nth)} in ${competition} this season`
                      );
                    } else {
                      seasonBits.push(
                        `${competition} goal tally unavailable from feed`
                      );
                    }
                    const allNth = seasonOrdinal(
                      afAll,
                      matchGoals,
                      matchGoals,
                      status
                    );
                    if (allNth != null) {
                      seasonBits.push(
                        `${allNth} ${allNth === 1 ? "goal" : "goals"} all competitions this season`
                      );
                    }
                  }
                  if (assistName) {
                    if (serverAssist?.length) {
                      seasonBits.push(
                        ...serverAssist.map((l) =>
                          l.startsWith("Assist:") ? l : `Assist — ${l}`
                        )
                      );
                    } else if (assister) {
                      const matchA =
                        (assister.matchAssists || 0) > 0
                          ? assister.matchAssists!
                          : 1;
                      const afCompA = assister.assists ?? null;
                      const afAllA =
                        (assister as { assistsAllComps?: number })
                          .assistsAllComps ?? afCompA;
                      const nthA = seasonOrdinal(
                        afCompA,
                        matchA,
                        matchA,
                        status
                      );
                      if (nthA != null) {
                        seasonBits.push(
                          `Assist — ${ordinal(nthA)} in ${competition} this season`
                        );
                      }
                      const allA = seasonOrdinal(
                        afAllA,
                        matchA,
                        matchA,
                        status
                      );
                      if (allA != null) {
                        seasonBits.push(
                          `Assist — ${allA} ${allA === 1 ? "assist" : "assists"} all competitions this season`
                        );
                      }
                    }
                  }
                }
                const baseLines = [
                  scorerName
                    ? `Scorer: ${scorer?.name || scorerName}`
                    : e.description,
                  assistName
                    ? `Assist: ${assister?.name || assistName}`
                    : null,
                  ...seasonBits,
                  hook ? `Note: ${hook}` : null,
                ].filter(Boolean) as string[];
                const gsTrigger: GameStateEvent = {
                  type: e.type,
                  minute: e.minute,
                  description: e.description,
                  playerId: newsPlayerId,
                  teamSide: (e as { teamSide?: string | null }).teamSide ?? null,
                };
                const gsTags = classifyGameState({
                  minute: e.minute,
                  status,
                  homeScore: scoreRef.current.home,
                  awayScore: scoreRef.current.away,
                  homeName,
                  awayName,
                  trigger: gsTrigger,
                  events: [gsTrigger],
                });
                const gsHits = scoreNotesAgainstGameState({
                  notes: notesRef.current,
                  tags: gsTags,
                  trigger: gsTrigger,
                  homeName,
                  awayName,
                  homeScore: scoreRef.current.home,
                  awayScore: scoreRef.current.away,
                  homeClubId: homeClubId || null,
                  awayClubId: awayClubId || null,
                  limit: 4,
                });
                const gsNoteIds = new Set(gsHits.map((h) => h.noteId));
                const relevantSnips = notesRef.current
                  .filter(
                    (n) =>
                      gsNoteIds.has(n.id) ||
                      relevantNoteIdsRef.current.includes(n.id) ||
                      (scorer && n.entityId === scorer.id)
                  )
                  .sort((a, b) => {
                    const sa = gsHits.find((h) => h.noteId === a.id)?.score || 0;
                    const sb = gsHits.find((h) => h.noteId === b.id)?.score || 0;
                    return sb - sa;
                  })
                  .slice(0, 4)
                  .map((n) => ({ id: n.id, title: n.title, body: n.body }));
                const lines = enrichFlashLines({
                  baseLines,
                  scoreline: `${homeName} ${scoreRef.current.home}–${scoreRef.current.away} ${awayName}`,
                  relevantNotes: relevantSnips,
                  statistics: statisticsRef.current,
                }).slice(0, 10);
                const goalPopup = {
                  kind: "goal" as const,
                  title: `GOAL ${e.minute}'`,
                  subtitle: scorer?.name || scorerName || undefined,
                  lines: [...new Set(lines)].slice(0, 10),
                  scoreline: `${homeName} ${scoreRef.current.home}–${scoreRef.current.away} ${awayName}`,
                };
                lastGoalPopupRef.current = goalPopup;
                pushPopup(goalPopup);
                // Live data-viz flash on goal — rotate shot map / timeline / xG
                window.setTimeout(() => {
                  const idGuess = `${key}|`;
                  setLivePopups((prev) => {
                    const hit = [...prev].reverse().find((p) =>
                      p.id.startsWith(idGuess) && p.kind === "goal"
                    );
                    if (hit) void attachVizToPopup(hit.id, "shot_map", "goal");
                    return prev;
                  });
                }, 50);
              } else if (/^sub$/i.test(e.type || "")) {
                const { outName, inName } = parseSubDescription(
                  e.description || ""
                );
                const onP =
                  squadRef.current.find((p) =>
                    namesLooselyMatch(p.name, inName)
                  ) || null;
                const offP =
                  squadRef.current.find((p) =>
                    namesLooselyMatch(p.name, outName)
                  ) || null;
                const seasonBits = onP
                  ? [
                      onP.appearances != null
                        ? `${onP.appearances} season apps`
                        : null,
                      onP.goals != null ? `${onP.goals} season goals` : null,
                      onP.assists != null
                        ? `${onP.assists} season assists`
                        : null,
                    ].filter(Boolean)
                  : [];
                const lines = [
                  onP || inName ? `ON: ${onP?.name || inName}` : null,
                  offP || outName ? `OFF: ${offP?.name || outName}` : null,
                  ...seasonBits,
                  e.description,
                ].filter(Boolean) as string[];
                pushPopup({
                  kind: "sub",
                  title: `SUB ${e.minute}'`,
                  subtitle: onP?.name || inName || undefined,
                  lines: [...new Set(lines)].slice(0, 6),
                });
              } else if (/var|penalty_miss|red|yellow/i.test(e.type || "")) {
                const relevantSnips = notesRef.current
                  .filter((n) => relevantNoteIdsRef.current.includes(n.id))
                  .slice(0, 2)
                  .map((n) => ({ id: n.id, title: n.title, body: n.body }));
                const cardPopup = {
                  kind: "fact" as const,
                  title: `${(e.type || "Event")
                    .replace(/_/g, " ")
                    .toUpperCase()} ${e.minute}'`,
                  lines: enrichFlashLines({
                    baseLines: [e.description].filter(Boolean),
                    scoreline: `${homeName} ${scoreRef.current.home}–${scoreRef.current.away} ${awayName}`,
                    relevantNotes: relevantSnips,
                    statistics: statisticsRef.current,
                  }).slice(0, 8),
                };
                pushPopup(cardPopup);
                if (/red|yellow/i.test(e.type || "")) {
                  window.setTimeout(() => {
                    const idGuess = `${key}|`;
                    setLivePopups((prev) => {
                      const hit = [...prev].reverse().find((p) =>
                        p.id.startsWith(idGuess) && p.kind === "fact"
                      );
                      if (hit) void attachVizToPopup(hit.id, "card_timeline", "card");
                      return prev;
                    });
                  }, 50);
                }
              }
            }
          }

          // Threshold / momentum flashes from AF fixture players + team stats
          try {
            const liveStats = (json.livePlayerStats || []) as LivePlayerStatRow[];
            livePlayerStatsRef.current = liveStats;
            const fired = firedStatTriggersRef.current;
            const thr = evaluatePlayerThresholds(liveStats, fired);
            const mom = evaluateMomentumProxy({
              statistics: statisticsRef.current,
              possessionSamples: possessionSamplesRef.current,
              fired,
              homeName,
              awayName,
            });
            const priority: Record<string, number> = {
              shotsOn: 10,
              keyPasses: 9,
              saves: 8,
              possessionSwing: 7,
              shotDiff: 7,
              dribblesSuccess: 6,
              tackles: 5,
              duelsWon: 4,
              foulsCommitted: 3,
            };
            const flashes = [...thr, ...mom].sort(
              (a, b) => (priority[b.stat] || 0) - (priority[a.stat] || 0)
            );
            for (const fl of flashes.slice(0, 4)) {
              const id = `${fl.id}|${Date.now()}`;
              pushLivePopup(
                {
                  id,
                  kind: "fact" as const,
                  title: fl.title,
                  lines: fl.lines.slice(0, 6),
                  scoreline: `${homeName} ${scoreRef.current.home}–${scoreRef.current.away} ${awayName}`,
                },
                12_000
              );
              window.setTimeout(() => {
                void attachVizToPopup(
                  id,
                  fl.vizHint || null,
                  fl.stat || "default",
                  { focusStat: fl.focusStat || fl.stat }
                );
              }, 80);
            }

            // FT preview: once per desk session, attach a rich viz sample so Chris
            // can see the library without waiting for a live goal/HT.
            if (
              (status === "Full Time" || status === "Finished") &&
              !ftVizPreviewRef.current
            ) {
              ftVizPreviewRef.current = true;
              const id = `ft-viz|${Date.now()}`;
              pushLivePopup(
                {
                  id,
                  kind: "fact" as const,
                  title: "Full-time",
                  lines: [
                    `${homeName} ${scoreRef.current.home}–${scoreRef.current.away} ${awayName}`,
                    "Sample chart from available team stats",
                  ],
                  scoreline: `${homeName} ${scoreRef.current.home}–${scoreRef.current.away} ${awayName}`,
                },
                18_000
              );
              window.setTimeout(() => {
                void attachVizToPopup(id, "match_dna", "ht");
              }, 100);
            }
          } catch {
            /* soft-fail triggers */
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
        setMsg("Sync failed — will retry");
        setPollError("network");
      } finally {
        setBusy(false);
      }
    },
    [apiFootballFixtureId, matchId, router, loadSuggestions, loadRelevantNotes, homeName, awayName, attachVizToPopup, pushLivePopup, homeClubId, awayClubId, status]
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

  // AF diet: Live/HT 45s, pre-match assigned 90s; pause when tab hidden.
  useEffect(() => {
    if (!configured || !apiFootballFixtureId) return;
    if (status === "Full Time" || status === "Finished") return;
    const intervalMs =
      status === "Live" || status === "Half Time" ? 45_000 : 90_000;
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      void sync(true);
    };
    const t = setInterval(tick, intervalMs);
    const onVis = () => {
      if (document.visibilityState === "visible") void sync(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [configured, apiFootballFixtureId, status, sync]);

  // Full Time: one-shot sync so threshold flashes can verify from final AF player stats
  useEffect(() => {
    if (!configured || !apiFootballFixtureId || status !== "Full Time") return;
    const t = window.setTimeout(() => sync(true), 800);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, apiFootballFixtureId, status]);


  // Relevant notes: initial + throttled refresh while LIVE (not every poll)
  useEffect(() => {
    if (status !== "Live") return;
    void loadRelevantNotes(undefined, { force: true });
    const t = setInterval(() => {
      void loadRelevantNotes(undefined, { force: false });
    }, 90_000);
    return () => clearInterval(t);
  }, [status, loadRelevantNotes]);

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

  async function onFreePlace(args: {
    side: "home" | "away";
    playerId: string;
    pitchX: number;
    pitchY: number;
  }) {
    const player = squad.find((p) => p.id === args.playerId);
    if (!player) return;
    if (player.side !== args.side) {
      setMsg("Players can only be placed on their own team half.");
      return;
    }
    await lineupAction({
      action: "freePlace",
      playerId: args.playerId,
      formationSlot: player.formationSlot,
      pitchX: args.pitchX,
      pitchY: args.pitchY,
    });
    // Optimistic local override so coords stick before refresh
    setOverrides((prev) => {
      const others = prev.filter((o) => o.playerId !== args.playerId);
      const existing = prev.find((o) => o.playerId === args.playerId);
      return [
        ...others,
        {
          playerId: args.playerId,
          displayName: existing?.displayName ?? null,
          pronunciation: existing?.pronunciation ?? null,
          pitchFlag: existing?.pitchFlag ?? null,
          jerseyNumber: existing?.jerseyNumber ?? null,
          formationSlot: player.formationSlot,
          pitchX: args.pitchX,
          pitchY: args.pitchY,
        },
      ];
    });
    setPlacing(null);
  }

  async function resetPlacements() {
    setBusy(true);
    try {
      await fetch(`/api/matches/${matchId}/overrides`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearPlacements: true }),
      });
      setOverrides((prev) =>
        prev
          .map((o) => ({
            ...o,
            formationSlot: null,
            pitchX: null,
            pitchY: null,
          }))
          .filter(
            (o) =>
              o.displayName ||
              o.pronunciation ||
              o.pitchFlag ||
              o.jerseyNumber != null
          )
      );
      // Re-sync official XI without wiping again
      await sync(false);
    } finally {
      setBusy(false);
    }
  }

  const hasCustomPlacements = useMemo(
    () => overrides.some((o) => hasManualPlacement(o)),
    [overrides]
  );

  function onSquadClick(p: SquadPlayer) {
    setPlacing(p);
    setSelected(null);
  }

  function openPlayer(p: PitchPlayer | SquadPlayer) {
    if (placing) return;
    const full = squad.find((s) => s.id === p.id);
    if (full) setSelected(full);
    setDossierId(p.id);
    // No Players bucket — roll into home/away; entity scope still filters to player
    const side = homePlayers.some((h) => h.id === p.id)
      ? "home"
      : awayPlayers.some((a) => a.id === p.id)
        ? "away"
        : null;
    if (side === "home") setNotesFilter("home");
    else if (side === "away") setNotesFilter("away");
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
  const shotsOnTarget = statistics.find((s) =>
    /shots on (goal|target)/i.test(s.label)
  );
  const corners = statistics.find((s) => /corner/i.test(s.label));
  const fouls = statistics.find((s) => /^fouls$/i.test(s.label) || /fouls committed/i.test(s.label));
  const penalties = events.filter((e) =>
    ["penalty_goal", "penalty_miss"].includes(e.type)
  );


  // Half-time data-viz flash (once per HT spell)
  // AF maps HT→status Live; period/clock still indicate HT
  const isHalfTime =
    status === "Half Time" ||
    periodProp === "HT" ||
    formatLiveClock(minute, minuteExtra, { status }) === "HT";
  useEffect(() => {
    if (!isHalfTime) {
      if (status === "Live" || status === "Not Started") htVizEmittedRef.current = false;
      return;
    }
    if (htVizEmittedRef.current) return;
    htVizEmittedRef.current = true;
    const id = `ht-viz|${Date.now()}`;
    pushLivePopup(
      {
        id,
        kind: "fact" as const,
        title: "Half-time",
        lines: [
          `${homeName} ${homeScore}–${awayScore} ${awayName}`,
          "xG race / possession when available",
        ],
        scoreline: `${homeName} ${homeScore}–${awayScore} ${awayName}`,
      },
      16_000
    );
    window.setTimeout(() => void attachVizToPopup(id, "xg_race", "ht"), 100);
  }, [isHalfTime, status, homeName, awayName, homeScore, awayScore, attachVizToPopup, pushLivePopup]);

  // Periodic moment flash only when fingerprint changes (not spam)
  useEffect(() => {
    if (status !== "Live") return;
    const last = events[events.length - 1];
    const fp = momentFingerprint({
      scoreHome: homeScore,
      scoreAway: awayScore,
      lastEventKey: last
        ? `${last.minute}|${last.type}|${last.description}`
        : null,
      onTargetHome: shotsOnTarget?.homeValue ?? null,
      onTargetAway: shotsOnTarget?.awayValue ?? null,
    });
    if (!shouldEmitMomentFlash(momentFpRef.current, fp)) return;
    const prev = momentFpRef.current;
    momentFpRef.current = fp;
    if (prev == null) return;
    const relevantSnips = notesRef.current
      .filter((n) => relevantNoteIdsRef.current.includes(n.id))
      .slice(0, 2)
      .map((n) => ({ id: n.id, title: n.title, body: n.body }));
    const lines = enrichFlashLines({
      baseLines: last
        ? [`${last.minute}' ${last.description}`]
        : [`Score now ${homeName} ${homeScore}–${awayScore} ${awayName}`],
      scoreline: `${homeName} ${homeScore}–${awayScore} ${awayName}`,
      relevantNotes: relevantSnips,
      statistics: statisticsRef.current,
    });
    const id = `moment|${Date.now()}`;
    // status is Live here — detect HT-ish minute window as momentum beat
    const isHt =
      typeof last?.minute === "number" && last.minute >= 45 && last.minute <= 46;
    pushLivePopup(
      {
        id,
        kind: "fact" as const,
        title: isHt ? "Half-time" : "Moment",
        lines: lines.slice(0, 6),
        scoreline: `${homeName} ${homeScore}–${awayScore} ${awayName}`,
      },
      10_000
    );
    // Rotate viz: HT chain vs moment chain (soft-fail + dedupe recent kinds)
    window.setTimeout(() => {
      void attachVizToPopup(
        id,
        isHt ? "xg_race" : "possession",
        isHt ? "ht" : "moment"
      );
    }, 80);
  }, [
    status,
    homeScore,
    awayScore,
    events,
    shotsOnTarget,
    homeName,
    awayName,
    attachVizToPopup,
    pushLivePopup,
  ]);


  const homeLogoUrl = homeTeamAfId
    ? `https://media.api-sports.io/football/teams/${homeTeamAfId}.png`
    : null;
  const awayLogoUrl = awayTeamAfId
    ? `https://media.api-sports.io/football/teams/${awayTeamAfId}.png`
    : null;
  const leagueAfId = leagueIdForCompetition(competition);
  const leagueLogoUrl = leagueAfId
    ? `https://media.api-sports.io/football/leagues/${leagueAfId}.png`
    : null;

    const deskNotes = useMemo(() => {
    if (dossierId) {
      return notes.filter((n) => n.entityId === dossierId);
    }
    return notes;
  }, [notes, dossierId]);

  // Scan / On-air only — do not enter investigate weighting when a dossier opens
  // (pass-2 investigate mode overrode dossier position:fixed → broken click flow).
  const deskMode = onAirMode ? "onair" : "scan";

  return (
    <div
      ref={deskRootRef}
      data-desk-mode={deskMode}
      className={cn(
        "relative flex flex-col gap-1.5 overflow-hidden bg-[var(--background)] text-[var(--foreground)]",
        deskMode === "onair" && "onair-desk",
        deskMode === "scan" && "scan-desk",
        isFullscreen
          ? "h-[calc(100dvh-8.5rem)] max-h-[100dvh] min-h-0 p-1.5"
          : "h-[calc(100dvh-11rem)] max-h-[100dvh] min-h-[380px]"
      )}
    >
      {/* Slim top bar — score / meta / stats / actions · broadcast desk chrome */}
      <header className="desk-header shrink-0 flex flex-wrap items-center gap-x-2 gap-y-0.5 px-2 py-1" data-desk-chrome="1">
        {isFullscreen ? (
          <nav className="flex w-full flex-wrap items-center gap-1 border-b border-white/10 pb-1 mb-0.5" aria-label="Match sections">
            {[
              ["", "Desk"],
              ["packs", "Research"],
              ["scripts", "Scripts"],
              ["notes", "Notes"],
              ["league", "League"],
              ["news", "News"],
              ["stats", "Stats"],
            ].map(([slug, label]) => (
              <Link
                key={slug || "desk"}
                href={slug ? `/match-day/${matchId}/${slug}` : `/match-day/${matchId}`}
                className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-300 hover:bg-white/10 hover:text-white"
              >
                {label}
              </Link>
            ))}
          </nav>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
            <span className="font-semibold text-[12px] truncate tracking-tight text-slate-200">
              {homeName}{" "}
              <span className="text-slate-500 font-normal">vs</span>{" "}
              {awayName}
            </span>
            {(status === "Live" || status === "Full Time" || homeScore > 0 || awayScore > 0) && (
              <span
                className={cn(
                  "font-black tabular-nums text-[12px] tracking-tight",
                  status === "Live" ? "text-[var(--live)]" : "text-slate-100"
                )}
              >
                {status === "Live" && clockLabel ? `${clockLabel} ` : ""}
                {homeScore}–{awayScore}
              </span>
            )}
            <span className="text-[9px] font-medium text-slate-500 truncate tracking-[0.02em]">
              {competition} · {kickoffLabel} · {status}
            </span>
          </div>
          <div className="text-[9px] text-slate-500/90 truncate flex flex-wrap items-center gap-x-1.5 gap-y-0">
            {(venueName || venueCity) && (
              <span className="inline-flex items-center gap-0.5">
                <MapPin className="h-3 w-3 shrink-0" />
                {deskVenueName(venueName) || venueName || "Venue"}
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
            {shotsOnTarget && (
              <span className="tabular-nums">
                On target {shotsOnTarget.homeValue}–{shotsOnTarget.awayValue}
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
              className="desk-btn"
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
                <div className="absolute right-0 top-full mt-1 z-40 w-56 rounded-lg border border-slate-200 dark:border-slate-700 bg-[var(--surface)] shadow-lg p-2 text-[11px]">
                  <div className="font-semibold text-slate-500 uppercase tracking-wide px-1 mb-1">
                    Match intel
                  </div>
                  <Link
                    href={`/match-day/${matchId}/stats`}
                    className="block rounded-md px-2 py-1.5 hover:bg-[var(--surface-muted)] font-semibold text-teal-700 dark:text-teal-300"
                    onClick={() => setIntelOpen(false)}
                  >
                    Match Statistics
                  </Link>
                  <Link
                    href={`/match-day/${matchId}/league`}
                    className="block rounded-md px-2 py-1.5 hover:bg-[var(--surface-muted)] font-semibold text-teal-700 dark:text-teal-300"
                    onClick={() => setIntelOpen(false)}
                  >
                    League table & fixtures
                  </Link>
                  <Link
                    href={`/match-day/${matchId}/scorers`}
                    className="block rounded-md px-2 py-1.5 hover:bg-[var(--surface-muted)]"
                    onClick={() => setIntelOpen(false)}
                  >
                    Scorers {scorers.length ? `(${scorers.length})` : ""}
                  </Link>
                  <Link
                    href={`/match-day/${matchId}/keepers`}
                    className="block rounded-md px-2 py-1.5 hover:bg-[var(--surface-muted)]"
                    onClick={() => setIntelOpen(false)}
                  >
                    Keepers {keepers.length ? `(${keepers.length})` : ""}
                  </Link>
                  <Link
                    href={`/match-day/${matchId}/penalties`}
                    className="block rounded-md px-2 py-1.5 hover:bg-[var(--surface-muted)]"
                    onClick={() => setIntelOpen(false)}
                  >
                    Penalties {penalties.length ? `(${penalties.length})` : ""}
                  </Link>
                  <Link
                    href={`/match-day/${matchId}/injuries`}
                    className="block rounded-md px-2 py-1.5 hover:bg-[var(--surface-muted)]"
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

          {livePopups.length > 0 ? (
            <button
              type="button"
              className="desk-btn border-amber-400/50 text-amber-100"
              onClick={() => clearAllLivePopups()}
              title="Force-dismiss all live intel flashes (Esc)"
            >
              <X className="h-3 w-3" />
              Clear
              <span className="tabular-nums text-amber-300/80">{livePopups.length}</span>
            </button>
          ) : null}

          <div className="relative">
            <button
              type="button"
              className={cn(
                "desk-btn",
                intelHistoryOpen && "border-amber-400/70 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
              )}
              onClick={() => setIntelHistoryOpen((v) => !v)}
              aria-expanded={intelHistoryOpen}
              title="Live intel history — reopen dismissed flashes"
            >
              <History className="h-3 w-3" />
              History
              {intelHistory.length > 0 ? (
                <span className="tabular-nums text-slate-500">
                  {intelHistory.length}
                </span>
              ) : null}
            </button>
            {intelHistoryOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-30 cursor-default"
                  aria-label="Close history"
                  onClick={() => setIntelHistoryOpen(false)}
                />
                <div
                  className="absolute right-0 top-full mt-1 z-40 w-[min(92vw,22rem)] max-h-[min(70vh,28rem)] overflow-y-auto rounded-[2px] border border-white/10 bg-[#10141a] p-2 shadow-lg"
                  role="list"
                  aria-label="Live intel history"
                >
                  <div className="sticky top-0 mb-1 flex items-center justify-between gap-2 border-b border-white/[0.06] bg-[#10141a] px-1 pb-1">
                    <div className="live-flash-meta">
                      Live intel history
                    </div>
                    <span className="live-flash-time">
                      {intelHistory.length}/{INTEL_HISTORY_CAP}
                    </span>
                  </div>
                  {intelHistory.length === 0 ? (
                    <p className="px-2 py-3 text-[11px] text-slate-500">
                      Dismissed goals, facts, and viz flashes land here for this
                      match session. Tap one to reopen.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {intelHistory.map((item) => {
                        const titleU = `${item.title} ${item.subtitle || ""}`.toUpperCase();
                        const histTier =
                          item.kind === "goal"
                            ? "live-flash-goal"
                            : item.kind === "sub"
                              ? "live-flash-sub"
                              : /\bRED\b|VAR/.test(titleU)
                                ? "live-flash-red"
                                : /YELLOW|CARD/.test(titleU)
                                  ? "live-flash-card"
                                  : /INJUR|STRETCHER/.test(titleU)
                                    ? "live-flash-injury"
                                    : "live-flash-fact";
                        const minMatch = item.title.match(/(\d{1,3})\s*['′]/);
                        const histTime = minMatch
                          ? `${minMatch[1]}'`
                          : new Date(item.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            });
                        return (
                        <li key={item.id}>
                          <button
                            type="button"
                            role="listitem"
                            className={cn(
                              "live-flash-history w-full px-2.5 py-1.5 text-left transition-colors",
                              histTier
                            )}
                            onClick={() => reopenIntelHistory(item)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="live-flash-meta">
                                {item.kind === "goal"
                                  ? "Goal"
                                  : item.kind === "sub"
                                    ? "Sub"
                                    : "Live"}
                                {item.scoreline ? ` · ${item.scoreline}` : ""}
                              </span>
                              <span className="live-flash-time shrink-0">{histTime}</span>
                            </div>
                            <div className="live-flash-headline mt-0.5 line-clamp-2 text-[12px]">
                              {item.title}
                              {item.subtitle ? (
                                <span className="ml-1.5 text-[0.85em] font-bold text-slate-300">
                                  {item.subtitle}
                                </span>
                              ) : null}
                            </div>
                            {item.viz ? (
                              <span className="live-flash-chip mt-1">Advanced stats</span>
                            ) : null}
                            {item.lines[0] ? (
                              <div className="live-flash-body mt-0.5 line-clamp-2">
                                {item.lines[0]}
                              </div>
                            ) : null}
                          </button>
                        </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            className={cn(
              "desk-btn desk-btn-live",
              onAirMode && "is-active",
              !onAirMode && onAirOpen && "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
            )}
            aria-pressed={onAirMode}
            onClick={() => setOnAirMode((v) => !v)}
            onContextMenu={(e) => {
              e.preventDefault();
              setOnAirOpen((v) => !v);
            }}
            title="On-air mode (O) · right-click events drawer"
          >
            <Radio className={cn("h-3 w-3", !onAirMode && "text-[var(--live)]")} />
            {onAirMode ? "On-air ON" : "On-air"}
            <span className={cn("tabular-nums", onAirMode ? "text-white/80" : "text-slate-500")}>{events.length}</span>
          </button>
          <button
            type="button"
            className="desk-btn px-1.5"
            onClick={() => setHotkeyHelpOpen(true)}
            title="Hotkeys (?)"
          >
            ?
          </button>

          <Link
            href={`/match-day/${matchId}/packs`}
            className="desk-btn desk-btn-accent"
          >
            <Sparkles className="h-3 w-3" />
            Research{packCount ? ` (${packCount})` : ""}
          </Link>
          {!apiFootballFixtureId && (
            <Link
              href={`/match-day/${matchId}/prep`}
              className="desk-btn"
            >
              <Link2 className="h-3 w-3" /> Link
            </Link>
          )}
          <button
            type="button"
            className="desk-btn"
            onClick={() => openFieldSettings("player")}
            title="Field Settings · Pitch Card"
          >
            <SlidersHorizontal className="h-3 w-3" />
            Field
          </button>
          <button
            type="button"
            className="desk-btn"
            onClick={() => void toggleFullscreen()}
            title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen desk"}
            aria-pressed={isFullscreen}
          >
            {isFullscreen ? (
              <Minimize2 className="h-3 w-3" />
            ) : (
              <Maximize2 className="h-3 w-3" />
            )}
            {isFullscreen ? "Exit" : "Full"}
          </button>
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

      <DeskLiveExtras
        matchId={matchId}
        status={status}
        events={events.map((e) => ({
          id: e.id,
          type: e.type,
          minute: e.minute,
          description: e.description,
          team: e.teamSide,
          playerId: e.playerId,
        }))}
        squad={squad.map((p) => ({
          id: p.id,
          name: p.name,
          shirtNumber: p.shirtNumber,
          side: p.side,
          team: p.team,
        }))}
        homeName={homeName}
        awayName={awayName}
        homeScore={homeScore}
        awayScore={awayScore}
        h2hSummary={h2hSummary}
        apiFootballFixtureId={apiFootballFixtureId}
        lastFeedSyncAt={lastFeedSyncAt}
        pollError={pollError}
        onAirMode={onAirMode}
        relevantNotes={notes
          .filter((n) => relevantNoteIds.includes(n.id))
          .map((n) => ({ id: n.id, title: n.title, body: n.body }))}
        clockLabel={clockLabel}
        helpOpen={hotkeyHelpOpen}
        onCloseHelp={() => setHotkeyHelpOpen(false)}
        onExpandNotes={() => {
          setOnAirMode(false);
          setNotesFilter("relevant");
        }}
        onOpenEvents={() => setOnAirOpen(true)}
        onPlayerClick={(pid) => {
          const p = squad.find((s) => s.id === pid);
          if (p) openPlayer(p);
        }}
      />

      {!onAirMode && (scorers.length > 0 || venueCapacity || attendance) ? (
        <StatsStoryStrip
          scorers={scorers}
          attendance={attendance}
          venueCapacity={venueCapacity}
          homeName={homeName}
          awayName={awayName}
          className="mx-0.5"
        />
      ) : null}

      {/* Flash toast — overlay, not a permanent band */}
      {flash && (
        <div className="pointer-events-none absolute left-1/2 top-12 z-50 -translate-x-1/2 max-w-[min(90%,36rem)] rounded-[var(--radius-sm)] border border-amber-400/60 bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-amber-950 dark:text-amber-100 shadow-md live-flash-fact">
          {flash}
        </div>
      )}

      {/* Live intel popups — interrupt then settle; severity via left edge only */}
      {livePopups.length > 0 && (
        <div className="absolute left-1/2 top-12 z-[60] flex w-[min(94%,26rem)] -translate-x-1/2 flex-col gap-2">
          {livePopups.map((popup) => {
            const titleU = `${popup.title} ${popup.subtitle || ""}`.toUpperCase();
            const flashTier =
              popup.kind === "goal"
                ? "live-flash-goal"
                : popup.kind === "sub"
                  ? "live-flash-sub"
                  : /\bRED\b|VAR/.test(titleU)
                    ? "live-flash-red"
                    : /YELLOW|CARD/.test(titleU)
                      ? "live-flash-card"
                      : /INJUR|STRETCHER/.test(titleU)
                        ? "live-flash-injury"
                        : "live-flash-fact";
            const minMatch = popup.title.match(/(\d{1,3})\s*['′]/);
            const flashMinute = minMatch
              ? `${minMatch[1]}'`
              : liveMinute > 0
                ? `${liveMinute}'`
                : new Date(popup.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
            return (
            <div
              key={popup.id}
              role="dialog"
              aria-label={popup.title}
              className={cn(
                "live-flash px-2.5 py-1.5 text-left",
                flashTier,
                popup.pinned && "is-pinned"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="live-flash-meta min-w-0 truncate">
                  {popup.kind === "goal"
                    ? "Goal"
                    : popup.kind === "sub"
                      ? "Sub"
                      : "Live"}
                  {popup.pinned ? " · pinned" : ""}
                  {popup.scoreline ? ` · ${popup.scoreline}` : ""}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="live-flash-time">{flashMinute}</span>
                  <button
                    type="button"
                    className="live-flash-chrome rounded p-1.5"
                    title={popup.pinned ? "Unpin" : "Pin (keep open)"}
                    onClick={() =>
                      setLivePopups((prev) =>
                        prev.map((p) =>
                          p.id === popup.id ? { ...p, pinned: !p.pinned } : p
                        )
                      )
                    }
                  >
                    <Pin
                      className={cn(
                        "h-3 w-3",
                        popup.pinned && "fill-amber-400/80 text-amber-400"
                      )}
                    />
                  </button>
                  <button
                    type="button"
                    className="live-flash-chrome rounded p-1.5 text-slate-200 hover:text-rose-300"
                    title="Dismiss"
                    onClick={() =>
                      dismissLivePopup(popup.id, { force: true })
                    }
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-0.5 flex items-start justify-between gap-2">
                <div className="live-flash-headline min-w-0">
                  {popup.title}
                  {popup.subtitle ? (
                    <span className="ml-1.5 text-[0.8em] font-bold text-slate-300">
                      {popup.subtitle}
                    </span>
                  ) : null}
                </div>
                {popup.viz ? (
                  <span className="live-flash-chip shrink-0">Advanced stats</span>
                ) : null}
              </div>
              {popup.lines.length > 0 ? (
                <ul className="live-flash-body mt-1 space-y-0.5">
                  {popup.lines.map((line, i) => (
                    <li key={i} className="leading-snug">
                      {line}
                    </li>
                  ))}
                </ul>
              ) : null}
              {popup.viz ? (
                <div className="live-flash-viz">
                  <DataVizFlashCard
                    kind={popup.viz.kind}
                    shots={popup.viz.shots}
                    homeXg={popup.viz.homeXg}
                    awayXg={popup.viz.awayXg}
                    homeGoals={popup.viz.homeGoals}
                    awayGoals={popup.viz.awayGoals}
                    homeName={homeName}
                    awayName={awayName}
                    homeColor={homeColor}
                    awayColor={awayColor}
                    possessionSamples={popup.viz.possessionSamples}
                    compare={popup.viz.compare}
                    compareTitle={popup.viz.compareTitle}
                    dna={popup.viz.dna}
                    leaderboard={popup.viz.leaderboard}
                    leaderboardTitle={popup.viz.leaderboardTitle}
                    gkName={popup.viz.gkName}
                    gkSaves={popup.viz.gkSaves}
                    gkSide={popup.viz.gkSide}
                    timelineEvents={popup.viz.timelineEvents}
                    timelineTitle={popup.viz.timelineTitle}
                    momentumSamples={popup.viz.momentumSamples}
                  />
                </div>
              ) : null}
            </div>
            );
          })}
        </div>
      )}

      {/* Placing toast */}
      {placing && (
        <div className="pointer-events-none absolute left-1/2 top-12 z-40 -translate-x-1/2 flex flex-wrap items-center gap-2 rounded-lg border border-sky-300 bg-sky-50/95 dark:bg-sky-950/95 dark:border-sky-800 px-3 py-1.5 text-xs shadow-lg [&>button]:pointer-events-auto">
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
      <div
        className={cn(
          "relative min-h-0 flex-1 grid grid-cols-1 gap-1.5 overflow-hidden",
          onAirMode
            ? "lg:grid-cols-[minmax(0,1fr)]"
            : hideSquadRail
              ? "lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)]"
              : "lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)_minmax(180px,200px)]"
        )}
      >
        {!onAirMode && (
        <aside
          data-desk-rail="notes"
          className="min-h-0 overflow-hidden order-2 lg:order-1"
        >
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
            homeName={homeName}
            awayName={awayName}
            matchStatus={status}
            kickoffAt={kickoffAt}
            externalFilter={notesFilter}
            onFilterChange={setNotesFilter}
            fillHeight
            liveMode={isLive || status === "Full Time"}
            hideComposer
            playerNameById={Object.fromEntries(squad.map((p) => [p.id, p.name]))}
            onNotePlayerClick={(playerId) => {
              const p = squad.find((s) => s.id === playerId);
              if (p) openPlayer(p);
            }}
            relevantNoteIds={relevantNoteIds}
            relevantLoading={relevantLoading}
          />
        </aside>
        )}

        <section
          data-desk-primary="pitch"
          className="relative min-h-0 flex flex-col overflow-hidden order-1 lg:order-2 onair-primary"
        >
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
              refereeNationality={refereeNationality}
              lineupStatus={lineupStatus}
              onPlayerClick={openPlayer}
              onSlotDrop={onSlotDrop}
              onSlotClick={onSlotClick}
              onClearSlot={onClearSlot}
              placingPlayerId={placing?.id}
              placingSide={placing?.side}
              selectedPlayerId={dossierId || selected?.id || null}
              locked={false}
              compact
              formationOptions={Object.keys(FORMATIONS)}
              homeSubWindows={summarizeSubWindows(events, "home")}
              awaySubWindows={summarizeSubWindows(events, "away")}
              onFormationChange={changeFormation}
              formationBusy={busy}
              lineupHintText={
                starterCount === 0
                  ? "Empty pitch — Sync, then click player → slot"
                  : lineupHint(lineupStatus)
              }
              onResetOfficial={
                lineupStatus === "confirmed" && apiFootballFixtureId
                  ? () => {
                      void (async () => {
                        setBusy(true);
                        try {
                          await fetch(`/api/matches/${matchId}/sync`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ resetPlacements: true, mode: "full" }),
                          });
                          setOverrides((prev) =>
                            prev
                              .map((o) => ({
                                ...o,
                                formationSlot: null,
                                pitchX: null,
                                pitchY: null,
                              }))
                              .filter(
                                (o) =>
                                  o.displayName ||
                                  o.pronunciation ||
                                  o.pitchFlag ||
                                  o.jerseyNumber != null
                              )
                          );
                          router.refresh();
                        } finally {
                          setBusy(false);
                        }
                      })();
                    }
                  : undefined
              }
              onFreePlace={onFreePlace}
              hasCustomPlacements={hasCustomPlacements}
              onResetPlacements={
                hasCustomPlacements ? () => void resetPlacements() : undefined
              }
              onCoachClick={(side) => setCoachSide(side)}
              homeScore={homeScore}
              awayScore={awayScore}
              minute={liveMinute}
              minuteExtra={liveMinuteExtra}
              matchStatus={status}
              homeAbbr={homeAbbr || homeName}
              awayAbbr={awayAbbr || awayName}
              homeLogoUrl={homeLogoUrl}
              awayLogoUrl={awayLogoUrl}
              leagueLogoUrl={leagueLogoUrl}
              onHomeLogoClick={() => {
                if (homeClubId) setClubDossierId(homeClubId);
                else setNotesFilter("home");
              }}
              onAwayLogoClick={() => {
                if (awayClubId) setClubDossierId(awayClubId);
                else setNotesFilter("away");
              }}
              onLeagueLogoClick={() => setNotesFilter("league")}
              cardSettings={fieldSettings}
              markerPct={markerPct}
              onOpenFieldSettings={openFieldSettings}
              homeOnLeft={homeOnLeft}
              onToggleHomeOnLeft={toggleHomeOnLeft}
              liveCompact={isLive}
              onAirMode={onAirMode}
            />
          </div>

          {/* On-air drawer — overlays pitch, does not steal permanent height */}
          {onAirOpen && (
            <div className="absolute inset-x-0 bottom-0 z-30 max-h-[min(28%,168px)] rounded-t-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] shadow-lg overflow-hidden flex flex-col">
              <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border)] bg-[var(--surface-muted)]">
                <Radio className="h-3.5 w-3.5 text-[var(--live)]" />
                <span className="text-desk-label">On-air</span>
                <span className="text-[10px] text-slate-500">
                  {events.length} events
                  {status === "Live" && clockLabel ? ` · ${clockLabel}` : ""}
                </span>
                <button
                  type="button"
                  className="ml-auto text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  onClick={() => setOnAirOpen(false)}
                >
                  Close
                </button>
              </div>
              <div className="min-h-0 flex-1 grid md:grid-cols-3 gap-2 p-2 overflow-hidden">
                <div className="min-h-0 overflow-hidden flex flex-col">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 px-1 mb-1">
                    Timeline
                  </div>
                  <EventTimeline
                    events={events}
                    highlightIds={flashEventIds}
                    compact
                    maxHeightClass="max-h-[120px]"
                  />
                </div>
                <div className="min-h-0 overflow-y-auto space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 px-1">
                    Suggestions
                  </div>
                  {suggestions.filter((s) => !dismissedSuggestions.includes(s.id))
                    .length === 0 ? (
                    <p className="text-[11px] text-slate-500 px-1">
                      Sync live events to pull note + AF stat chips here.
                    </p>
                  ) : (
                    suggestions
                      .filter((s) => !dismissedSuggestions.includes(s.id))
                      .map((s) => (
                        <div
                          key={s.id + s.text.slice(0, 24)}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-2 py-1.5"
                        >
                          <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wide text-slate-400 mb-0.5">
                            <span>{s.eventLabel}</span>
                            <span className="rounded bg-slate-200 dark:bg-slate-800 px-1 py-px normal-case">
                              {s.source === "af_stat" ? "AF" : "Note"}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-700 dark:text-slate-200 leading-snug">
                            {s.text}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <button
                              type="button"
                              className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-teal-700 dark:text-teal-300 hover:underline"
                              onClick={() => pinSuggestion(s)}
                            >
                              <Pin className="h-3 w-3" /> Pin
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center gap-0.5 text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                              onClick={() =>
                                setDismissedSuggestions((d) => [...d, s.id])
                              }
                            >
                              <X className="h-3 w-3" /> Dismiss
                            </button>
                          </div>
                        </div>
                      ))
                  )}
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

        {!hideSquadRail && !onAirMode && (
          <aside data-desk-rail="squad" className="min-h-0 overflow-hidden order-3">
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
        )}
      </div>

      
      {coachSide && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md shadow-lg border-l border-[var(--border)] bg-[var(--surface)] flex flex-col">
          <div className="shrink-0 flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Coach profile
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {(coachSide === "home" ? homeCoach : awayCoach)?.name || "Coach"}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {(coachSide === "home" ? homeFullName : awayFullName) ||
                  (coachSide === "home" ? homeName : awayName)}
                {(coachSide === "home" ? homeCoach : awayCoach)?.role
                  ? ` · ${(coachSide === "home" ? homeCoach : awayCoach)?.role}`
                  : " · Head Coach"}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                className="rounded-md border border-teal-200 dark:border-teal-900 bg-teal-50 dark:bg-teal-950/40 px-2 py-1 text-xs font-semibold text-teal-800 dark:text-teal-200"
                onClick={() => {
                  setCoachSide(null);
                  openFieldSettings("coach");
                }}
                title="Edit coach card chrome (Field Settings)"
              >
                Edit card
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs"
                onClick={() => setCoachSide(null)}
              >
                Close
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
            {(() => {
              const c = coachSide === "home" ? homeCoach : awayCoach;
              const coachId = c?.id || `${coachSide}-coach`;
              const coachName =
                c?.name ||
                (coachSide === "home"
                  ? homeFullName || homeName
                  : awayFullName || awayName) ||
                "Coach";
              const clubId =
                coachSide === "home" ? homeClubId : awayClubId;
              const clubName =
                coachSide === "home"
                  ? homeFullName || homeName
                  : awayFullName || awayName;
              const coachNotes = notes.filter((n) =>
                noteMatchesCoachCard(n, {
                  coachId,
                  coachName: c?.name || coachName,
                  side: coachSide,
                  clubId,
                  clubName,
                })
              );
              if (!c) {
                return (
                  <>
                    <p className="text-sm text-slate-500">
                      No coach staff row on file — showing Research manager notes
                      for this side when available.
                    </p>
                    {(() => {
                      const hook =
                        coachNotes.find(
                          (n) =>
                            /hook|scout|verdict|sayable|lead|manager/i.test(
                              n.title || ""
                            ) ||
                            /hook|scout|verdict|manager/i.test(n.category || "")
                        ) ||
                        coachNotes.find((n) => (n.body || "").trim()) ||
                        null;
                      if (!hook && !coachNotes.length) return null;
                      const line = hook
                        ? (hook.title || "").trim() ||
                          (hook.body || "").split("\n")[0].trim()
                        : coachName;
                      const sub = hook?.body
                        ? hook.body
                            .trim()
                            .split("\n")
                            .slice(hook.title ? 0 : 1, 2)
                            .join(" ")
                            .slice(0, 180)
                        : null;
                      return (
                        <VerdictBlock
                          line={line}
                          sub={sub}
                          fullBody={hook?.body || null}
                        />
                      );
                    })()}
                    <NotesPanel
                      matchId={matchId}
                      entityType="coach"
                      entityId={coachId}
                      entityLabel={coachName}
                      initialNotes={coachNotes}
                      fillHeight
                    />
                  </>
                );
              }
              return (
                <>
                  <div className="flex items-center gap-3">
                    <div
                      className="relative h-14 w-14 rounded-md overflow-hidden flex items-center justify-center text-white text-lg font-bold ring-1 ring-black/10"
                      style={{
                        backgroundColor:
                          coachSide === "home" ? homeColor : awayColor,
                      }}
                    >
                      {c.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.photoUrl}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover object-top"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : null}
                      <span className="relative z-0">
                        {(c.name || "?")
                          .split(" ")
                          .map((w) => w[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-base">{c.name}</div>
                      <div className="text-xs text-slate-500">
                        {c.nationality}
                        {c.age != null ? ` · ${c.age}y` : ""}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Factual club staff only — no invented bio.
                  </p>
                  {(() => {
                    const hook =
                      coachNotes.find(
                        (n) =>
                          /hook|scout|verdict|sayable|lead|manager/i.test(
                            n.title || ""
                          ) ||
                          /hook|scout|verdict|manager/i.test(n.category || "")
                      ) ||
                      coachNotes.find((n) => (n.body || "").trim()) ||
                      null;
                    const line = hook
                      ? (hook.title || "").trim() ||
                        (hook.body || "").split("\n")[0].trim()
                      : [
                          c.name,
                          c.nationality || null,
                          c.age != null ? `${c.age}y` : null,
                          c.role || "Head Coach",
                        ]
                          .filter(Boolean)
                          .join(" · ");
                    const sub = hook?.body
                      ? hook.body
                          .trim()
                          .split("\n")
                          .slice(hook.title ? 0 : 1, 2)
                          .join(" ")
                          .slice(0, 180)
                      : null;
                    return (
                      <VerdictBlock
                        line={line}
                        sub={sub}
                        fullBody={hook?.body || null}
                      />
                    );
                  })()}
                  <NotesPanel
                    matchId={matchId}
                    entityType="coach"
                    entityId={coachId}
                    entityLabel={c.name}
                    initialNotes={coachNotes}
                    fillHeight
                  />
                </>
              );
            })()}
          </div>
        </div>
      )}

{clubDossierId && (
        <ClubDossier
          matchId={matchId}
          clubId={clubDossierId}
          onClose={() => setClubDossierId(null)}
          onPlayerClick={(pid) => {
            setClubDossierId(null);
            setDossierId(pid);
          }}
        />
      )}

{dossierId && (
        <PlayerDossier
          matchId={matchId}
          playerId={dossierId}
          initialTab="overview"
          initialNotes={notes.filter((n) => n.entityId === dossierId)}
          playerName={squad.find((s) => s.id === dossierId)?.name}
          initialOverride={overrideById.get(dossierId) || null}
          onOverrideChange={(row) => applyOverride(row, dossierId)}
          onClose={() => {
            setDossierId(null);
            setSelected(null);
          }}
        />
      )}

      <FieldSettingsModal
        open={fieldSettingsOpen}
        onClose={() => setFieldSettingsOpen(false)}
        settings={fieldSettings}
        markerPct={markerPct}
        onChange={updateFieldSettings}
        isFullscreen={isFullscreen}
        initialTab={fieldSettingsTab}
      />
    </div>
  );

}
