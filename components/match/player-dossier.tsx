"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X, Loader2, BookOpen, Star, User, Settings2, Volume2, Plus } from "lucide-react";
import { NotesPanel, type NoteRow } from "@/components/notes/notes-panel";
import { EventTimeline } from "@/components/match/event-timeline";
import { cn } from "@/lib/utils";
import {
  dualNationalities,
  flagUrl,
  formatFoot,
  formatRating,
  lastNameOf,
  playerPhotoUrl,
  posCode,
} from "@/lib/flags";
import { speechLangFromNationality, speakPronunciation } from "@/lib/speech-lang";
import type { PlayerOverrideRow } from "@/lib/player-overrides";
import {
  formatHeightValue,
  formatWeightValue,
  loadFieldSettings,
  type HeightUnit,
} from "@/lib/field-settings";

type DossierPayload = {
  player: {
    id: string;
    name: string;
    shirtNumber: number;
    position: string;
    nationality: string;
    birthCountry?: string | null;
    age: number | null;
    heightCm: number | null;
    weightKg: number | null;
    birthDate: string | null;
    photoUrl: string | null;
    preferredFoot: string | null;
    isCaptain: boolean;
    goals: number;
    assists: number;
    appearances: number;
    cleanSheets: number;
    yellowCards: number;
    redCards: number;
    rating?: number | null;
    apiFootballPlayerId: number | null;
    club: { id: string; name: string; shortName: string; primaryColor: string };
    seasonScorer: { goals: number; assists: number; rank: number } | null;
    seasonKeeper: {
      cleanSheets: number;
      saves: number;
      appearances: number;
      rank: number;
    } | null;
  };
  notes: NoteRow[];
  events: {
    id: string;
    type: string;
    minute: number;
    description: string;
    teamSide: string | null;
  }[];
  injuries?: {
    id: string;
    status: string;
    injuryType: string;
    expectedReturn: string | null;
    notes: string | null;
  }[];
  afStats: {
    player?: {
      photo?: string;
      height?: string;
      weight?: string;
      nationality?: string;
      birth?: { date?: string; country?: string | null };
      age?: number;
    };
    statistics?: {
      league?: { name?: string; season?: number };
      team?: { name?: string };
      games?: {
        appearences?: number | null;
        lineups?: number | null;
        minutes?: number | null;
        position?: string | null;
        rating?: string | number | null;
      };
      goals?: {
        total?: number | null;
        assists?: number | null;
        conceded?: number | null;
        saves?: number | null;
      };
      cards?: { yellow?: number | null; red?: number | null };
    }[];
  } | null;
  afStub: string | null;
  career?: {
    clubs: {
      teamId: number | null;
      name: string;
      logo?: string | null;
      seasons: number[];
      apps: number;
      goals: number;
      assists: number;
    }[];
    seasons: {
      season: number;
      competitions: {
        league: string;
        country?: string | null;
        team: string;
        apps: number | null;
        goals: number | null;
        assists: number | null;
        minutes: number | null;
        rating: string | number | null;
      }[];
    }[];
  } | null;
  recentForm?: {
    date: string;
    opponent: string;
    opponentLogo?: string | null;
    league?: string | null;
    result: "W" | "D" | "L" | null;
    homeAway: "H" | "A" | null;
    score: string;
    rating: string | null;
    started: boolean | null;
    minutes: number | null;
    goals: number | null;
    assists: number | null;
    yellow: number | null;
    red: number | null;
  }[];
  lastGoal?: {
    date: string;
    opponent: string;
    score: string;
    goals: number | null;
    homeAway: "H" | "A" | null;
  } | null;
  transfers?: {
    date: string;
    type: string | null;
    from: { name: string; logo?: string | null };
    to: { name: string; logo?: string | null };
  }[];
  afSidelined?: { type: string; start: string | null; end: string | null }[];
  matchPlayerStats?: any;
  trophies?: { league: string; season?: string | null; place?: string | null }[];
  opponentClub?: { id: string; name: string; shortName: string; apiFootballTeamId: number | null } | null;
  clubLogoUrl?: string | null;
};

type Tab = "profile" | "today" | "statistics" | "career" | "bio" | "scouting" | "funfact" | "sidelined" | "notes";

function Flag({ nationality, label }: { nationality?: string | null; label?: string }) {
  const src = flagUrl(nationality, 20);
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-300">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-3 w-4 rounded-[1px] object-cover" />
      ) : (
        <span className="h-3 w-4 rounded-[1px] bg-slate-200 inline-block" />
      )}
      {label ? <span>{label}</span> : null}
      {!label && nationality ? <span>{nationality}</span> : null}
    </span>
  );
}

function cmToFtIn(cm?: number | null): string {
  if (cm == null) return "—";
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn % 12);
  return `${ft}'${inch}"`;
}

function kgToLbs(kg?: number | null): string {
  if (kg == null) return "—";
  return `${Math.round(kg * 2.20462)} lbs`;
}

export function PlayerDossier({
  matchId,
  playerId,
  onClose,
  initialTab = "profile",
  initialNotes = [],
  playerName,
  initialOverride = null,
  onOverrideChange,
}: {
  matchId: string;
  playerId: string;
  onClose: () => void;
  initialTab?: Tab | "overview" | "stats" | "events";
  initialNotes?: NoteRow[];
  playerName?: string;
  initialOverride?: PlayerOverrideRow | null;
  onOverrideChange?: (row: PlayerOverrideRow | null) => void;
}) {
  const mapInitial = (t: string): Tab => {
    if (t === "overview") return "profile";
    if (t === "stats") return "statistics";
    if (t === "events") return "today";
    if (t === "notes") return "notes";
    if (["profile", "today", "statistics", "career", "bio", "notes", "scouting", "funfact", "sidelined"].includes(t))
      return t as Tab;
    return "profile";
  };

  const [data, setData] = useState<DossierPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>(mapInitial(initialTab));
  const [careerClubIdx, setCareerClubIdx] = useState(0);
  const [gearOpen, setGearOpen] = useState(false);
  const [heightUnit, setHeightUnit] = useState<HeightUnit>("cm");
  const [ovDisplayName, setOvDisplayName] = useState(
    initialOverride?.displayName || ""
  );
  const [ovPronunciation, setOvPronunciation] = useState(
    initialOverride?.pronunciation || ""
  );
  const [ovPitchFlag, setOvPitchFlag] = useState(
    initialOverride?.pitchFlag || "both"
  );
  const [ovJersey, setOvJersey] = useState(
    initialOverride?.jerseyNumber != null
      ? String(initialOverride.jerseyNumber)
      : ""
  );
  const [ovSaving, setOvSaving] = useState(false);
  const [ovMsg, setOvMsg] = useState<string | null>(null);
  const [createNoteBusy, setCreateNoteBusy] = useState(false);
  const [createNoteMsg, setCreateNoteMsg] = useState<string | null>(null);

  useEffect(() => {
    setHeightUnit(loadFieldSettings().heightUnit);
  }, []);

  useEffect(() => {
    setOvDisplayName(initialOverride?.displayName || "");
    setOvPronunciation(initialOverride?.pronunciation || "");
    setOvPitchFlag(initialOverride?.pitchFlag || "both");
    setOvJersey(
      initialOverride?.jerseyNumber != null
        ? String(initialOverride.jerseyNumber)
        : ""
    );
    setGearOpen(false);
    setOvMsg(null);
  }, [playerId, initialOverride]);

  useEffect(() => {
    setCareerClubIdx(0);
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTab(mapInitial(initialTab));
    fetch(`/api/players/${playerId}?matchId=${encodeURIComponent(matchId)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Failed to load");
        if (!cancelled) setData(j);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [playerId, matchId, initialTab]);

  const p = data?.player;
  const notesList = data?.notes?.length ? data.notes : initialNotes;
  const afRows = data?.afStats?.statistics || [];
  const af = afRows[0];
  const photo =
    p?.photoUrl ||
    data?.afStats?.player?.photo ||
    playerPhotoUrl({ apiFootballPlayerId: p?.apiFootballPlayerId ?? null });

  const birthCountry =
    p?.birthCountry ||
    data?.afStats?.player?.birth?.country ||
    null;
  const displayName =
    ovDisplayName.trim() || p?.name || playerName || "Player dossier";
  const flagOptions = dualNationalities(p?.nationality, birthCountry);
  const rating =
    formatRating(p?.rating) !== "—"
      ? formatRating(p?.rating)
      : formatRating(af?.games?.rating);

  async function saveOverrides(clear = false) {
    setOvSaving(true);
    setOvMsg(null);
    try {
      const body = clear
        ? { playerId, clear: true }
        : {
            playerId,
            displayName: ovDisplayName.trim() || null,
            pronunciation: ovPronunciation.trim() || null,
            pitchFlag: ovPitchFlag || "both",
            jerseyNumber: ovJersey.trim() === "" ? null : Number(ovJersey),
          };
      const r = await fetch(`/api/matches/${matchId}/overrides`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Save failed");
      if (j.cleared || !j.override) {
        onOverrideChange?.(null);
        setOvDisplayName("");
        setOvPronunciation("");
        setOvPitchFlag("both");
        setOvJersey("");
        setOvMsg("Cleared match overrides");
      } else {
        onOverrideChange?.({
          playerId,
          displayName: j.override.displayName,
          pronunciation: j.override.pronunciation,
          pitchFlag: j.override.pitchFlag,
          jerseyNumber: j.override.jerseyNumber,
        });
        setOvMsg("Saved for this match");
      }
    } catch (e) {
      setOvMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setOvSaving(false);
    }
  }

  function speakNow() {
    const text = ovPronunciation.trim() || ovDisplayName.trim() || p?.name || "";
    const ok = speakPronunciation(
      text,
      speechLangFromNationality(p?.nationality)
    );
    if (!ok) setOvMsg("Speech not available in this browser");
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "profile", label: "Profile" },
    { key: "today", label: "Today's Match" },
    { key: "statistics", label: "Statistics" },
    { key: "bio", label: "Bio" },
    { key: "scouting", label: "Scouting" },
    { key: "funfact", label: "Funfact" },
    { key: "career", label: "Career" },
    { key: "sidelined", label: "Sidelined" },
  ];

  const careerClubs = data?.career?.clubs || [];
  const careerSeasons = data?.career?.seasons || [];
  const activeCareerClub =
    careerClubs[Math.min(careerClubIdx, Math.max(careerClubs.length - 1, 0))] ||
    null;
  const currentSeasonBlock = careerSeasons[0] || null;

  const bioNotes = notesList.filter(
    (n) =>
      /bio/i.test(n.title || "") ||
      /bio/i.test(n.category || "") ||
      /narrative/i.test(n.title || "")
  );
  const profileNotes = notesList.length ? notesList : bioNotes;

  async function quickCreateNote(withGemini: boolean) {
    setCreateNoteBusy(true);
    setCreateNoteMsg(null);
    try {
      let body = "";
      let title = `${displayName} note`;
      if (withGemini) {
        const r = await fetch(`/api/players/${playerId}/note-draft?matchId=${encodeURIComponent(matchId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.body) {
          body = String(j.body);
          if (j.title) title = String(j.title);
        } else {
          // Soft-fail: still create empty note
          setCreateNoteMsg(j.error || "No factual blurb available — empty note created");
        }
      }
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId,
          title,
          body,
          category: "Custom",
          entityType: "player",
          entityId: playerId,
          pinned: false,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Create failed");
      setTab("notes");
      // refresh dossier notes
      const reload = await fetch(`/api/players/${playerId}?matchId=${encodeURIComponent(matchId)}`);
      const dj = await reload.json().catch(() => null);
      if (reload.ok && dj) setData(dj);
      if (!createNoteMsg) setCreateNoteMsg(withGemini && body ? "Note created with factual blurb" : "Empty note created");
    } catch (e) {
      setCreateNoteMsg(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreateNoteBusy(false);
    }
  }

  return (
    <div data-desk-focus="dossier" className="fixed inset-y-0 right-0 z-50 w-full max-w-4xl shadow-lg border-l border-[var(--border)] bg-[var(--surface)] flex flex-col">
      {/* Header */}
      <div className="modal-header-shell shrink-0 px-4 py-3">
        {data?.clubLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.clubLogoUrl} alt="" className="crest-watermark" />
        ) : null}
        <div className="relative flex items-start gap-3">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt=""
              className="h-16 w-16 rounded-md object-cover object-top ring-1 ring-slate-200 dark:ring-slate-700 bg-slate-100"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div
              className="h-16 w-16 rounded-md flex items-center justify-center text-white"
              style={{ backgroundColor: p?.club.primaryColor || "#0d9488" }}
            >
              <User className="h-8 w-8 opacity-80" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold leading-tight break-words">{displayName}</h2>
              <Star className="h-3.5 w-3.5 text-amber-400" />
            </div>
            {p && (
              <>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Flag nationality={p.nationality} label={`${p.nationality} (Citizenship)`} />
                  <Flag nationality={p.nationality} label={`${p.nationality} (National team)`} />
                  <Flag
                    nationality={birthCountry || p.nationality}
                    label={`${birthCountry || p.nationality} (Country of birth)`}
                  />
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600 dark:text-slate-300">
                  {data?.clubLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={data.clubLogoUrl} alt="" className="h-5 w-5 object-contain" />
                  ) : null}
                  <span className="font-semibold">{p.club.name} #{p.shirtNumber}</span>
                  {p.isCaptain ? (
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-slate-900">C</span>
                  ) : null}
                  <span className="rounded bg-sky-600 text-white px-1.5 py-px text-[10px] font-bold uppercase">
                    {posCode(p.position)}
                  </span>
                  <span className="text-slate-500">{p.position}</span>
                  <span className="text-slate-300">·</span>
                  <span>{p.age != null ? `${p.age} yr` : "— yr"}</span>
                  <span>{formatHeightValue(p.heightCm, heightUnit)}</span>
                  <span>{formatWeightValue(p.weightKg, heightUnit)}</span>
                  <span>
                    {p.preferredFoot
                      ? `${formatFoot(p.preferredFoot) === "—" ? p.preferredFoot : formatFoot(p.preferredFoot)} Foot`
                      : "Foot —"}
                  </span>
                </div>
              </>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wide text-amber-500">
              Player
            </span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                disabled={createNoteBusy}
                className="desk-btn text-[10px] font-bold uppercase tracking-[var(--tracking-label)] disabled:opacity-50"
                onClick={() => void quickCreateNote(false)}
                title="Quick-add empty note"
              >
                <Plus className="h-3.5 w-3.5" />
                Create note
              </button>
              <button
                type="button"
                disabled={createNoteBusy}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                onClick={() => void quickCreateNote(true)}
                title="Create note with one factual blurb from research/AF only (no invention)"
              >
                + Fill
              </button>
              <button
                type="button"
                className="focus-ring interactive-press p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--surface-muted)]"
                onClick={() => setGearOpen((v) => !v)}
                aria-label="Pitch card overrides"
                title="Name / pronunciation / flag / jersey (this match)"
              >
                <Settings2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="focus-ring interactive-press p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--surface-muted)]"
                onClick={onClose}
                aria-label="Close dossier"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
      {createNoteMsg ? (
        <div className="shrink-0 px-4 py-1.5 text-[11px] text-slate-600 dark:text-slate-300 border-b border-[var(--border)]">
          {createNoteMsg}
        </div>
      ) : null}

      {gearOpen && (
        <div className="shrink-0 border-b border-[var(--border)] bg-amber-50/70 dark:bg-amber-950/25 px-4 py-3 space-y-2.5">
          <div className="text-[11px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
            Pitch card overrides · this match only
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-[11px] space-y-1">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                Name on field
              </span>
              <input
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 py-1.5 text-sm"
                placeholder={p ? lastNameOf(p.name) : "Last name"}
                value={ovDisplayName}
                onChange={(e) => setOvDisplayName(e.target.value)}
              />
            </label>
            <label className="block text-[11px] space-y-1">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                Jersey #
              </span>
              <input
                type="number"
                min={0}
                max={99}
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 py-1.5 text-sm"
                placeholder={p ? String(p.shirtNumber) : "#"}
                value={ovJersey}
                onChange={(e) => setOvJersey(e.target.value)}
              />
            </label>
            <label className="block text-[11px] space-y-1 sm:col-span-2">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                Pronunciation (IPA or phonetic)
              </span>
              <div className="flex gap-1.5">
                <input
                  className="min-w-0 flex-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 py-1.5 text-sm"
                  placeholder="e.g. YO-han-son"
                  value={ovPronunciation}
                  onChange={(e) => setOvPronunciation(e.target.value)}
                />
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-600 px-2.5 text-[11px] font-semibold hover:bg-white dark:hover:bg-slate-900"
                  onClick={speakNow}
                  title="Speak with Web Speech API"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  Speak
                </button>
              </div>
            </label>
            <label className="block text-[11px] space-y-1 sm:col-span-2">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                Flag on pitch
              </span>
              <select
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 py-1.5 text-sm"
                value={ovPitchFlag}
                onChange={(e) => setOvPitchFlag(e.target.value)}
              >
                <option value="both">Both flags (dual)</option>
                <option value="primary">
                  Primary only{flagOptions[0] ? ` (${flagOptions[0]})` : ""}
                </option>
                <option value="secondary">
                  Secondary only{flagOptions[1] ? ` (${flagOptions[1]})` : ""}
                </option>
                {flagOptions.map((n) => (
                  <option key={n} value={n}>
                    {n} only
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <button
              type="button"
              disabled={ovSaving}
              onClick={() => void saveOverrides(false)}
              className="rounded-md bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50"
            >
              {ovSaving ? "Saving…" : "Save overrides"}
            </button>
            <button
              type="button"
              disabled={ovSaving}
              onClick={() => void saveOverrides(true)}
              className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-[11px] font-semibold hover:bg-white dark:hover:bg-slate-900"
            >
              Clear
            </button>
            {ovMsg ? (
              <span className="text-[11px] text-slate-600 dark:text-slate-300">{ovMsg}</span>
            ) : null}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="shrink-0 flex gap-1 px-3 py-2 border-b border-[var(--border)] bg-[var(--surface-muted)] overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-md px-3 py-1.5 text-[11px] font-semibold border whitespace-nowrap",
              tab === t.key
                ? "bg-[var(--surface)] text-[var(--foreground)] border-[var(--border-strong)] shadow-xs"
                : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]"
            )}
          >
            {t.label}
            {t.key === "notes" ? ` (${notesList.length})` : ""}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {loading && tab !== "notes" && (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading dossier…
          </div>
        )}
        {error && <p className="text-xs text-rose-600">{error}</p>}

        {p && tab === "profile" && (
          <div className="grid md:grid-cols-2 gap-2.5">
            <div className="space-y-2.5">
              {/* This match + last goal chips */}
              <div className="grid grid-cols-2 gap-2">
                {(() => {
                  const mps = data?.matchPlayerStats as any;
                  const chips = [
                    {
                      label: "This match",
                      value: mps?.games?.rating != null ? formatRating(mps.games.rating) : "—",
                      sub: mps?.games?.minutes != null ? `${mps.games.minutes}'` : "no live row",
                    },
                    {
                      label: "Last goal",
                      value: data?.lastGoal
                        ? `${data.lastGoal.goals || 1}G`
                        : "—",
                      sub: data?.lastGoal
                        ? `${(data.lastGoal.date || "").slice(5, 10)} vs ${data.lastGoal.opponent}`
                        : "none in last 5",
                    },
                  ];
                  return chips.map((c) => (
                    <div
                      key={c.label}
                      className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 py-2"
                    >
                      <div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                        {c.label}
                      </div>
                      <div className="text-lg font-black tabular-nums leading-tight">{c.value}</div>
                      <div className="text-[10px] text-slate-500 truncate">{c.sub}</div>
                    </div>
                  ));
                })()}
              </div>

              <Section title="Transfer" dense>
                {data?.transfers?.[0] ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs">
                      {data.transfers[0].from.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={data.transfers[0].from.logo} alt="" className="h-5 w-5 object-contain" />
                      ) : null}
                      <div className="min-w-0">
                        <div className="font-semibold truncate">
                          {data.transfers[0].from.name} → {data.transfers[0].to.name}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {data.transfers[0].date}
                          {data.transfers[0].type ? ` · ${data.transfers[0].type}` : ""}
                        </div>
                      </div>
                    </div>
                    {(data.transfers.length > 1) && (
                      <ul className="text-[10px] text-slate-500 space-y-0.5 max-h-16 overflow-y-auto">
                        {data.transfers.slice(1, 5).map((tr, i) => (
                          <li key={i} className="truncate">
                            {tr.date.slice(0, 10)} · {tr.from.name} → {tr.to.name}
                            {tr.type ? ` (${tr.type})` : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">No transfer record from feed.</p>
                )}
              </Section>

              <Section title="Current club" dense>
                <div className="flex items-center gap-2 text-xs">
                  {data?.clubLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={data.clubLogoUrl} alt="" className="h-5 w-5 object-contain" />
                  ) : null}
                  <div>
                    <div className="font-semibold">{p.club.name}</div>
                    <div className="text-[10px] text-slate-500">
                      Contract dates not in feed — honest empty.
                    </div>
                  </div>
                </div>
              </Section>

              <Section title="All-time team stats" dense>
                {(careerClubs.length ? careerClubs : []).length === 0 ? (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase text-slate-400 text-left">
                        <th className="py-0.5 font-semibold">Team</th>
                        <th className="py-0.5 font-semibold">App</th>
                        <th className="py-0.5 font-semibold">G</th>
                        <th className="py-0.5 font-semibold">A</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-[var(--border)]">
                        <td className="py-1 font-medium">{p.club.name}</td>
                        <td className="py-1 tabular-nums font-bold">{p.appearances || 0}</td>
                        <td className="py-1 tabular-nums font-semibold">{p.goals || 0}</td>
                        <td className="py-1 tabular-nums">{p.assists || 0}</td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <div className="overflow-x-auto max-h-40 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[10px] uppercase text-slate-400 text-left">
                          <th className="py-0.5 font-semibold">Team</th>
                          <th className="py-0.5 font-semibold">Seasons</th>
                          <th className="py-0.5 font-semibold">App</th>
                          <th className="py-0.5 font-semibold">G</th>
                          <th className="py-0.5 font-semibold">A</th>
                        </tr>
                      </thead>
                      <tbody>
                        {careerClubs.filter((c) => c.apps > 0 || c.seasons.length > 0).slice(0, 8).map((c, i) => (
                          <tr key={`${c.teamId ?? c.name}-${i}`} className="border-t border-[var(--border)]">
                            <td className="py-1 font-medium">
                              <span className="inline-flex items-center gap-1.5">
                                {c.logo ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={c.logo} alt="" className="h-4 w-4 object-contain" />
                                ) : null}
                                {c.name}
                              </span>
                            </td>
                            <td className="py-1 text-[10px] text-slate-500 tabular-nums">
                              {c.seasons.length
                                ? c.seasons.length > 1
                                  ? `${c.seasons[c.seasons.length - 1]}–${c.seasons[0]}`
                                  : String(c.seasons[0])
                                : "—"}
                            </td>
                            <td className="py-1">
                              <span className="rounded bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 font-bold tabular-nums">
                                {c.apps || "—"}
                              </span>
                            </td>
                            <td className="py-1 tabular-nums font-semibold">{c.goals || "—"}</td>
                            <td className="py-1 tabular-nums">{c.assists || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              <Section
                title={
                  currentSeasonBlock
                    ? `Season ${currentSeasonBlock.season} · by competition`
                    : "Season · by competition"
                }
                dense
              >
                {!currentSeasonBlock ? (
                  <p className="text-[11px] text-slate-500">No season breakdown from feed.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="text-[9px] uppercase text-slate-400 text-left">
                          <th className="py-0.5 font-semibold">Comp</th>
                          <th className="py-0.5 font-semibold">App</th>
                          <th className="py-0.5 font-semibold">G</th>
                          <th className="py-0.5 font-semibold">A</th>
                          <th className="py-0.5 font-semibold">Min</th>
                          <th className="py-0.5 font-semibold">Rtg</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentSeasonBlock.competitions.map((row, i) => (
                          <tr key={i} className="border-t border-[var(--border)]">
                            <td className="py-1 font-medium max-w-[9rem] truncate">{row.league}</td>
                            <td className="py-1 tabular-nums">{row.apps ?? "—"}</td>
                            <td className="py-1 tabular-nums font-semibold">{row.goals ?? "—"}</td>
                            <td className="py-1 tabular-nums">{row.assists ?? "—"}</td>
                            <td className="py-1 tabular-nums text-slate-500">{row.minutes ?? "—"}</td>
                            <td className="py-1 tabular-nums">{formatRating(row.rating)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              <Section title="Physical" dense>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  <Fact label="Age" value={p.age != null ? String(p.age) : "—"} />
                  <Fact label="Height" value={formatHeightValue(p.heightCm, heightUnit)} />
                  <Fact label="Weight" value={formatWeightValue(p.weightKg, heightUnit)} />
                  <Fact
                    label="Foot"
                    value={
                      p.preferredFoot
                        ? formatFoot(p.preferredFoot) === "—"
                          ? p.preferredFoot
                          : formatFoot(p.preferredFoot)
                        : "—"
                    }
                  />
                  <Fact label="Born" value={p.birthDate || "—"} />
                  <Fact label="Cards" value={`Y${p.yellowCards} R${p.redCards}`} />
                </div>
              </Section>

              {(data?.injuries?.length ?? 0) > 0 && (
                <Section title="Sidelined" tone="rose" dense>
                  <ul className="space-y-0.5">
                    {(data?.injuries || []).map((inj) => (
                      <li key={inj.id} className="text-xs">
                        <span className="font-semibold">{inj.injuryType}</span>
                        <span className="text-slate-500"> · {inj.status}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </div>

            <div className="space-y-2.5">
              <Section title="Recent form · last 5" dense>
                {(data?.recentForm?.length || 0) === 0 ? (
                  <p className="text-[11px] text-slate-500">No recent form rows from feed.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="text-slate-400 uppercase text-left">
                          <th className="py-0.5 pr-1">Date</th>
                          <th className="py-0.5 pr-1">Opp</th>
                          <th className="py-0.5 pr-1">R</th>
                          <th className="py-0.5 pr-1">H/A</th>
                          <th className="py-0.5 pr-1">Res</th>
                          <th className="py-0.5 pr-1">Rtg</th>
                          <th className="py-0.5 pr-1">XI</th>
                          <th className="py-0.5 pr-1">Min</th>
                          <th className="py-0.5 pr-1">G</th>
                          <th className="py-0.5">A</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data?.recentForm || []).map((row, i) => (
                          <tr key={i} className="border-t border-[var(--border)]">
                            <td className="py-1 pr-1 tabular-nums whitespace-nowrap">{(row.date || "").slice(5, 10)}</td>
                            <td className="py-1 pr-1 max-w-[6.5rem] truncate">{row.opponent}</td>
                            <td className={cn(
                              "py-1 pr-1 font-bold",
                              row.result === "W" ? "text-emerald-600" : row.result === "L" ? "text-rose-600" : ""
                            )}>{row.result || "—"}</td>
                            <td className="py-1 pr-1">{row.homeAway || "—"}</td>
                            <td className="py-1 pr-1 tabular-nums">{row.score}</td>
                            <td className="py-1 pr-1 tabular-nums font-semibold">{row.rating ? formatRating(row.rating) : "—"}</td>
                            <td className="py-1 pr-1">{row.started === true ? "XI" : row.started === false ? "SUB" : "—"}</td>
                            <td className="py-1 pr-1 tabular-nums">{row.minutes ?? "—"}</td>
                            <td className="py-1 pr-1 tabular-nums">{row.goals || "—"}</td>
                            <td className="py-1 tabular-nums">{row.assists || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              {/* Notes — compact, no giant void */}
              <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-[var(--border)]">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                    <BookOpen className="h-3.5 w-3.5" />
                    Notes ({profileNotes.length})
                  </div>
                  <button
                    type="button"
                    className="text-[10px] font-semibold text-[var(--brand-dark)] dark:text-[var(--brand)] hover:underline"
                    onClick={() => setTab("notes")}
                  >
                    + Add
                  </button>
                </div>
                <div className="p-2 space-y-1.5 max-h-[220px] overflow-y-auto">
                  {profileNotes.length === 0 ? (
                    <p className="text-[11px] text-slate-500 px-1 py-2 text-center">
                      No notes yet — pack bios appear after generate.
                    </p>
                  ) : (
                    profileNotes.slice(0, 6).map((n) => (
                      <div
                        key={n.id}
                        className="queue-row queue-row-now px-2 py-1.5"
                      >
                        <div className="text-[11px] font-semibold truncate">
                          {n.pinned ? "📌 " : ""}
                          {n.title}
                        </div>
                        <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-3 whitespace-pre-wrap">
                          {n.body}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {data?.afStub && !/TURBOPACK|prisma|at\s+\S+/i.test(data.afStub) && (
                <p className="text-[10px] text-slate-500 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 px-2 py-1">
                  {data.afStub}
                </p>
              )}
            </div>
          </div>
        )}

        {p && tab === "today" && (
          <div className="space-y-2.5">
            {(() => {
              const mps = data?.matchPlayerStats as any;
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    ["Rating", mps?.games?.rating != null ? formatRating(mps.games.rating) : "—"],
                    ["Minutes", mps?.games?.minutes ?? "—"],
                    ["Goals", mps?.goals?.total ?? "—"],
                    ["Assists", mps?.goals?.assists ?? "—"],
                    ["Shots", mps?.shots?.total ?? "—"],
                    ["SoT", mps?.shots?.on ?? "—"],
                    ["Key pass", mps?.passes?.key ?? "—"],
                    ["Tackles", mps?.tackles?.total ?? "—"],
                  ].map(([label, val]) => (
                    <div key={label as string} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 py-2 text-center">
                      <div className="text-[9px] font-bold uppercase text-slate-400">{label}</div>
                      <div className="text-lg font-black tabular-nums">{val as any}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
            {!data?.matchPlayerStats ? (
              <p className="text-[11px] text-slate-500">Match metrics not in feed yet — events below still update live.</p>
            ) : null}
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
                Events · {lastNameOf(p.name)}
                {data?.opponentClub ? ` vs ${data.opponentClub.name}` : ""}
              </div>
              <EventTimeline
                events={data?.events || []}
                compact
                emptyLabel="No match events for this player yet."
                maxHeightClass="max-h-[50vh]"
              />
            </div>
          </div>
        )}

        {p && tab === "statistics" && (
          <div className="space-y-3">
            {(() => {
              const mps = data?.matchPlayerStats as any;
              const rt = mps?.games?.rating != null ? formatRating(mps.games.rating) : rating;
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className={cn("rounded-[var(--radius-md)] px-3 py-3 text-center", Number(rt) >= 7 ? "bg-[var(--success)] text-white" : "bg-[var(--surface-muted)]")}>
                    <div className="text-[9px] font-bold uppercase opacity-80">Rating</div>
                    <div className="text-2xl font-black tabular-nums">{rt !== "—" ? rt : "—"}</div>
                  </div>
                  <div className="rounded-[var(--radius-md)] px-3 py-3 text-center bg-[var(--surface-muted)]">
                    <div className="text-[9px] font-bold uppercase text-slate-400">Minutes</div>
                    <div className="text-2xl font-black tabular-nums">{mps?.games?.minutes ?? "—"}</div>
                  </div>
                  <div className="rounded-[var(--radius-md)] px-3 py-3 text-center bg-[var(--surface-muted)]">
                    <div className="text-[9px] font-bold uppercase text-slate-400">Goals</div>
                    <div className="text-2xl font-black tabular-nums">{mps?.goals?.total ?? "—"}</div>
                  </div>
                  <div className="rounded-[var(--radius-md)] px-3 py-3 text-center bg-[var(--surface-muted)]">
                    <div className="text-[9px] font-bold uppercase text-slate-400">Assists</div>
                    <div className="text-2xl font-black tabular-nums">{mps?.goals?.assists ?? "—"}</div>
                  </div>
                </div>
              );
            })()}
            {data?.matchPlayerStats ? (
              <div className="grid md:grid-cols-3 gap-3">
                {[
                  ["Offensive", [["Shots on target", (data.matchPlayerStats as any)?.shots?.on], ["Shots total", (data.matchPlayerStats as any)?.shots?.total], ["Key passes", (data.matchPlayerStats as any)?.passes?.key], ["Pass accuracy", (data.matchPlayerStats as any)?.passes?.accuracy]]],
                  ["Defensive", [["Tackles", (data.matchPlayerStats as any)?.tackles?.total], ["Interceptions", (data.matchPlayerStats as any)?.tackles?.interceptions], ["Blocks", (data.matchPlayerStats as any)?.tackles?.blocks], ["Fouls", (data.matchPlayerStats as any)?.fouls?.committed]]],
                  ["Overall", [["Passes", (data.matchPlayerStats as any)?.passes?.total], ["Duels won", (data.matchPlayerStats as any)?.duels?.won], ["Duels total", (data.matchPlayerStats as any)?.duels?.total], ["Yellow", (data.matchPlayerStats as any)?.cards?.yellow]]],
                ].map(([title, rows]) => (
                  <Section key={title as string} title={title as string}>
                    <dl className="space-y-1 text-xs">
                      {(rows as [string, unknown][]).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-2">
                          <dt className="text-slate-500">{k}</dt>
                          <dd className="font-semibold tabular-nums">{v == null || v === "" ? "—" : String(v)}</dd>
                        </div>
                      ))}
                    </dl>
                  </Section>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Match-level metrics not in feed for this player yet.</p>
            )}
            {currentSeasonBlock && (
              <Section title={`Season ${currentSeasonBlock.season} · competitions`} dense>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase text-slate-400 text-left">
                        <th className="py-1 font-semibold">Comp</th>
                        <th className="py-1 font-semibold">Team</th>
                        <th className="py-1 font-semibold">App</th>
                        <th className="py-1 font-semibold">G</th>
                        <th className="py-1 font-semibold">A</th>
                        <th className="py-1 font-semibold">Min</th>
                        <th className="py-1 font-semibold">Rtg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentSeasonBlock.competitions.map((row, i) => (
                        <tr key={i} className="border-t border-[var(--border)]">
                          <td className="py-1.5 font-medium">{row.league}</td>
                          <td className="py-1.5 text-slate-600 dark:text-slate-300">{row.team}</td>
                          <td className="py-1.5 tabular-nums">{row.apps ?? "—"}</td>
                          <td className="py-1.5 tabular-nums font-semibold">{row.goals ?? "—"}</td>
                          <td className="py-1.5 tabular-nums">{row.assists ?? "—"}</td>
                          <td className="py-1.5 tabular-nums text-slate-500">{row.minutes ?? "—"}</td>
                          <td className="py-1.5 tabular-nums">{formatRating(row.rating)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}
            {afRows.length === 0 && !currentSeasonBlock && !p.seasonScorer && !p.seasonKeeper && !data?.matchPlayerStats && (
              <p className="text-xs text-slate-500">
                No season stats yet — Sync to load from feed.
              </p>
            )}
            {afRows.length > 0 && !currentSeasonBlock && afRows.map((row, i) => (
              <div
                key={i}
                className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 text-xs space-y-1"
              >
                <div className="font-semibold text-slate-700 dark:text-slate-200">
                  {row.league?.name || "League"}
                  {row.league?.season ? ` · ${row.league.season}` : ""}
                  {row.team?.name ? ` · ${row.team.name}` : ""}
                </div>
                <div>
                  Apps {row.games?.appearences ?? "—"} · Lineups{" "}
                  {row.games?.lineups ?? "—"} · Minutes{" "}
                  {row.games?.minutes ?? "—"}
                  {row.games?.rating != null
                    ? ` · RTG ${formatRating(row.games.rating)}`
                    : ""}
                </div>
                <div>
                  Goals {row.goals?.total ?? "—"} · Assists{" "}
                  {row.goals?.assists ?? "—"}
                  {row.goals?.saves != null ? ` · Saves ${row.goals.saves}` : ""}
                  {row.goals?.conceded != null
                    ? ` · Conceded ${row.goals.conceded}`
                    : ""}
                </div>
                <div>
                  Cards Y{row.cards?.yellow ?? 0} R{row.cards?.red ?? 0}
                </div>
              </div>
            ))}
          </div>
        )}

        {p && tab === "career" && (
          <div className="grid md:grid-cols-[200px_1fr] gap-2.5 min-h-0">
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
              <div className="px-3 py-2 border-b border-[var(--border)] text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Clubs
              </div>
              {careerClubs.length === 0 ? (
                <p className="text-xs text-slate-500 p-3">
                  No club history from AF yet.
                </p>
              ) : (
                <ul className="max-h-[55vh] overflow-y-auto">
                  {careerClubs.map((c, i) => (
                    <li key={`${c.teamId ?? c.name}-${i}`}>
                      <button
                        type="button"
                        onClick={() => setCareerClubIdx(i)}
                        className={cn(
                          "w-full text-left px-3 py-2 border-b border-slate-50 dark:border-slate-900 hover:bg-slate-50 dark:hover:bg-slate-900/50",
                          i === careerClubIdx
                            ? "bg-teal-50/80 dark:bg-teal-950/30"
                            : ""
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {c.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.logo} alt="" className="h-5 w-5 object-contain" />
                          ) : (
                            <span className="h-5 w-5 rounded bg-slate-200 inline-block" />
                          )}
                          <span className="text-xs font-semibold truncate">{c.name}</span>
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-500 tabular-nums">
                          {c.apps ? `${c.apps} apps` : "—"}
                          {c.goals ? ` · ${c.goals}G` : ""}
                          {c.assists ? ` · ${c.assists}A` : ""}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-3">
              {activeCareerClub && (
                <Section title={`${activeCareerClub.name} · club totals`}>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <Fact label="Apps" value={String(activeCareerClub.apps || "—")} />
                    <Fact label="Goals" value={String(activeCareerClub.goals || "—")} />
                    <Fact label="Assists" value={String(activeCareerClub.assists || "—")} />
                  </div>
                  {activeCareerClub.seasons.length > 0 && (
                    <p className="mt-2 text-[10px] text-slate-500">
                      Seasons: {activeCareerClub.seasons.slice(0, 8).join(", ")}
                      {activeCareerClub.seasons.length > 8 ? "…" : ""}
                    </p>
                  )}
                </Section>
              )}

              <Section title={currentSeasonBlock ? `Season ${currentSeasonBlock.season} · competitions` : "Season competitions"}>
                {!currentSeasonBlock ? (
                  <p className="text-xs text-slate-500">
                    No season breakdown available from AF for this player.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[10px] uppercase text-slate-400 text-left">
                          <th className="py-1 font-semibold">Comp</th>
                          <th className="py-1 font-semibold">Team</th>
                          <th className="py-1 font-semibold">App</th>
                          <th className="py-1 font-semibold">G</th>
                          <th className="py-1 font-semibold">A</th>
                          <th className="py-1 font-semibold">Min</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentSeasonBlock.competitions.map((row, i) => (
                          <tr
                            key={i}
                            className="border-t border-[var(--border)]"
                          >
                            <td className="py-1.5 font-medium">{row.league}</td>
                            <td className="py-1.5 text-slate-600 dark:text-slate-300">
                              {row.team}
                            </td>
                            <td className="py-1.5 tabular-nums">{row.apps ?? "—"}</td>
                            <td className="py-1.5 tabular-nums font-semibold">
                              {row.goals ?? "—"}
                            </td>
                            <td className="py-1.5 tabular-nums">{row.assists ?? "—"}</td>
                            <td className="py-1.5 tabular-nums text-slate-500">
                              {row.minutes ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              {careerSeasons.length > 1 && (
                <Section title="Recent seasons">
                  <ul className="space-y-2">
                    {careerSeasons.slice(1, 4).map((block) => {
                      const apps = block.competitions.reduce(
                        (n, c) => n + (c.apps || 0),
                        0
                      );
                      const goals = block.competitions.reduce(
                        (n, c) => n + (c.goals || 0),
                        0
                      );
                      return (
                        <li
                          key={block.season}
                          className="text-xs flex items-center justify-between gap-2"
                        >
                          <span className="font-semibold">{block.season}</span>
                          <span className="text-slate-500">
                            {block.competitions.length} comps · {apps} apps · {goals}G
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </Section>
              )}

              {careerClubs.length === 0 && careerSeasons.length === 0 && (
                <p className="text-xs text-slate-500">
                  Career history is thin for this player in API-Football — nothing to show yet.
                </p>
              )}
            </div>
          </div>
        )}

        {p && tab === "bio" && (
          <div className="space-y-2">
            {bioNotes.length === 0 && notesList.length === 0 ? (
              <p className="text-xs text-slate-500">
                No bio notes yet. Generate packs or add a Bio note.
              </p>
            ) : (
              (bioNotes.length ? bioNotes : notesList).map((n) => (
                <div
                  key={n.id}
                  className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3"
                >
                  <div className="text-xs font-bold mb-1">{n.title}</div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                    {n.body}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {p && tab === "scouting" && (
          <div className="space-y-2">
            {notesList.filter((n) => /scout|hook|report/i.test(n.title || "") || /scout|hook/i.test(n.category || "")).length === 0 ? (
              <p className="text-xs text-slate-500">No scouting notes yet — add hooks/scouting from packs or Notes.</p>
            ) : (
              notesList.filter((n) => /scout|hook|report/i.test(n.title || "") || /scout|hook/i.test(n.category || "")).map((n) => (
                <div key={n.id} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3">
                  <div className="text-xs font-bold mb-1">{n.title}</div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{n.body}</p>
                </div>
              ))
            )}
          </div>
        )}

        {p && tab === "funfact" && (
          <div className="space-y-2">
            {notesList.filter((n) => /fun|fact|trivia/i.test(n.title || "") || /funfact|trivia/i.test(n.category || "")).length === 0 ? (
              <p className="text-xs text-slate-500">No funfacts yet — add a Funfact note when you have one.</p>
            ) : (
              notesList.filter((n) => /fun|fact|trivia/i.test(n.title || "") || /funfact|trivia/i.test(n.category || "")).map((n) => (
                <div key={n.id} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3">
                  <div className="text-xs font-bold mb-1">{n.title}</div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{n.body}</p>
                </div>
              ))
            )}
          </div>
        )}

        {p && tab === "sidelined" && (
          <div className="space-y-3">
            {(data?.injuries?.length || 0) > 0 && (
              <Section title="Match injuries" tone="rose">
                <ul className="space-y-1">
                  {(data?.injuries || []).map((inj) => (
                    <li key={inj.id} className="text-xs">
                      <span className="font-semibold">{inj.injuryType}</span>
                      <span className="text-slate-500"> · {inj.status}</span>
                      {inj.expectedReturn ? <span className="text-slate-500"> · back {inj.expectedReturn}</span> : null}
                    </li>
                  ))}
                </ul>
              </Section>
            )}
            <Section title="Sidelined history">
              {(data?.afSidelined?.length || 0) === 0 ? (
                <p className="text-xs text-slate-500">No sidelined history in feed.</p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {(data?.afSidelined || []).map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-semibold">{s.type}</span>
                      <span className="text-slate-500">{s.start || "?"}{s.end ? ` → ${s.end}` : " → …"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        )}

        {tab === "notes" && (
          <NotesPanel
            matchId={matchId}
            initialNotes={notesList}
            entityType="player"
            entityId={playerId}
            entityLabel={displayName}
          />
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  tone,
  dense,
}: {
  title: string;
  children: ReactNode;
  tone?: "rose";
  dense?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border bg-[var(--surface)]",
        dense ? "p-2.5" : "p-3",
        tone === "rose"
          ? "border-[var(--edge-red)]/35 bg-rose-50/50 dark:bg-rose-950/20"
          : "border-[var(--border)]"
      )}
    >
      <div
        className={cn(
          "text-[10px] font-bold uppercase tracking-wide",
          dense ? "mb-1.5" : "mb-2",
          tone === "rose"
            ? "text-rose-600 dark:text-rose-300"
            : "text-slate-400"
        )}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 dark:bg-slate-900/60 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="font-semibold truncate">{value}</div>
    </div>
  );
}
