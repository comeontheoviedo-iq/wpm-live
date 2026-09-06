"use client";

import { useEffect, useState } from "react";
import { X, Loader2, BookOpen } from "lucide-react";
import { NotesPanel, type NoteRow } from "@/components/notes/notes-panel";
import { cn } from "@/lib/utils";

type Tab =
  | "profile"
  | "today"
  | "statistics"
  | "career"
  | "squad"
  | "bio"
  | "funfact"
  | "sidelined"
  | "coaches"
  | "transfers"
  | "contracts"
  | "schedule";

type Payload = {
  club: {
    id: string;
    name: string;
    shortName: string;
    primaryColor: string;
    founded: number | null;
    city: string | null;
    stadiumName: string | null;
    nickname: string | null;
    fansApprox: number | null;
    logoUrl: string | null;
    country: string | null;
    venue: { name?: string; city?: string; capacity?: number | null; image?: string | null } | null;
  };
  squad: {
    id: string;
    name: string;
    shirtNumber: number;
    position: string;
    nationality: string;
    age: number | null;
    isCaptain: boolean;
    goals: number;
    assists: number;
    appearances: number;
  }[];
  coaches: { id: string; name: string; nationality: string; age: number | null; role: string; photoUrl: string | null }[];
  afCoach: { id: number; name: string; nationality?: string | null; age?: number | null; photo?: string | null } | null;
  injuries: { id: string; status: string; injuryType: string; expectedReturn: string | null }[];
  notes: NoteRow[];
  transfers: { date: string; type: string | null; player: string; from: string; to: string }[];
  trophies: { league: string; season?: string | null; place?: string | null }[];
  standingsRow: {
    rank: number; played: number; won: number; drawn: number; lost: number; gd: number; points: number; form?: string | null;
  } | null;
  schedule: { date: string; home: string; away: string; score: string; status: string }[];
  afStub: string | null;
};

const TABS: { key: Tab; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "today", label: "Today's Match" },
  { key: "statistics", label: "Statistics" },
  { key: "career", label: "Career" },
  { key: "squad", label: "Squad" },
  { key: "bio", label: "Bio" },
  { key: "funfact", label: "Funfact" },
  { key: "sidelined", label: "Sidelined" },
  { key: "coaches", label: "Coaches" },
  { key: "transfers", label: "Transfers" },
  { key: "contracts", label: "Contracts" },
  { key: "schedule", label: "Schedule" },
];

export function ClubDossier({
  matchId,
  clubId,
  onClose,
  onPlayerClick,
}: {
  matchId: string;
  clubId: string;
  onClose: () => void;
  onPlayerClick?: (playerId: string) => void;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("profile");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/clubs/${clubId}?matchId=${encodeURIComponent(matchId)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Failed");
        if (!cancelled) setData(j);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clubId, matchId]);

  const c = data?.club;
  const notes = data?.notes || [];
  const bioNotes = notes.filter((n) => /bio|narrative/i.test(n.title || "") || /bio/i.test(n.category || ""));
  const funNotes = notes.filter((n) => /fun|fact|trivia/i.test(n.title || ""));

  return (
    <div data-desk-focus="dossier" className="fixed inset-y-0 right-0 z-50 flex w-full max-w-4xl flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-lg animate-slide-up">
      <div className="modal-header-shell shrink-0 px-4 py-3">
        {c?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.logoUrl} alt="" className="crest-watermark" />
        ) : null}
        <div className="relative flex items-start gap-3">
          {c?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.logoUrl} alt="" className="h-16 w-16 object-contain" />
          ) : (
            <div className="h-16 w-16 rounded-md" style={{ backgroundColor: c?.primaryColor || "#0d9488" }} />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-black tracking-tight">{c?.name || "Club"}</h2>
            <div className="mt-1 text-xs text-[var(--muted-foreground)] flex flex-wrap gap-x-3 gap-y-1">
              {c?.country ? <span>{c.country}</span> : null}
              {c?.city ? <span>{c.city}</span> : null}
              {c?.founded ? <span>Est. {c.founded}</span> : null}
              {c?.stadiumName || c?.venue?.name ? (
                <span>{c?.stadiumName || c?.venue?.name}</span>
              ) : null}
              {c?.nickname ? <span>“{c.nickname}”</span> : null}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] font-bold uppercase tracking-[var(--tracking-label)] text-[var(--muted)]">Club</span>
            <button type="button" className="focus-ring interactive-press p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--surface-muted)]" onClick={onClose}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="shrink-0 flex gap-1 overflow-x-auto border-b border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "tab-chip focus-ring rounded-md border px-2.5 py-1.5 text-[11px] font-semibold whitespace-nowrap",
              tab === t.key
                ? "border-[var(--border-strong)] bg-[var(--surface)] shadow-xs"
                : "border-transparent text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {loading && (
          <div className="flex items-center justify-center gap-2 text-xs text-[var(--muted)] py-10">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading club dossier…
          </div>
        )}
        {err && <p className="text-xs text-[var(--live)]">{err}</p>}

        {!loading && c && (
          <div className="grid lg:grid-cols-2 gap-3">
            <div className="space-y-3">
              {tab === "profile" && (
                <>
                  <Card title="Identity">
                    <dl className="grid grid-cols-2 gap-2 text-xs">
                      <Fact label="Founded" value={c.founded ? String(c.founded) : "—"} />
                      <Fact label="City" value={c.city || "—"} />
                      <Fact label="Stadium" value={c.stadiumName || c.venue?.name || "—"} />
                      <Fact label="Capacity" value={c.venue?.capacity != null ? String(c.venue.capacity) : "—"} />
                      <Fact label="Fans" value={c.fansApprox != null ? String(c.fansApprox) : "—"} />
                      <Fact label="Nickname" value={c.nickname || "—"} />
                    </dl>
                  </Card>
                  {data?.standingsRow ? (
                    <Card title="League position">
                      <p className="text-xs">
                        #{data.standingsRow.rank} · {data.standingsRow.points} pts · {data.standingsRow.played} MP · GD {data.standingsRow.gd}
                        {data.standingsRow.form ? ` · Form ${data.standingsRow.form}` : ""}
                      </p>
                    </Card>
                  ) : (
                    <Card title="League position">
                      <p className="text-xs text-[var(--muted)]">Standings row not in feed for this desk.</p>
                    </Card>
                  )}
                  {data?.afStub ? <p className="text-[10px] text-[var(--muted)]">{data.afStub}</p> : null}
                </>
              )}

              {tab === "today" && (
                <Card title="Today's match context">
                  <p className="text-xs text-[var(--muted)]">
                    Match H2H for the club lives on the desk Form/H2H strip. Add club notes here for talking points.
                  </p>
                </Card>
              )}

              {tab === "statistics" && (
                <Card title="Season snapshot">
                  {data?.standingsRow ? (
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <Fact label="Played" value={String(data.standingsRow.played)} />
                      <Fact label="W-D-L" value={`${data.standingsRow.won}-${data.standingsRow.drawn}-${data.standingsRow.lost}`} />
                      <Fact label="Points" value={String(data.standingsRow.points)} />
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--muted)]">No statistics row from feed.</p>
                  )}
                </Card>
              )}

              {tab === "career" && (
                <Card title="Trophies">
                  {(data?.trophies?.length || 0) === 0 ? (
                    <p className="text-xs text-[var(--muted)]">No trophies in feed.</p>
                  ) : (
                    <ul className="space-y-1 text-xs max-h-80 overflow-y-auto">
                      {(data?.trophies || []).map((tr, i) => (
                        <li key={i}>
                          <span className="font-semibold">{tr.league}</span>
                          {tr.season ? <span className="text-[var(--muted)]"> · {tr.season}</span> : null}
                          {tr.place ? <span className="text-[var(--muted)]"> · {tr.place}</span> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              )}

              {tab === "squad" && (
                <Card title={`Squad (${data?.squad.length || 0})`}>
                  <ul className="max-h-[60vh] overflow-y-auto divide-y divide-[var(--border)]">
                    {(data?.squad || []).map((pl) => (
                      <li key={pl.id}>
                        <button
                          type="button"
                          className="w-full text-left px-1 py-1.5 text-xs hover:bg-[var(--surface-muted)] flex items-center gap-2"
                          onClick={() => onPlayerClick?.(pl.id)}
                        >
                          <span className="w-6 tabular-nums text-[var(--muted)]">#{pl.shirtNumber}</span>
                          <span className="font-semibold flex-1 truncate">{pl.name}{pl.isCaptain ? " (C)" : ""}</span>
                          <span className="text-[var(--muted)]">{pl.position}</span>
                          <span className="tabular-nums text-[var(--muted)]">{pl.goals}G</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {tab === "bio" && (
                <NotesList notes={bioNotes} empty="No club bio notes yet." />
              )}
              {tab === "funfact" && (
                <NotesList notes={funNotes} empty="No club funfacts yet." />
              )}

              {tab === "sidelined" && (
                <Card title="Injuries / sidelined">
                  {(data?.injuries?.length || 0) === 0 ? (
                    <p className="text-xs text-[var(--muted)]">No injuries on file.</p>
                  ) : (
                    <ul className="space-y-1 text-xs">
                      {(data?.injuries || []).map((i) => (
                        <li key={i.id}>
                          <span className="font-semibold">{i.injuryType}</span>
                          <span className="text-[var(--muted)]"> · {i.status}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              )}

              {tab === "coaches" && (
                <Card title="Coaches">
                  {data?.afCoach ? (
                    <div className="flex items-center gap-3 text-xs mb-3">
                      {data.afCoach.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={data.afCoach.photo} alt="" className="h-12 w-12 rounded object-cover object-top" />
                      ) : null}
                      <div>
                        <div className="font-bold text-sm">{data.afCoach.name}</div>
                        <div className="text-[var(--muted)]">
                          {data.afCoach.nationality || "—"}
                          {data.afCoach.age != null ? ` · ${data.afCoach.age}y` : ""}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {(data?.coaches?.length || 0) === 0 && !data?.afCoach ? (
                    <p className="text-xs text-[var(--muted)]">No coaches on file.</p>
                  ) : (
                    <ul className="space-y-1 text-xs">
                      {(data?.coaches || []).map((ch) => (
                        <li key={ch.id}>
                          <span className="font-semibold">{ch.name}</span>
                          <span className="text-[var(--muted)]"> · {ch.role}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              )}

              {tab === "transfers" && (
                <Card title="Transfers">
                  {(data?.transfers?.length || 0) === 0 ? (
                    <p className="text-xs text-[var(--muted)]">No transfers in feed.</p>
                  ) : (
                    <ul className="space-y-1.5 text-xs max-h-[60vh] overflow-y-auto">
                      {(data?.transfers || []).map((tr, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="tabular-nums text-[var(--muted)] w-20 shrink-0">{tr.date}</span>
                          <span className="font-semibold shrink-0">{tr.player}</span>
                          <span className="truncate text-[var(--muted-foreground)]">{tr.from} → {tr.to}</span>
                          <span className="text-[var(--muted)] shrink-0">{tr.type || ""}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              )}

              {tab === "contracts" && (
                <Card title="Contracts">
                  <p className="text-xs text-[var(--muted)]">
                    Contract end dates are not available in the feed — honest empty.
                  </p>
                </Card>
              )}

              {tab === "schedule" && (
                <Card title="Recent schedule">
                  {(data?.schedule?.length || 0) === 0 ? (
                    <p className="text-xs text-[var(--muted)]">No recent fixtures in feed.</p>
                  ) : (
                    <ul className="space-y-1.5 text-xs">
                      {(data?.schedule || []).map((fx, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="tabular-nums text-[var(--muted)] w-24 shrink-0">{(fx.date || "").slice(0, 10)}</span>
                          <span className="flex-1 truncate">{fx.home} vs {fx.away}</span>
                          <span className="tabular-nums font-semibold">{fx.score}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              )}
            </div>

            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden flex flex-col min-h-[160px] max-h-[420px]">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b text-xs font-bold uppercase tracking-wide">
                <BookOpen className="h-3.5 w-3.5" /> Notes
              </div>
              <div className="p-2 flex-1 min-h-0">
                <NotesPanel
                  matchId={matchId}
                  initialNotes={notes}
                  entityType="club"
                  entityId={clubId}
                  entityLabel={c.name}
                  fillHeight
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2.5">
      <div className="text-desk-label text-[var(--muted)] mb-1.5">{title}</div>
      {children}
    </div>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-sm)] bg-[var(--surface-muted)] px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-[var(--tracking-label)] text-[var(--muted)] font-semibold">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
function NotesList({ notes, empty }: { notes: NoteRow[]; empty: string }) {
  if (!notes.length) return <p className="text-xs text-[var(--muted)]">{empty}</p>;
  return (
    <div className="space-y-2">
      {notes.map((n) => (
        <div key={n.id} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3">
          <div className="text-xs font-bold mb-1">{n.title}</div>
          <p className="text-xs text-[var(--muted-foreground)] whitespace-pre-wrap">{n.body}</p>
        </div>
      ))}
    </div>
  );
}
