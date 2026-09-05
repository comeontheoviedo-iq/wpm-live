"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X, Loader2, BookOpen, Star, User } from "lucide-react";
import { NotesPanel, type NoteRow } from "@/components/notes/notes-panel";
import { EventTimeline } from "@/components/match/event-timeline";
import { cn } from "@/lib/utils";
import {
  flagUrl,
  formatFoot,
  formatRating,
  lastNameOf,
  playerPhotoUrl,
  posCode,
} from "@/lib/flags";

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
};

type Tab = "profile" | "today" | "statistics" | "bio" | "notes";

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
}: {
  matchId: string;
  playerId: string;
  onClose: () => void;
  initialTab?: Tab | "overview" | "stats" | "events";
  initialNotes?: NoteRow[];
  playerName?: string;
}) {
  const mapInitial = (t: string): Tab => {
    if (t === "overview") return "profile";
    if (t === "stats") return "statistics";
    if (t === "events") return "today";
    if (t === "notes") return "notes";
    if (["profile", "today", "statistics", "bio", "notes"].includes(t))
      return t as Tab;
    return "profile";
  };

  const [data, setData] = useState<DossierPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>(mapInitial(initialTab));

  useEffect(() => {
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
  const displayName = p?.name || playerName || "Player dossier";
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
  const rating =
    formatRating(p?.rating) !== "—"
      ? formatRating(p?.rating)
      : formatRating(af?.games?.rating);

  const tabs: { key: Tab; label: string }[] = [
    { key: "profile", label: "Profile" },
    { key: "today", label: "Today's Match" },
    { key: "statistics", label: "Statistics" },
    { key: "bio", label: "Bio" },
    { key: "notes", label: "Notes" },
  ];

  const bioNotes = notesList.filter(
    (n) =>
      /bio/i.test(n.title || "") ||
      /bio/i.test(n.category || "") ||
      /narrative/i.test(n.title || "")
  );
  const profileNotes = notesList.length ? notesList : bioNotes;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-3xl shadow-2xl border-l border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="shrink-0 relative border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-3">
        <div className="flex items-start gap-3">
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
              <h2 className="text-lg font-bold truncate">{displayName}</h2>
              <Star className="h-3.5 w-3.5 text-amber-400" />
            </div>
            {p && (
              <>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Flag nationality={p.nationality} label={`Citizenship: ${p.nationality}`} />
                  {birthCountry &&
                  birthCountry.trim().toLowerCase() !== p.nationality.trim().toLowerCase() ? (
                    <Flag
                      nationality={birthCountry}
                      label={`Country of birth: ${birthCountry}`}
                    />
                  ) : null}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-semibold">{p.club.shortName}</span>
                  <span className="text-slate-300">·</span>
                  <span className="font-bold">#{p.shirtNumber}</span>
                  <span className="rounded bg-slate-100 dark:bg-slate-900 px-1.5 py-px text-[10px] font-bold uppercase">
                    {posCode(p.position)}
                  </span>
                  <span className="text-slate-500">{p.position}</span>
                  {p.isCaptain ? <span className="font-semibold">©</span> : null}
                </div>
                <div className="mt-1 text-[11px] text-slate-500 flex flex-wrap gap-x-3">
                  <span>{p.age != null ? `${p.age} yr` : "— yr"}</span>
                  <span>{cmToFtIn(p.heightCm)}</span>
                  <span>{kgToLbs(p.weightKg)}</span>
                  <span>
                    {p.preferredFoot
                      ? `${p.preferredFoot} Foot`
                      : formatFoot(p.preferredFoot) === "—"
                        ? "Foot —"
                        : `${formatFoot(p.preferredFoot)} Foot`}
                  </span>
                  {rating !== "—" ? <span>RTG {rating}</span> : null}
                </div>
              </>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Player
            </span>
            <button
              type="button"
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={onClose}
              aria-label="Close dossier"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex gap-1 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/50 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-md px-3 py-1.5 text-[11px] font-semibold border whitespace-nowrap",
              tab === t.key
                ? "bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600 shadow-sm"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
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
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-3">
              <Section title="All-time team stats">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase text-slate-400 text-left">
                      <th className="py-1 font-semibold">Team</th>
                      <th className="py-1 font-semibold">App</th>
                      <th className="py-1 font-semibold">G</th>
                      <th className="py-1 font-semibold">A</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-slate-100 dark:border-slate-800">
                      <td className="py-1.5 font-medium">{p.club.name}</td>
                      <td className="py-1.5">
                        <span className="rounded bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 font-bold tabular-nums">
                          {p.appearances || af?.games?.appearences || 0}
                        </span>
                      </td>
                      <td className="py-1.5 tabular-nums font-semibold">
                        {p.goals || af?.goals?.total || 0}
                      </td>
                      <td className="py-1.5 tabular-nums">
                        {p.assists || af?.goals?.assists || 0}
                      </td>
                    </tr>
                  </tbody>
                </table>
                {(p.seasonScorer || p.seasonKeeper) && (
                  <p className="mt-2 text-[11px] text-slate-500">
                    {p.seasonScorer
                      ? `Season scorer #${p.seasonScorer.rank}: ${p.seasonScorer.goals}G ${p.seasonScorer.assists}A`
                      : null}
                    {p.seasonKeeper
                      ? `Keeper #${p.seasonKeeper.rank}: ${p.seasonKeeper.cleanSheets} CS · ${p.seasonKeeper.saves} SV`
                      : null}
                  </p>
                )}
              </Section>

              <Section title="Physical">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Fact label="Age" value={p.age != null ? String(p.age) : "—"} />
                  <Fact
                    label="Height"
                    value={p.heightCm != null ? `${p.heightCm} cm` : "—"}
                  />
                  <Fact
                    label="Weight"
                    value={p.weightKg != null ? `${p.weightKg} kg` : "—"}
                  />
                  <Fact label="Foot" value={p.preferredFoot || "—"} />
                  <Fact label="Born" value={p.birthDate || "—"} />
                  <Fact label="Cards" value={`Y${p.yellowCards} R${p.redCards}`} />
                </div>
              </Section>

              {(data?.injuries?.length ?? 0) > 0 && (
                <Section title="Sidelined" tone="rose">
                  <ul className="space-y-1">
                    {(data?.injuries || []).map((inj) => (
                      <li key={inj.id} className="text-xs">
                        <span className="font-semibold">{inj.injuryType}</span>
                        <span className="text-slate-500"> · {inj.status}</span>
                        {inj.expectedReturn ? (
                          <span className="text-slate-500">
                            {" "}
                            · back {inj.expectedReturn}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {data?.afStub && (
                <p className="text-[10px] text-amber-700 dark:text-amber-300 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/80 dark:bg-amber-950/30 px-2 py-1.5">
                  {data.afStub}
                </p>
              )}
            </div>

            {/* Notes panel — SportsCom right column */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden flex flex-col min-h-[280px]">
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                  <BookOpen className="h-3.5 w-3.5" />
                  Notes
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span>Favorites (0)</span>
                  <button
                    type="button"
                    className="font-semibold text-teal-700 dark:text-teal-300 hover:underline"
                    onClick={() => setTab("notes")}
                  >
                    + Add Note
                  </button>
                </div>
              </div>
              <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[420px]">
                {profileNotes.length === 0 ? (
                  <p className="text-xs text-slate-500 px-1 py-4 text-center">
                    No player notes yet — pack bios/hooks appear here after generate.
                  </p>
                ) : (
                  profileNotes.slice(0, 8).map((n) => (
                    <div
                      key={n.id}
                      className="rounded-lg border border-slate-200 dark:border-slate-800 border-l-[3px] border-l-sky-500 bg-slate-50/80 dark:bg-slate-900/40 px-2.5 py-2"
                    >
                      <div className="text-xs font-semibold truncate">
                        {n.pinned ? "📌 " : ""}
                        {n.title}
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-4 whitespace-pre-wrap">
                        {n.body}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="rounded bg-sky-600 text-white text-[9px] font-bold px-1.5 py-px">
                          Player
                        </span>
                        <span className="text-[9px] text-slate-400">
                          {n.category || "Note"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {p && tab === "today" && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
              This match · {lastNameOf(p.name)}
            </div>
            <EventTimeline
              events={data?.events || []}
              compact
              emptyLabel="No match events for this player yet."
              maxHeightClass="max-h-[60vh]"
            />
          </div>
        )}

        {p && tab === "statistics" && (
          <div className="space-y-3">
            {afRows.length === 0 && !p.seasonScorer && !p.seasonKeeper && (
              <p className="text-xs text-slate-500">
                No season stats yet — Sync to load from API-Football.
              </p>
            )}
            {afRows.map((row, i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3 text-xs space-y-1"
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
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3"
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
}: {
  title: string;
  children: ReactNode;
  tone?: "rose";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3 bg-white dark:bg-slate-950",
        tone === "rose"
          ? "border-rose-200 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-950/20"
          : "border-slate-200 dark:border-slate-800"
      )}
    >
      <div
        className={cn(
          "text-[10px] font-bold uppercase tracking-wide mb-2",
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
