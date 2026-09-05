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
} from "lucide-react";
import { PitchBoard, type PitchPlayer } from "@/components/match/pitch";
import { SquadRail, type SquadPlayer } from "@/components/match/squad-rail";
import {
  NotesPanel,
  type NoteRow,
  type NotesFilterScope,
} from "@/components/notes/notes-panel";
import { PlayerDossier } from "@/components/match/player-dossier";
import { FieldSettingsModal } from "@/components/match/field-settings-modal";
import { EventTimeline } from "@/components/match/event-timeline";
import { EventComposer } from "@/components/live/event-composer";
import { Button } from "@/components/ui/button";
import { FORMATIONS } from "@/lib/formations";
import { leagueIdForCompetition } from "@/lib/competitions";
import { namesLooselyMatch, parseSubDescription } from "@/lib/player-name";
import { cn } from "@/lib/utils";
import { formatLiveClock } from "@/lib/live-clock";
import { ordinal, seasonOrdinal } from "@/lib/season-tally";
import {
  type FieldSettings,
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
  return applyLiveSubsToXi(withMatchStats, events);
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
  competition,
  homeScore,
  awayScore,
  minute,
  minuteExtra = null,
  notes,
  injuryCount,
  predictionsAdvice,
  predictionsJson,
  h2hSummary,
  packCount,
  venueName,
  venueCity,
  venueCapacity,
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
  competition: string;
  homeScore: number;
  awayScore: number;
  minute: number;
  /** AF status.extra stoppage — null when feed omits it */
  minuteExtra?: number | null;
  notes: NoteRow[];
  injuryCount: number;
  predictionsAdvice: string | null;
  predictionsJson: string | null;
  h2hSummary: string | null;
  packCount: number;
  venueName?: string | null;
  venueCity?: string | null;
  venueCapacity?: number | null;
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
  };
  const [livePopups, setLivePopups] = useState<LivePopup[]>([]);
  const [coachSide, setCoachSide] = useState<"home" | "away" | null>(null);
  const seenEventKeysRef = useRef<Set<string>>(new Set());
  const [configured, setConfigured] = useState<boolean | null>(null);
  const locked = false;
  const [homeForm, setHomeForm] = useState(homeFormation);
  const [awayForm, setAwayForm] = useState(awayFormation);
  const [notesFilter, setNotesFilter] = useState<NotesFilterScope>("all");
  const [relevantNoteIds, setRelevantNoteIds] = useState<string[]>([]);
  const [relevantLoading, setRelevantLoading] = useState(false);
  const relevantFetchedAtRef = useRef(0);
  const relevantInFlightRef = useRef(false);
  const [dossierId, setDossierId] = useState<string | null>(null);
  const [onAirOpen, setOnAirOpen] = useState(false);
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
  const [overrides, setOverrides] = useState<PlayerOverrideRow[]>(initialOverrides);
  const [homeOnLeft, setHomeOnLeft] = useState(true);
  const isLive = status === "Live" || status === "Half Time";
  /** Prep only: click-to-place rail. LIVE/FT → Squad tab instead. */
  const hideSquadRail =
    status === "Live" || status === "Half Time" || status === "Full Time";

  useEffect(() => {
    const onFs = () => {
      const el = deskRootRef.current;
      const active =
        document.fullscreenElement === el ||
        // Safari
        (document as Document & { webkitFullscreenElement?: Element | null })
          .webkitFullscreenElement === el;
      setIsFullscreen(Boolean(active));
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
    const el = deskRootRef.current;
    if (!el) return;
    type FsEl = HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    type FsDoc = Document & {
      webkitExitFullscreen?: () => Promise<void> | void;
      webkitFullscreenElement?: Element | null;
    };
    const doc = document as FsDoc;
    const active =
      document.fullscreenElement === el || doc.webkitFullscreenElement === el;
    try {
      if (active) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
      } else {
        const node = el as FsEl;
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
    if (!placing) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPlacing(null);
        setMsg(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [placing]);

  const starterCount =
    homeEnriched.filter((p) => p.isStarter || p.onPitch).length +
    awayEnriched.filter((p) => p.isStarter || p.onPitch).length;

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
        const res = await fetch(`/api/matches/${matchId}/notes/relevant`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events: news || [], limit: 10 }),
        });
        const json = await res.json();
        if (!res.ok) return;
        const ids = (json.noteIds || []) as string[];
        setRelevantNoteIds(ids);
        relevantFetchedAtRef.current = Date.now();
        const f = notesFilterRef.current;
        if (opts?.autoSwitch && ids.length && (f === "all" || f === "relevant")) {
          setNotesFilter("relevant");
        }
      } catch {
        /* ignore */
      } finally {
        relevantInFlightRef.current = false;
        setRelevantLoading(false);
      }
    },
    [matchId, status]
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
        });
        const json = await res.json();
        if (!res.ok) {
          setMsg(json.error || "Sync failed");
        } else {
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
                setLivePopups((prev) =>
                  [
                    ...prev,
                    { ...popup, id, createdAt: Date.now(), pinned: false },
                  ].slice(-5)
                );
                window.setTimeout(() => {
                  setLivePopups((prev) =>
                    prev.filter((p) => p.id !== id || p.pinned)
                  );
                }, popup.kind === "goal" ? 15_000 : 12_000);
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
                const lines = [
                  scorerName
                    ? `Scorer: ${scorer?.name || scorerName}`
                    : e.description,
                  assistName
                    ? `Assist: ${assister?.name || assistName}`
                    : null,
                  ...seasonBits,
                  hook ? `Note: ${hook}` : null,
                ].filter(Boolean) as string[];
                pushPopup({
                  kind: "goal",
                  title: `GOAL ${e.minute}'`,
                  subtitle: scorer?.name || scorerName || undefined,
                  lines: [...new Set(lines)].slice(0, 8),
                  scoreline: `${homeName} ${scoreRef.current.home}–${scoreRef.current.away} ${awayName}`,
                });
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
              } else if (/var|penalty_miss|red/i.test(e.type || "")) {
                pushPopup({
                  kind: "fact",
                  title: `${(e.type || "Event")
                    .replace(/_/g, " ")
                    .toUpperCase()} ${e.minute}'`,
                  lines: [e.description].filter(Boolean),
                });
              }
            }
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
        setMsg("Sync failed");
      } finally {
        setBusy(false);
      }
    },
    [apiFootballFixtureId, matchId, router, loadSuggestions, loadRelevantNotes, homeName, awayName]
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

  useEffect(() => {
    if (!configured || !apiFootballFixtureId || status !== "Live") return;
    const t = setInterval(() => sync(true), 18_000);
    return () => clearInterval(t);
  }, [configured, apiFootballFixtureId, status, sync]);

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
    setNotesFilter("players");
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

  return (
    <div
      ref={deskRootRef}
      className={cn(
        "relative flex flex-col gap-1.5 overflow-hidden bg-slate-50 dark:bg-slate-950",
        isFullscreen
          ? "fixed inset-0 z-[100] h-[100dvh] max-h-[100dvh] min-h-0 p-2"
          : "h-[calc(100dvh-11rem)] max-h-[100dvh] min-h-[380px]"
      )}
    >
      {/* Slim top bar — score / meta / stats / actions */}
      <header className="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 py-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-bold text-sm truncate">
              {homeName}{" "}
              <span className="text-slate-400 font-normal">vs</span>{" "}
              {awayName}
            </span>
            {(status === "Live" || status === "Full Time" || homeScore > 0 || awayScore > 0) && (
              <span
                className={cn(
                  "font-semibold tabular-nums text-sm",
                  status === "Live" ? "text-rose-600" : "text-slate-700 dark:text-slate-200"
                )}
              >
                {status === "Live" && clockLabel ? `${clockLabel} ` : ""}
                {homeScore}–{awayScore}
              </span>
            )}
            <span className="text-[11px] text-slate-500 truncate">
              {competition} · {kickoffLabel} · {status}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 truncate flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {(venueName || venueCity) && (
              <span className="inline-flex items-center gap-0.5">
                <MapPin className="h-3 w-3 shrink-0" />
                {venueName || "Venue"}
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
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] font-medium hover:bg-slate-50 dark:hover:bg-slate-900"
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
                <div className="absolute right-0 top-full mt-1 z-40 w-56 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-lg p-2 text-[11px]">
                  <div className="font-semibold text-slate-500 uppercase tracking-wide px-1 mb-1">
                    Match intel
                  </div>
                  <Link
                    href={`/match-day/${matchId}/stats`}
                    className="block rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-900 font-semibold text-teal-700 dark:text-teal-300"
                    onClick={() => setIntelOpen(false)}
                  >
                    Match Statistics
                  </Link>
                  <Link
                    href={`/match-day/${matchId}/league`}
                    className="block rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-900 font-semibold text-teal-700 dark:text-teal-300"
                    onClick={() => setIntelOpen(false)}
                  >
                    League table & fixtures
                  </Link>
                  <Link
                    href={`/match-day/${matchId}/scorers`}
                    className="block rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-900"
                    onClick={() => setIntelOpen(false)}
                  >
                    Scorers {scorers.length ? `(${scorers.length})` : ""}
                  </Link>
                  <Link
                    href={`/match-day/${matchId}/keepers`}
                    className="block rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-900"
                    onClick={() => setIntelOpen(false)}
                  >
                    Keepers {keepers.length ? `(${keepers.length})` : ""}
                  </Link>
                  <Link
                    href={`/match-day/${matchId}/penalties`}
                    className="block rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-900"
                    onClick={() => setIntelOpen(false)}
                  >
                    Penalties {penalties.length ? `(${penalties.length})` : ""}
                  </Link>
                  <Link
                    href={`/match-day/${matchId}/injuries`}
                    className="block rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-900"
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

          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium",
              onAirOpen
                ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
                : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900"
            )}
            onClick={() => setOnAirOpen((v) => !v)}
          >
            <Radio className="h-3 w-3 text-rose-500" />
            On-air
            <span className="tabular-nums text-slate-500">{events.length}</span>
            <ChevronDown
              className={cn("h-3 w-3 text-slate-400 transition", onAirOpen && "rotate-180")}
            />
          </button>

          <Link
            href={`/match-day/${matchId}/packs`}
            className="inline-flex items-center gap-1 rounded-md bg-violet-600 hover:bg-violet-500 text-white px-2 py-1 text-[11px] font-semibold"
          >
            <Sparkles className="h-3 w-3" />
            Packs{packCount ? ` (${packCount})` : ""}
          </Link>
          {!apiFootballFixtureId && (
            <Link
              href={`/match-day/${matchId}/prep`}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-[11px]"
            >
              <Link2 className="h-3 w-3" /> Link
            </Link>
          )}
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] font-medium hover:bg-slate-50 dark:hover:bg-slate-900"
            onClick={() => setFieldSettingsOpen(true)}
            title="Field Settings · Pitch Card"
          >
            <SlidersHorizontal className="h-3 w-3" />
            Field
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] font-medium hover:bg-slate-50 dark:hover:bg-slate-900"
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

      {/* Flash toast — overlay, not a permanent band */}
      {flash && (
        <div className="pointer-events-none absolute left-1/2 top-12 z-50 -translate-x-1/2 max-w-[min(90%,36rem)] rounded-lg border border-amber-300 bg-amber-50/95 dark:bg-amber-950/95 dark:border-amber-800 px-3 py-1.5 text-xs font-medium text-amber-900 dark:text-amber-100 shadow-lg animate-pulse">
          {flash}
        </div>
      )}

      {/* Live intel popups — prominent stacked cards; click pin or dismiss */}
      {livePopups.length > 0 && (
        <div className="absolute left-1/2 top-12 z-[60] flex w-[min(94%,26rem)] -translate-x-1/2 flex-col gap-2">
          {livePopups.map((popup) => (
            <div
              key={popup.id}
              role="dialog"
              aria-label={popup.title}
              className={cn(
                "rounded-2xl border-2 px-4 py-3 text-left shadow-2xl ring-1 ring-black/5",
                popup.kind === "goal" &&
                  "border-emerald-500 bg-emerald-50/98 dark:bg-emerald-950/98 dark:border-emerald-500",
                popup.kind === "sub" &&
                  "border-sky-500 bg-sky-50/98 dark:bg-sky-950/98 dark:border-sky-500",
                popup.kind === "fact" &&
                  "border-amber-500 bg-amber-50/98 dark:bg-amber-950/98 dark:border-amber-500",
                popup.pinned && "ring-2 ring-amber-400"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {popup.kind === "goal"
                      ? "Goal"
                      : popup.kind === "sub"
                        ? "Substitution"
                        : "Live"}
                    {popup.pinned ? " · pinned" : ""}
                  </div>
                  <div className="mt-0.5 text-base font-black text-slate-900 dark:text-white">
                    {popup.title}
                    {popup.subtitle ? (
                      <span className="ml-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                        {popup.subtitle}
                      </span>
                    ) : null}
                  </div>
                  {popup.scoreline ? (
                    <div className="mt-0.5 text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                      {popup.scoreline}
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    className="rounded-md border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:text-amber-600"
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
                        popup.pinned && "fill-amber-400 text-amber-500"
                      )}
                    />
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:text-rose-600"
                    title="Dismiss"
                    onClick={() =>
                      setLivePopups((prev) =>
                        prev.filter((p) => p.id !== popup.id)
                      )
                    }
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <ul className="mt-2 space-y-1 text-xs text-slate-800 dark:text-slate-100">
                {popup.lines.map((line, i) => (
                  <li key={i} className="leading-snug">
                    {line}
                  </li>
                ))}
              </ul>
              <div className="mt-2 text-[9px] text-slate-400">
                Auto-hides · pin to keep
              </div>
            </div>
          ))}
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
          hideSquadRail
            ? "lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)]"
            : "lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)_minmax(180px,200px)]"
        )}
      >
        <aside className="min-h-0 overflow-hidden order-2 lg:order-1">
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
            externalFilter={notesFilter}
            onFilterChange={setNotesFilter}
            fillHeight
            liveMode={isLive || status === "Full Time"}
            playerNameById={Object.fromEntries(squad.map((p) => [p.id, p.name]))}
            onNotePlayerClick={(playerId) => {
              const p = squad.find((s) => s.id === playerId);
              if (p) openPlayer(p);
            }}
            relevantNoteIds={relevantNoteIds}
            relevantLoading={relevantLoading}
          />
        </aside>

        <section className="relative min-h-0 flex flex-col overflow-hidden order-1 lg:order-2">
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
                            body: JSON.stringify({ resetPlacements: true }),
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
              onHomeLogoClick={() => setNotesFilter("home")}
              onAwayLogoClick={() => setNotesFilter("away")}
              onLeagueLogoClick={() => setNotesFilter("match")}
              cardSettings={fieldSettings}
              markerPct={markerPct}
              onOpenFieldSettings={() => setFieldSettingsOpen(true)}
              homeOnLeft={homeOnLeft}
              onToggleHomeOnLeft={toggleHomeOnLeft}
              liveCompact={isLive}
            />
          </div>

          {/* On-air drawer — overlays pitch, does not steal permanent height */}
          {onAirOpen && (
            <div className="absolute inset-x-0 bottom-0 z-30 max-h-[min(28%,168px)] rounded-t-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-950/95 backdrop-blur shadow-2xl overflow-hidden flex flex-col">
              <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-slate-100 dark:border-slate-800">
                <Radio className="h-3.5 w-3.5 text-rose-500" />
                <span className="text-xs font-bold uppercase tracking-wide">On-air</span>
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

        {!hideSquadRail && (
          <aside className="min-h-0 overflow-hidden order-3">
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
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md shadow-2xl border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col">
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
            <button
              type="button"
              className="rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs"
              onClick={() => setCoachSide(null)}
            >
              Close
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
            {(() => {
              const c = coachSide === "home" ? homeCoach : awayCoach;
              if (!c) {
                return (
                  <p className="text-sm text-slate-500">
                    No coach on file for this side.
                  </p>
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
                  <NotesPanel
                    matchId={matchId}
                    entityType="coach"
                    entityId={c.id || `${coachSide}-coach`}
                    entityLabel={c.name}
                    initialNotes={notes.filter(
                      (n) =>
                        n.entityId === c.id ||
                        (n.entityType === "coach" &&
                          (n.title || "").includes(c.name))
                    )}
                    fillHeight
                  />
                </>
              );
            })()}
          </div>
        </div>
      )}

{dossierId && (
        <PlayerDossier
          matchId={matchId}
          playerId={dossierId}
          initialTab="profile"
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
      />
    </div>
  );

}
