"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X, Loader2, User, Settings2, Volume2, Plus } from "lucide-react";
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
import { SpeakNameButton } from "@/components/match/speak-name-button";
import type { PlayerOverrideRow } from "@/lib/player-overrides";
import { VerdictBlock } from "@/components/match/verdict-block";
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
        teamId?: number | null;
        apps: number | null;
        goals: number | null;
        assists: number | null;
        minutes: number | null;
        rating: string | number | null;
        friendly?: boolean;
      }[];
      total?: {
        apps: number | null;
        goals: number | null;
        assists: number | null;
        minutes: number | null;
      } | null;
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

/** Craft tabs — map legacy Profile/Today/Statistics/Bio/… into these four. */
type Tab = "overview" | "career" | "form" | "notes";

function Flag({ nationality }: { nationality?: string | null }) {
  const src = flagUrl(nationality, 20);
  return (
    <span className="player-dossier-flag" title={nationality || undefined}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" />
      ) : (
        <span className="inline-block h-[0.7rem] w-4 rounded-[1px] bg-[#1a2029]" />
      )}
    </span>
  );
}

export function PlayerDossier({
  matchId,
  playerId,
  onClose,
  initialTab = "overview",
  initialNotes = [],
  playerName,
  initialOverride = null,
  onOverrideChange,
}: {
  matchId: string;
  playerId: string;
  onClose: () => void;
  initialTab?: Tab | "profile" | "today" | "statistics" | "bio" | "scouting" | "funfact" | "sidelined" | "stats" | "events";
  initialNotes?: NoteRow[];
  playerName?: string;
  initialOverride?: PlayerOverrideRow | null;
  onOverrideChange?: (row: PlayerOverrideRow | null) => void;
}) {
  const mapInitial = (t: string): Tab => {
    if (t === "overview" || t === "profile") return "overview";
    if (t === "career" || t === "sidelined") return "career";
    if (t === "form" || t === "today" || t === "statistics" || t === "stats" || t === "events")
      return "form";
    if (t === "notes" || t === "bio" || t === "scouting" || t === "funfact") return "notes";
    return "overview";
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
  const [expandedPreviewId, setExpandedPreviewId] = useState<string | null>(null);

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
    ovDisplayName.trim() || p?.name || playerName || "Player";
  const flagOptions = dualNationalities(p?.nationality, birthCountry);
  const rating =
    formatRating(p?.rating) !== "—"
      ? formatRating(p?.rating)
      : formatRating(af?.games?.rating);
  const isGk = posCode(p?.position || "") === "GK";
  const mps = data?.matchPlayerStats as any;

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
    { key: "overview", label: "Overview" },
    { key: "career", label: "Career" },
    { key: "form", label: "Form" },
    { key: "notes", label: "Notes" },
  ];

  const careerClubs = data?.career?.clubs || [];
  const careerSeasons = data?.career?.seasons || [];
  const activeCareerClub =
    careerClubs[Math.min(careerClubIdx, Math.max(careerClubs.length - 1, 0))] ||
    null;
  const currentSeasonBlock = careerSeasons[0] || null;

  /** Seasons filtered to the active career club (by teamId or name). Soft-empty if none. */
  const clubSeasonBlocks = (() => {
    if (!activeCareerClub) return careerSeasons;
    const tid = activeCareerClub.teamId;
    const name = (activeCareerClub.name || "").trim().toLowerCase();
    const out: typeof careerSeasons = [];
    for (const block of careerSeasons) {
      const competitions = block.competitions.filter((c) => {
        if (tid != null && c.teamId != null) return c.teamId === tid;
        return (c.team || "").trim().toLowerCase() === name;
      });
      if (!competitions.length) continue;
      const competitive = competitions.filter((c) => !c.friendly);
      const sum = (key: "apps" | "goals" | "assists" | "minutes") => {
        let n = 0;
        let any = false;
        for (const c of competitive) {
          const v = c[key];
          if (v != null) {
            n += v;
            any = true;
          }
        }
        return any ? n : null;
      };
      out.push({
        ...block,
        competitions,
        total: competitive.length
          ? {
              apps: sum("apps"),
              goals: sum("goals"),
              assists: sum("assists"),
              minutes: sum("minutes"),
            }
          : null,
      });
    }
    return out;
  })();

  const bioNotes = notesList.filter(
    (n) =>
      /bio/i.test(n.title || "") ||
      /bio/i.test(n.category || "") ||
      /narrative/i.test(n.title || "")
  );
  const hookNotes = notesList.filter(
    (n) =>
      /hook|scout|verdict|sayable|lead/i.test(n.title || "") ||
      /hook|scout/i.test(n.category || "") ||
      n.pinned
  );
  const funNotes = notesList.filter(
    (n) =>
      /fun|fact|trivia/i.test(n.title || "") ||
      /funfact|trivia/i.test(n.category || "")
  );
  const scoutNotes = notesList.filter(
    (n) =>
      /scout|hook|report/i.test(n.title || "") ||
      /scout|hook/i.test(n.category || "")
  );

  const sayableNote =
    hookNotes[0] ||
    bioNotes[0] ||
    notesList.find((n) => (n.body || "").trim()) ||
    null;
  const sayableLine = sayableNote
    ? (sayableNote.title || "").trim() ||
      (sayableNote.body || "").split("\n")[0].trim()
    : p
      ? [
          p.club.shortName || p.club.name,
          `#${p.shirtNumber}`,
          posCode(p.position),
          p.age != null ? `${p.age} y/o` : null,
          p.nationality || null,
        ]
          .filter(Boolean)
          .join(" · ")
      : displayName;
  const sayableSub = sayableNote?.body
    ? sayableNote.body
        .trim()
        .split("\n")
        .slice(sayableNote.title ? 0 : 1, 2)
        .join(" ")
        .slice(0, 180)
    : null;

  async function quickCreateNote(withGemini: boolean) {
    setCreateNoteBusy(true);
    setCreateNoteMsg(null);
    try {
      let body = "";
      let title = `${displayName} note`;
      if (withGemini) {
        const r = await fetch(
          `/api/players/${playerId}/note-draft?matchId=${encodeURIComponent(matchId)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }
        );
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.body) {
          body = String(j.body);
          if (j.title) title = String(j.title);
        } else {
          setCreateNoteMsg(
            j.error || "No factual blurb available — empty note created"
          );
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
      const reload = await fetch(
        `/api/players/${playerId}?matchId=${encodeURIComponent(matchId)}`
      );
      const dj = await reload.json().catch(() => null);
      if (reload.ok && dj) setData(dj);
      if (!createNoteMsg)
        setCreateNoteMsg(
          withGemini && body
            ? "Note created with factual blurb"
            : "Empty note created"
        );
    } catch (e) {
      setCreateNoteMsg(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreateNoteBusy(false);
    }
  }

  const formRows = data?.recentForm || [];

  return (
    <div
      className="player-dossier"
      data-player-dossier="1"
      data-dossier-kind="player"
      data-dossier-craft="v2"
    >
      {/* Title bar — PLAYER DOSSIER + close (no SaaS chrome) */}
      <div className="player-dossier-titlebar">
        <div className="player-dossier-title">Player dossier</div>
        <div className="player-dossier-titlebar-actions">
          <button
            type="button"
            className="player-dossier-icon-btn focus-ring"
            onClick={() => setGearOpen((v) => !v)}
            aria-label="Pitch card overrides"
            title="Name / pronunciation / flag / jersey (this match)"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="player-dossier-icon-btn focus-ring"
            onClick={onClose}
            aria-label="Close dossier"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Identity — large photo, loud condensed name, quiet meta */}
      <div className="player-dossier-identity">
        <div className="player-dossier-identity-row">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt=""
              className="player-dossier-photo"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="player-dossier-photo player-dossier-photo-fallback">
              <User className="h-9 w-9 opacity-70" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2 min-w-0">
              <h2 className="player-dossier-name min-w-0 flex-1">{displayName}</h2>
              <SpeakNameButton
                text={displayName}
                phonetic={ovPronunciation}
                nationality={p?.nationality}
              />
            </div>
            {ovPronunciation.trim() ? (
              <div className="player-dossier-meta-quiet mt-1 text-[11px]">
                🔊 {ovPronunciation.trim()}
              </div>
            ) : null}
            {p && (
              <div className="player-dossier-meta">
                <span className="player-dossier-hash">#{p.shirtNumber}</span>
                <span className="player-dossier-meta-sep" aria-hidden>
                  ·
                </span>
                <span className="player-dossier-age">
                  {p.age != null ? `${p.age} y/o` : "— y/o"}
                </span>
                <Flag nationality={p.nationality} />
                {birthCountry && birthCountry !== p.nationality ? (
                  <Flag nationality={birthCountry} />
                ) : null}
                <span
                  className={cn(
                    "player-dossier-pos",
                    p.isCaptain && "is-captain"
                  )}
                  title={p.position}
                >
                  {p.isCaptain ? "C · " : ""}
                  {posCode(p.position)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {createNoteMsg ? (
        <div className="player-dossier-msg">{createNoteMsg}</div>
      ) : null}

      {gearOpen && (
        <div className="player-dossier-gear space-y-2.5">
          <div className="player-dossier-gear-title">
            Pitch card overrides · this match only
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-[11px] space-y-1">
              <span className="font-semibold">Name on field</span>
              <input
                className="w-full px-2 py-1.5 text-sm"
                placeholder={p ? lastNameOf(p.name) : "Last name"}
                value={ovDisplayName}
                onChange={(e) => setOvDisplayName(e.target.value)}
              />
            </label>
            <label className="block text-[11px] space-y-1">
              <span className="font-semibold">Jersey #</span>
              <input
                type="number"
                min={0}
                max={99}
                className="w-full px-2 py-1.5 text-sm"
                placeholder={p ? String(p.shirtNumber) : "#"}
                value={ovJersey}
                onChange={(e) => setOvJersey(e.target.value)}
              />
            </label>
            <label className="block text-[11px] space-y-1 sm:col-span-2">
              <span className="font-semibold">
                Pronunciation (IPA or phonetic)
              </span>
              <div className="flex gap-1.5">
                <input
                  className="min-w-0 flex-1 px-2 py-1.5 text-sm"
                  placeholder="e.g. YO-han-son"
                  value={ovPronunciation}
                  onChange={(e) => setOvPronunciation(e.target.value)}
                />
                <button
                  type="button"
                  className="player-dossier-action"
                  onClick={speakNow}
                  title="Speak with Web Speech API"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  Speak
                </button>
              </div>
            </label>
            <label className="block text-[11px] space-y-1 sm:col-span-2">
              <span className="font-semibold">Flag on pitch</span>
              <select
                className="w-full px-2 py-1.5 text-sm"
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
              className="player-dossier-gear-save disabled:opacity-50"
            >
              {ovSaving ? "Saving…" : "Save overrides"}
            </button>
            <button
              type="button"
              disabled={ovSaving}
              onClick={() => void saveOverrides(true)}
              className="player-dossier-gear-clear disabled:opacity-50"
            >
              Clear
            </button>
            {ovMsg ? (
              <span className="text-[11px] text-[#94a3b8]">{ovMsg}</span>
            ) : null}
          </div>
        </div>
      )}

      {/* Tabs — Overview | Career | Form | Notes */}
      <div className="player-dossier-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "player-dossier-tab",
              tab === t.key && "is-active"
            )}
          >
            {t.label}
            {t.key === "notes" ? ` (${notesList.length})` : ""}
          </button>
        ))}
      </div>

      <div className="player-dossier-body">
        {loading && tab !== "notes" && (
          <div className="flex items-center gap-2 text-xs text-[#64748b] py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading dossier…
          </div>
        )}
        {error && <p className="text-xs text-[#f87171]">{error}</p>}

        {/* OVERVIEW — verdict → GENERAL / ATTACKING → form chips */}
        {p && tab === "overview" && !loading && (
          <div className="player-dossier-overview space-y-3">
            <VerdictBlock
              line={sayableLine}
              sub={sayableSub}
              fullBody={sayableNote?.body || null}
            />

            <div className="player-dossier-overview-cols">
              <Section title="General" dense quiet>
                <div className="player-dossier-kv">
                  <Kv label="Club" value={p.club.name} />
                  <Kv
                    label="Age"
                    value={p.age != null ? String(p.age) : "—"}
                  />
                  <Kv
                    label="Height"
                    value={formatHeightValue(p.heightCm, heightUnit)}
                  />
                  <Kv
                    label="Weight"
                    value={formatWeightValue(p.weightKg, heightUnit)}
                  />
                  <Kv
                    label="Foot"
                    value={
                      p.preferredFoot
                        ? formatFoot(p.preferredFoot) === "—"
                          ? p.preferredFoot
                          : formatFoot(p.preferredFoot)
                        : "—"
                    }
                  />
                  <Kv label="Born" value={p.birthDate || "—"} />
                  <Kv label="Nation" value={p.nationality || "—"} />
                  <Kv
                    label="Cards"
                    value={`Y${p.yellowCards} R${p.redCards}`}
                  />
                  {data?.transfers?.[0] ? (
                    <Kv
                      label="Transfer"
                      value={`${data.transfers[0].from.name} → ${data.transfers[0].to.name}`}
                      sub={data.transfers[0].date}
                    />
                  ) : (
                    <Kv label="Transfer" value="—" sub="No transfer in feed" />
                  )}
                </div>
              </Section>

              <Section title={isGk ? "Keeping" : "Attacking"} dense quiet>
                <div className="player-dossier-kv">
                  {isGk ? (
                    <>
                      <Kv
                        label="Apps"
                        value={
                          p.seasonKeeper?.appearances != null
                            ? String(p.seasonKeeper.appearances)
                            : p.appearances
                              ? String(p.appearances)
                              : af?.games?.appearences != null
                                ? String(af.games.appearences)
                                : "—"
                        }
                      />
                      <Kv
                        label="Clean sheets"
                        value={
                          p.seasonKeeper?.cleanSheets != null
                            ? String(p.seasonKeeper.cleanSheets)
                            : p.cleanSheets
                              ? String(p.cleanSheets)
                              : "—"
                        }
                      />
                      <Kv
                        label="Saves"
                        value={
                          p.seasonKeeper?.saves != null
                            ? String(p.seasonKeeper.saves)
                            : af?.goals?.saves != null
                              ? String(af.goals.saves)
                              : "—"
                        }
                      />
                      <Kv
                        label="Conceded"
                        value={
                          af?.goals?.conceded != null
                            ? String(af.goals.conceded)
                            : "—"
                        }
                      />
                    </>
                  ) : (
                    <>
                      <Kv
                        label="Goals"
                        value={
                          p.seasonScorer?.goals != null
                            ? String(p.seasonScorer.goals)
                            : p.goals
                              ? String(p.goals)
                              : af?.goals?.total != null
                                ? String(af.goals.total)
                                : "—"
                        }
                      />
                      <Kv
                        label="Assists"
                        value={
                          p.seasonScorer?.assists != null
                            ? String(p.seasonScorer.assists)
                            : p.assists
                              ? String(p.assists)
                              : af?.goals?.assists != null
                                ? String(af.goals.assists)
                                : "—"
                        }
                      />
                      <Kv
                        label="Apps"
                        value={
                          p.appearances
                            ? String(p.appearances)
                            : af?.games?.appearences != null
                              ? String(af.games.appearences)
                              : "—"
                        }
                      />
                    </>
                  )}
                  <Kv label="Rating" value={rating !== "—" ? rating : "—"} />
                  <Kv
                    label="This match"
                    value={
                      mps?.games?.rating != null
                        ? formatRating(mps.games.rating)
                        : "—"
                    }
                    sub={
                      mps?.games?.minutes != null
                        ? `${mps.games.minutes}'`
                        : "no live row"
                    }
                  />
                  <Kv
                    label="Last goal"
                    value={
                      data?.lastGoal
                        ? `${data.lastGoal.goals || 1}G`
                        : "—"
                    }
                    sub={
                      data?.lastGoal
                        ? `${(data.lastGoal.date || "").slice(5, 10)} vs ${data.lastGoal.opponent}`
                        : "none in last 5"
                    }
                  />
                  {currentSeasonBlock ? (
                    <div className="player-dossier-kv-block">
                      <div className="player-dossier-kv-label">
                        Season {currentSeasonBlock.season}
                      </div>
                      {currentSeasonBlock.total ? (
                        <div className="player-dossier-season-total mb-1">
                          <span className="font-semibold text-[#e2e8f0]">TOTAL</span>
                          <span className="tabular-nums text-[#94a3b8]">
                            {currentSeasonBlock.total.apps ?? "—"} app
                            {isGk
                              ? ""
                              : ` · ${currentSeasonBlock.total.goals ?? 0}G · ${currentSeasonBlock.total.assists ?? 0}A`}
                            <span className="text-[#64748b]"> · ex-friendlies</span>
                          </span>
                        </div>
                      ) : null}
                      <ul className="player-dossier-comp-list">
                        {currentSeasonBlock.competitions.slice(0, 5).map((row, i) => (
                          <li key={i}>
                            <span className="truncate">
                              {row.league}
                              {row.friendly ? (
                                <span className="text-[#64748b]"> · F</span>
                              ) : null}
                            </span>
                            <span className="tabular-nums text-[#94a3b8]">
                              {row.apps ?? "—"} app
                              {isGk
                                ? ""
                                : ` · ${row.goals ?? 0}G · ${row.assists ?? 0}A`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#64748b] pt-1">
                      No season breakdown from feed.
                    </p>
                  )}
                </div>
              </Section>
            </div>

            {/* Form chips last on overview */}
            <div className="player-dossier-overview-form">
              <div className="player-dossier-section-title">Form · last 5</div>
              {formRows.length === 0 ? (
                <p className="text-[11px] text-[#64748b]">
                  No recent form rows from feed.
                </p>
              ) : (
                <div className="player-dossier-form-chips">
                  {formRows.map((row, i) => (
                    <span
                      key={i}
                      className={cn(
                        "player-dossier-form-chip",
                        row.result === "W" && "is-w",
                        row.result === "D" && "is-d",
                        row.result === "L" && "is-l"
                      )}
                      title={`${(row.date || "").slice(5, 10)} vs ${row.opponent}${row.league ? ` · ${row.league}` : ""}${row.rating ? ` · ${formatRating(row.rating)}` : ""}`}
                    >
                      {row.result || "·"}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {(data?.injuries?.length ?? 0) > 0 && (
              <Section title="Sidelined" tone="rose" dense>
                <ul className="space-y-0.5">
                  {(data?.injuries || []).map((inj) => (
                    <li key={inj.id} className="text-xs">
                      <span className="font-semibold">{inj.injuryType}</span>
                      <span className="text-[#64748b]"> · {inj.status}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        )}

        {/* CAREER — clubs rail + seasons + transfers + sidelined history */}
        {p && tab === "career" && !loading && (
          <div className="space-y-3">
            <div className="grid md:grid-cols-[200px_1fr] gap-2.5 min-h-0">
              <div className="player-dossier-section !p-0 overflow-hidden">
                <div className="px-3 py-2 border-b border-white/[0.06] player-dossier-section-title !mb-0">
                  Clubs
                </div>
                {careerClubs.length === 0 ? (
                  <p className="text-xs text-[#64748b] p-3">
                    No club history from AF yet.
                  </p>
                ) : (
                  <ul className="max-h-[40vh] overflow-y-auto">
                    {careerClubs.map((c, i) => (
                      <li key={`${c.teamId ?? c.name}-${i}`}>
                        <button
                          type="button"
                          onClick={() => setCareerClubIdx(i)}
                          className={cn(
                            "club-rail-btn",
                            i === careerClubIdx && "is-active"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            {c.logo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={c.logo}
                                alt=""
                                className="h-5 w-5 object-contain"
                              />
                            ) : (
                              <span className="h-5 w-5 rounded-[2px] bg-[#1a2029] inline-block" />
                            )}
                            <span className="text-xs font-semibold truncate text-[#e2e8f0]">
                              {c.name}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[10px] text-[#64748b] tabular-nums">
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
                      <Fact
                        label="Apps"
                        value={String(activeCareerClub.apps || "—")}
                      />
                      <Fact
                        label="Goals"
                        value={String(activeCareerClub.goals || "—")}
                      />
                      <Fact
                        label="Assists"
                        value={String(activeCareerClub.assists || "—")}
                      />
                    </div>
                    <p className="mt-1.5 text-[10px] text-[#64748b]">
                      Totals exclude friendlies
                      {activeCareerClub.seasons.length > 0
                        ? ` · seasons ${activeCareerClub.seasons.slice(0, 8).join(", ")}${activeCareerClub.seasons.length > 8 ? "…" : ""}`
                        : ""}
                    </p>
                  </Section>
                )}

                {clubSeasonBlocks.length === 0 ? (
                  <Section
                    title={
                      activeCareerClub
                        ? `${activeCareerClub.name} · seasons`
                        : "Season competitions"
                    }
                  >
                    <p className="text-xs text-[#64748b]">
                      {activeCareerClub
                        ? "No season rows from AF for this club yet."
                        : "No season breakdown available from AF for this player."}
                    </p>
                  </Section>
                ) : (
                  clubSeasonBlocks.map((block) => (
                    <Section
                      key={block.season}
                      title={
                        activeCareerClub
                          ? `${activeCareerClub.name} · ${block.season}`
                          : `Season ${block.season} · competitions`
                      }
                    >
                      <SeasonCompTable
                        competitions={block.competitions}
                        total={block.total ?? null}
                        isGk={isGk}
                      />
                    </Section>
                  ))
                )}
              </div>
            </div>

            <Section title="Transfers" dense>
              {(data?.transfers?.length || 0) === 0 ? (
                <p className="text-xs text-[#64748b]">
                  No transfer record from feed.
                </p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {(data?.transfers || []).slice(0, 8).map((tr, i) => (
                    <li key={i} className="flex items-center gap-2">
                      {tr.from.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={tr.from.logo}
                          alt=""
                          className="h-4 w-4 object-contain"
                        />
                      ) : null}
                      <span className="truncate text-[#e2e8f0]">
                        {tr.from.name} → {tr.to.name}
                      </span>
                      <span className="text-[#64748b] ml-auto whitespace-nowrap">
                        {tr.date}
                        {tr.type ? ` · ${tr.type}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Sidelined history" dense>
              {(data?.injuries?.length || 0) > 0 && (
                <ul className="space-y-1 mb-2">
                  {(data?.injuries || []).map((inj) => (
                    <li key={inj.id} className="text-xs">
                      <span className="font-semibold text-[#f87171]">
                        {inj.injuryType}
                      </span>
                      <span className="text-[#64748b]"> · {inj.status}</span>
                      {inj.expectedReturn ? (
                        <span className="text-[#64748b]">
                          {" "}
                          · back {inj.expectedReturn}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {(data?.afSidelined?.length || 0) === 0 &&
              (data?.injuries?.length || 0) === 0 ? (
                <p className="text-xs text-[#64748b]">
                  No sidelined history in feed.
                </p>
              ) : (data?.afSidelined?.length || 0) > 0 ? (
                <ul className="space-y-1.5 text-xs">
                  {(data?.afSidelined || []).map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-semibold text-[#e2e8f0]">
                        {s.type}
                      </span>
                      <span className="text-[#64748b]">
                        {s.start || "?"}
                        {s.end ? ` → ${s.end}` : " → …"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Section>

            {careerClubs.length === 0 &&
              careerSeasons.length === 0 &&
              !(data?.transfers?.length || 0) && (
                <p className="text-xs text-[#64748b]">
                  Career history is thin for this player in the feed — nothing
                  to show yet.
                </p>
              )}
          </div>
        )}

        {/* FORM — chips + match table + today's match metrics/events */}
        {p && tab === "form" && !loading && (
          <div className="space-y-3">
            <Section title="Recent form · last 5" dense>
              {formRows.length === 0 ? (
                <p className="text-[11px] text-[#64748b]">
                  No recent form rows from feed.
                </p>
              ) : (
                <>
                  <div className="player-dossier-form-chips">
                    {formRows.map((row, i) => (
                      <span
                        key={i}
                        className={cn(
                          "player-dossier-form-chip",
                          row.result === "W" && "is-w",
                          row.result === "D" && "is-d",
                          row.result === "L" && "is-l"
                        )}
                        title={`${(row.date || "").slice(5, 10)} vs ${row.opponent}${row.league ? ` · ${row.league}` : ""}${row.rating ? ` · ${formatRating(row.rating)}` : ""}`}
                      >
                        {row.result || "·"}
                      </span>
                    ))}
                  </div>
                  <div className="overflow-x-auto">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Opp</th>
                          <th>Comp</th>
                          <th>R</th>
                          <th>H/A</th>
                          <th>Res</th>
                          <th>Rtg</th>
                          <th>XI</th>
                          <th>Min</th>
                          <th>G</th>
                          <th>A</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formRows.map((row, i) => (
                          <tr key={i}>
                            <td className="whitespace-nowrap">
                              {(row.date || "").slice(5, 10)}
                            </td>
                            <td className="max-w-[6.5rem] truncate">
                              {row.opponent}
                            </td>
                            <td
                              className="max-w-[7.5rem] truncate text-[#94a3b8]"
                              title={row.league || undefined}
                            >
                              {row.league || "—"}
                            </td>
                            <td
                              className={cn(
                                "font-bold",
                                row.result === "W" && "text-[#34d399]",
                                row.result === "L" && "text-[#f87171]"
                              )}
                            >
                              {row.result || "—"}
                            </td>
                            <td>{row.homeAway || "—"}</td>
                            <td>{row.score}</td>
                            <td className="font-semibold">
                              {row.rating ? formatRating(row.rating) : "—"}
                            </td>
                            <td>
                              {row.started === true
                                ? "XI"
                                : row.started === false
                                  ? "SUB"
                                  : "—"}
                            </td>
                            <td>{row.minutes ?? "—"}</td>
                            <td>{row.goals || "—"}</td>
                            <td>{row.assists || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Section>

            <Section title="Today's match" dense>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                {[
                  [
                    "Rating",
                    mps?.games?.rating != null
                      ? formatRating(mps.games.rating)
                      : "—",
                  ],
                  ["Minutes", mps?.games?.minutes ?? "—"],
                  ["Goals", mps?.goals?.total ?? "—"],
                  ["Assists", mps?.goals?.assists ?? "—"],
                  ["Shots", mps?.shots?.total ?? "—"],
                  ["SoT", mps?.shots?.on ?? "—"],
                  ["Key pass", mps?.passes?.key ?? "—"],
                  ["Tackles", mps?.tackles?.total ?? "—"],
                ].map(([label, val]) => (
                  <div
                    key={label as string}
                    className="player-dossier-stat-chip text-center"
                  >
                    <div className="player-dossier-stat-chip-label">
                      {label}
                    </div>
                    <div className="player-dossier-stat-chip-value">
                      {val as any}
                    </div>
                  </div>
                ))}
              </div>
              {!mps ? (
                <p className="text-[11px] text-[#64748b] mb-2">
                  Match metrics not in feed yet — events below still update
                  live.
                </p>
              ) : null}
              <div className="player-dossier-section-title !mb-1.5">
                Events · {lastNameOf(p.name)}
                {data?.opponentClub ? ` vs ${data.opponentClub.name}` : ""}
              </div>
              <EventTimeline
                events={data?.events || []}
                compact
                emptyLabel="No match events for this player yet."
                maxHeightClass="max-h-[36vh]"
              />
            </Section>

            {data?.matchPlayerStats ? (
              <div className="grid md:grid-cols-3 gap-2.5">
                {(
                  [
                    [
                      "Offensive",
                      [
                        ["Shots on target", mps?.shots?.on],
                        ["Shots total", mps?.shots?.total],
                        ["Key passes", mps?.passes?.key],
                        ["Pass accuracy", mps?.passes?.accuracy],
                      ],
                    ],
                    [
                      "Defensive",
                      [
                        ["Tackles", mps?.tackles?.total],
                        ["Interceptions", mps?.tackles?.interceptions],
                        ["Blocks", mps?.tackles?.blocks],
                        ["Fouls", mps?.fouls?.committed],
                      ],
                    ],
                    [
                      "Overall",
                      [
                        ["Passes", mps?.passes?.total],
                        ["Duels won", mps?.duels?.won],
                        ["Duels total", mps?.duels?.total],
                        ["Yellow", mps?.cards?.yellow],
                      ],
                    ],
                  ] as [string, [string, unknown][]][]
                ).map(([title, rows]) => (
                  <Section key={title} title={title} dense>
                    <dl className="space-y-1 text-xs">
                      {rows.map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-2">
                          <dt className="text-[#64748b]">{k}</dt>
                          <dd className="font-semibold tabular-nums text-[#e2e8f0]">
                            {v == null || v === "" ? "—" : String(v)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </Section>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {/* NOTES — panel + quiet create; absorbs Bio / Scouting / Funfact */}
        {tab === "notes" && (
          <div className="space-y-3">
            <div className="player-dossier-notes-actions">
              <button
                type="button"
                disabled={createNoteBusy}
                className="player-dossier-action disabled:opacity-50"
                onClick={() => void quickCreateNote(false)}
                title="Quick-add empty note"
              >
                <Plus className="h-3 w-3" />
                Note
              </button>
              <button
                type="button"
                disabled={createNoteBusy}
                className="player-dossier-action disabled:opacity-50"
                onClick={() => void quickCreateNote(true)}
                title="Create note with one factual blurb from research/AF only (no invention)"
              >
                + Fill
              </button>
              <span className="text-[10px] text-[#64748b]">
                Bio / scouting / funfact packs land here.
              </span>
            </div>

            {(bioNotes.length > 0 ||
              scoutNotes.length > 0 ||
              funNotes.length > 0) && (
              <div className="space-y-2">
                {[...bioNotes, ...scoutNotes, ...funNotes]
                  .filter(
                    (n, i, arr) => arr.findIndex((x) => x.id === n.id) === i
                  )
                  .slice(0, 8)
                  .map((n) => {
                    const open = expandedPreviewId === n.id;
                    return (
                    <div
                      key={n.id}
                      className="note-preview note-preview-expandable"
                      role="button"
                      tabIndex={0}
                      aria-expanded={open}
                      title={open ? "Collapse note" : "Expand full note"}
                      onClick={() =>
                        setExpandedPreviewId((cur) => (cur === n.id ? null : n.id))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setExpandedPreviewId((cur) =>
                            cur === n.id ? null : n.id
                          );
                        }
                      }}
                    >
                      <div className={`text-[11px] font-semibold text-[#f1f5f9] ${open ? "whitespace-normal" : "truncate"}`}>
                        {n.pinned ? "📌 " : ""}
                        {n.title}
                      </div>
                      <p
                        className={`text-[10px] text-[#94a3b8] mt-0.5 whitespace-pre-wrap ${open ? "" : "line-clamp-4"}`}
                      >
                        {n.body}
                      </p>
                      <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#64748b]">
                        {open ? "Collapse" : "Expand"}
                      </div>
                    </div>
                    );
                  })}
              </div>
            )}

            <NotesPanel
              matchId={matchId}
              initialNotes={notesList}
              entityType="player"
              entityId={playerId}
              entityLabel={displayName}
            />
          </div>
        )}
      </div>
    </div>
  );
}

type CompRow = {
  league: string;
  team: string;
  apps: number | null;
  goals: number | null;
  assists: number | null;
  minutes: number | null;
  friendly?: boolean;
};

function SeasonCompTable({
  competitions,
  total,
  isGk,
}: {
  competitions: CompRow[];
  total: {
    apps: number | null;
    goals: number | null;
    assists: number | null;
    minutes: number | null;
  } | null;
  isGk: boolean;
}) {
  if (!competitions.length) {
    return (
      <p className="text-xs text-[#64748b]">No competition rows in feed.</p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table data-season-comp-table="1">
        <thead>
          <tr>
            <th>Comp</th>
            <th>Team</th>
            <th>App</th>
            {!isGk ? <th>G</th> : null}
            {!isGk ? <th>A</th> : null}
            <th>Min</th>
          </tr>
        </thead>
        <tbody>
          {competitions.map((row, i) => (
            <tr
              key={i}
              className={row.friendly ? "is-friendly opacity-70" : undefined}
            >
              <td className="font-medium">
                {row.league}
                {row.friendly ? (
                  <span className="ml-1 text-[10px] font-normal text-[#64748b]">
                    F
                  </span>
                ) : null}
              </td>
              <td className="muted">{row.team}</td>
              <td>{row.apps ?? "—"}</td>
              {!isGk ? (
                <td className="font-semibold">{row.goals ?? "—"}</td>
              ) : null}
              {!isGk ? <td>{row.assists ?? "—"}</td> : null}
              <td className="muted">{row.minutes ?? "—"}</td>
            </tr>
          ))}
          {total ? (
            <tr className="season-total-row" data-season-total="1">
              <td className="font-bold text-[#e2e8f0]">TOTAL</td>
              <td className="muted text-[10px]">ex-friendlies</td>
              <td className="font-bold">{total.apps ?? "—"}</td>
              {!isGk ? (
                <td className="font-bold">{total.goals ?? "—"}</td>
              ) : null}
              {!isGk ? (
                <td className="font-bold">{total.assists ?? "—"}</td>
              ) : null}
              <td className="muted font-semibold">{total.minutes ?? "—"}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}


function Section({
  title,
  children,
  tone,
  dense,
  quiet,
}: {
  title: string;
  children: ReactNode;
  tone?: "rose";
  dense?: boolean;
  quiet?: boolean;
}) {
  return (
    <div
      className={cn(
        "player-dossier-section",
        dense && "is-dense",
        tone === "rose" && "is-rose",
        quiet && "is-quiet"
      )}
    >
      <div className="player-dossier-section-title">{title}</div>
      {children}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="player-dossier-fact">
      <div className="player-dossier-fact-label">{label}</div>
      <div className="player-dossier-fact-value truncate">{value}</div>
    </div>
  );
}

function Kv({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="player-dossier-kv-row">
      <span className="player-dossier-kv-label">{label}</span>
      <span className="player-dossier-kv-value">
        <span className="truncate">{value}</span>
        {sub ? <span className="player-dossier-kv-sub">{sub}</span> : null}
      </span>
    </div>
  );
}
