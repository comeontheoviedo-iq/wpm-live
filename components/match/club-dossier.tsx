"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X, Loader2 } from "lucide-react";
import { NotesPanel, type NoteRow } from "@/components/notes/notes-panel";
import { cn } from "@/lib/utils";

type Tab = "overview" | "squad" | "season" | "history" | "notes";

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
    venue: {
      name?: string;
      city?: string;
      capacity?: number | null;
      image?: string | null;
    } | null;
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
  coaches: {
    id: string;
    name: string;
    nationality: string;
    age: number | null;
    role: string;
    photoUrl: string | null;
  }[];
  afCoach: {
    id: number;
    name: string;
    nationality?: string | null;
    age?: number | null;
    photo?: string | null;
  } | null;
  injuries: {
    id: string;
    status: string;
    injuryType: string;
    expectedReturn: string | null;
  }[];
  notes: NoteRow[];
  transfers: {
    date: string;
    type: string | null;
    player: string;
    from: string;
    to: string;
  }[];
  trophies: { league: string; season?: string | null; place?: string | null }[];
  standingsRow: {
    rank: number;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    gd: number;
    points: number;
    form?: string | null;
  } | null;
  schedule: {
    date: string;
    home: string;
    away: string;
    score: string;
    status: string;
  }[];
  afStub: string | null;
};

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "squad", label: "Squad" },
  { key: "season", label: "Season" },
  { key: "history", label: "History" },
  { key: "notes", label: "Notes" },
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
  const [tab, setTab] = useState<Tab>("overview");
  const [expandedPreviewId, setExpandedPreviewId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    setTab("overview");
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
  const bioNotes = notes.filter(
    (n) =>
      /bio|narrative/i.test(n.title || "") || /bio/i.test(n.category || "")
  );
  const funNotes = notes.filter((n) =>
    /fun|fact|trivia/i.test(n.title || "")
  );
  const hookNotes = notes.filter(
    (n) =>
      /hook|scout|verdict|sayable|lead/i.test(n.title || "") ||
      /hook|scout/i.test(n.category || "") ||
      n.pinned
  );

  const sayableNote =
    hookNotes[0] ||
    bioNotes[0] ||
    notes.find((n) => (n.body || "").trim()) ||
    null;
  const sayableLine = sayableNote
    ? (sayableNote.title || "").trim() ||
      (sayableNote.body || "").split("\n")[0].trim()
    : c
      ? [
          c.shortName || c.name,
          c.nickname ? `“${c.nickname}”` : null,
          c.city || null,
          c.founded ? `Est. ${c.founded}` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : "Club";
  const sayableSub = sayableNote?.body
    ? sayableNote.body
        .trim()
        .split("\n")
        .slice(sayableNote.title ? 0 : 1, 2)
        .join(" ")
        .slice(0, 180)
    : data?.standingsRow
      ? `#${data.standingsRow.rank} · ${data.standingsRow.points} pts · ${data.standingsRow.played} MP · GD ${data.standingsRow.gd}${
          data.standingsRow.form ? ` · Form ${data.standingsRow.form}` : ""
        }`
      : null;

  return (
    <div
      className="player-dossier club-dossier"
      data-club-dossier="1"
      data-dossier-kind="club"
      data-dossier-craft="v2"
    >
      <div className="player-dossier-titlebar">
        <div className="player-dossier-title">Club dossier</div>
        <div className="player-dossier-titlebar-actions">
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

      <div className="player-dossier-identity">
        <div className="player-dossier-identity-row">
          {c?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={c.logoUrl}
              alt=""
              className="player-dossier-photo club-dossier-crest"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div
              className="player-dossier-photo player-dossier-photo-fallback"
              style={{
                backgroundColor: c?.primaryColor || "#12161c",
              }}
            />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="player-dossier-name">{c?.name || "Club"}</h2>
            {c ? (
              <div className="player-dossier-meta">
                {c.country ? <span>{c.country}</span> : null}
                {c.city ? (
                  <>
                    <span className="player-dossier-meta-sep" aria-hidden>
                      ·
                    </span>
                    <span>{c.city}</span>
                  </>
                ) : null}
                {c.founded ? (
                  <>
                    <span className="player-dossier-meta-sep" aria-hidden>
                      ·
                    </span>
                    <span className="player-dossier-meta-quiet">
                      Est. {c.founded}
                    </span>
                  </>
                ) : null}
                {c.stadiumName || c.venue?.name ? (
                  <>
                    <span className="player-dossier-meta-sep" aria-hidden>
                      ·
                    </span>
                    <span className="player-dossier-meta-quiet">
                      {c.stadiumName || c.venue?.name}
                    </span>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="player-dossier-tabs" role="tablist">
        {TABS.map((t) => (
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
            {t.key === "notes" ? ` (${notes.length})` : ""}
            {t.key === "squad" && data?.squad?.length
              ? ` (${data.squad.length})`
              : ""}
          </button>
        ))}
      </div>

      <div className="player-dossier-body">
        {loading && (
          <div className="flex items-center gap-2 text-xs text-[#64748b] py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading club dossier…
          </div>
        )}
        {err && <p className="text-xs text-[#f87171]">{err}</p>}

        {!loading && c && tab === "overview" && (
          <div className="player-dossier-overview space-y-3">
            <div className="player-dossier-verdict" data-dossier-verdict="1">
              <div className="player-dossier-verdict-label">Verdict</div>
              <div className="player-dossier-verdict-line">{sayableLine}</div>
              {sayableSub ? (
                <div className="player-dossier-verdict-sub">{sayableSub}</div>
              ) : null}
            </div>

            <div className="player-dossier-overview-cols">
              <Section title="Identity" dense quiet>
                <div className="player-dossier-kv">
                  <Kv
                    label="Founded"
                    value={c.founded ? String(c.founded) : "—"}
                  />
                  <Kv label="City" value={c.city || "—"} />
                  <Kv
                    label="Stadium"
                    value={c.stadiumName || c.venue?.name || "—"}
                  />
                  <Kv
                    label="Capacity"
                    value={
                      c.venue?.capacity != null
                        ? String(c.venue.capacity)
                        : "—"
                    }
                  />
                  <Kv
                    label="Fans"
                    value={
                      c.fansApprox != null ? String(c.fansApprox) : "—"
                    }
                  />
                  <Kv label="Nickname" value={c.nickname || "—"} />
                  <Kv label="Country" value={c.country || "—"} />
                </div>
              </Section>

              <Section title="League" dense quiet>
                {data?.standingsRow ? (
                  <div className="player-dossier-kv">
                    <Kv
                      label="Rank"
                      value={`#${data.standingsRow.rank}`}
                    />
                    <Kv
                      label="Points"
                      value={String(data.standingsRow.points)}
                    />
                    <Kv
                      label="Played"
                      value={String(data.standingsRow.played)}
                    />
                    <Kv
                      label="W-D-L"
                      value={`${data.standingsRow.won}-${data.standingsRow.drawn}-${data.standingsRow.lost}`}
                    />
                    <Kv
                      label="GD"
                      value={String(data.standingsRow.gd)}
                    />
                    <Kv
                      label="Form"
                      value={data.standingsRow.form || "—"}
                    />
                  </div>
                ) : (
                  <p className="text-xs text-[#64748b]">
                    Standings row not in feed for this desk.
                  </p>
                )}
              </Section>
            </div>

            <Section title="Today's match" dense quiet>
              <p className="text-xs text-[#64748b]">
                Match H2H for the club lives on the desk Form/H2H strip. Add
                club notes for talking points.
              </p>
            </Section>

            {data?.afStub ? (
              <p className="text-[10px] text-[#64748b]">{data.afStub}</p>
            ) : null}
          </div>
        )}

        {!loading && c && tab === "squad" && (
          <Section title={`Squad (${data?.squad.length || 0})`}>
            {(data?.squad.length || 0) === 0 ? (
              <p className="text-xs text-[#64748b]">No squad in feed.</p>
            ) : (
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Player</th>
                      <th>Pos</th>
                      <th>App</th>
                      <th>G</th>
                      <th>A</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.squad || []).map((pl) => (
                      <tr key={pl.id}>
                        <td className="muted">{pl.shirtNumber}</td>
                        <td>
                          <button
                            type="button"
                            className="font-semibold text-[#e2e8f0] hover:underline text-left"
                            onClick={() => onPlayerClick?.(pl.id)}
                          >
                            {pl.name}
                            {pl.isCaptain ? " (C)" : ""}
                          </button>
                        </td>
                        <td className="muted">{pl.position}</td>
                        <td>{pl.appearances || "—"}</td>
                        <td className="font-semibold">{pl.goals || "—"}</td>
                        <td>{pl.assists || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}

        {!loading && c && tab === "season" && (
          <div className="space-y-3">
            <Section title="Season snapshot" dense quiet>
              {data?.standingsRow ? (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Fact label="Played" value={String(data.standingsRow.played)} />
                  <Fact
                    label="W-D-L"
                    value={`${data.standingsRow.won}-${data.standingsRow.drawn}-${data.standingsRow.lost}`}
                  />
                  <Fact label="Points" value={String(data.standingsRow.points)} />
                </div>
              ) : (
                <p className="text-xs text-[#64748b]">
                  No statistics row from feed.
                </p>
              )}
            </Section>

            <Section title="Sidelined" dense>
              {(data?.injuries?.length || 0) === 0 ? (
                <p className="text-xs text-[#64748b]">No injuries on file.</p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {(data?.injuries || []).map((i) => (
                    <li key={i.id}>
                      <span className="font-semibold text-[#f87171]">
                        {i.injuryType}
                      </span>
                      <span className="text-[#64748b]"> · {i.status}</span>
                      {i.expectedReturn ? (
                        <span className="text-[#64748b]">
                          {" "}
                          · back {i.expectedReturn}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Recent schedule">
              {(data?.schedule?.length || 0) === 0 ? (
                <p className="text-xs text-[#64748b]">
                  No recent fixtures in feed.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Fixture</th>
                        <th>Score</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.schedule || []).map((fx, i) => (
                        <tr key={i}>
                          <td className="muted">
                            {(fx.date || "").slice(0, 10)}
                          </td>
                          <td className="font-medium">
                            {fx.home} vs {fx.away}
                          </td>
                          <td className="font-semibold">{fx.score}</td>
                          <td className="muted">{fx.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </div>
        )}

        {!loading && c && tab === "history" && (
          <div className="space-y-3">
            <Section title="Trophies">
              {(data?.trophies?.length || 0) === 0 ? (
                <p className="text-xs text-[#64748b]">No trophies in feed.</p>
              ) : (
                <ul className="space-y-1 text-xs max-h-64 overflow-y-auto">
                  {(data?.trophies || []).map((tr, i) => (
                    <li key={i}>
                      <span className="font-semibold text-[#e2e8f0]">
                        {tr.league}
                      </span>
                      {tr.season ? (
                        <span className="text-[#64748b]"> · {tr.season}</span>
                      ) : null}
                      {tr.place ? (
                        <span className="text-[#64748b]"> · {tr.place}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Coaches" dense>
              {data?.afCoach ? (
                <div className="flex items-center gap-3 text-xs mb-3">
                  {data.afCoach.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={data.afCoach.photo}
                      alt=""
                      className="h-12 w-12 rounded-[2px] object-cover object-top border border-white/[0.08]"
                    />
                  ) : null}
                  <div>
                    <div className="font-bold text-sm text-[#e2e8f0]">
                      {data.afCoach.name}
                    </div>
                    <div className="text-[#64748b]">
                      {data.afCoach.nationality || "—"}
                      {data.afCoach.age != null
                        ? ` · ${data.afCoach.age}y`
                        : ""}
                    </div>
                  </div>
                </div>
              ) : null}
              {(data?.coaches?.length || 0) === 0 && !data?.afCoach ? (
                <p className="text-xs text-[#64748b]">No coaches on file.</p>
              ) : (data?.coaches?.length || 0) > 0 ? (
                <ul className="space-y-1 text-xs">
                  {(data?.coaches || []).map((ch) => (
                    <li key={ch.id}>
                      <span className="font-semibold text-[#e2e8f0]">
                        {ch.name}
                      </span>
                      <span className="text-[#64748b]"> · {ch.role}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Section>

            <Section title="Transfers">
              {(data?.transfers?.length || 0) === 0 ? (
                <p className="text-xs text-[#64748b]">No transfers in feed.</p>
              ) : (
                <div className="overflow-x-auto max-h-[40vh]">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Player</th>
                        <th>Move</th>
                        <th>Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.transfers || []).map((tr, i) => (
                        <tr key={i}>
                          <td className="muted">{tr.date}</td>
                          <td className="font-semibold">{tr.player}</td>
                          <td className="muted">
                            {tr.from} → {tr.to}
                          </td>
                          <td className="muted">{tr.type || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            <Section title="Contracts" dense>
              <p className="text-xs text-[#64748b]">
                Contract end dates are not available in the feed — honest empty.
              </p>
            </Section>
          </div>
        )}

        {!loading && c && tab === "notes" && (
          <div className="space-y-3">
            {(bioNotes.length > 0 || funNotes.length > 0) && (
              <div className="space-y-2">
                {[...bioNotes, ...funNotes].slice(0, 4).map((n) => {
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
                    <div className={`text-[11px] font-bold text-[#e2e8f0] mb-0.5 ${open ? "" : "truncate"}`}>
                      {n.title}
                    </div>
                    <p
                      className={`text-[11px] text-[#94a3b8] whitespace-pre-wrap ${open ? "" : "line-clamp-4"}`}
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
              initialNotes={notes}
              entityType="club"
              entityId={clubId}
              entityLabel={c.name}
              fillHeight
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  dense,
  quiet,
}: {
  title: string;
  children: ReactNode;
  dense?: boolean;
  quiet?: boolean;
}) {
  return (
    <div
      className={cn(
        "player-dossier-section",
        dense && "is-dense",
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
