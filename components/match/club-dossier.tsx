"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X, Loader2, Trophy } from "lucide-react";
import { SpeakNameButton } from "@/components/match/speak-name-button";
import { NotesPanel, type NoteRow } from "@/components/notes/notes-panel";
import { cn } from "@/lib/utils";
import { formatTransferFee } from "@/lib/transfer-fee";
import { VerdictBlock } from "@/components/match/verdict-block";
import { deskVenueName } from "@/lib/venue-name";

type Tab =
  | "overview"
  | "squad"
  | "season"
  | "history"
  | "transfers"
  | "notes";

type ScheduleRow = {
  id: number | null;
  date: string;
  home: string;
  away: string;
  score: string;
  status: string;
  competition: string | null;
};

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
  formerCoaches?: {
    id: number;
    name: string;
    nationality?: string | null;
    photo?: string | null;
    start?: string | null;
    end?: string | null;
  }[];
  injuries: {
    id: string;
    status: string;
    injuryType: string;
    expectedReturn: string | null;
    playerName?: string;
    shirtNumber?: number | null;
  }[];
  notes: NoteRow[];
  transfers: {
    date: string;
    type: string | null;
    player: string;
    from: string;
    to: string;
  }[];
  trophies: {
    league: string;
    season?: string | null;
    place?: string | null;
    country?: string | null;
  }[];
  wonTrophies?: {
    league: string;
    season?: string | null;
    place?: string | null;
    country?: string | null;
  }[];
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
  schedule: ScheduleRow[];
  competitions?: {
    name: string;
    results: {
      id: number | null;
      date: string;
      home: string;
      away: string;
      score: string;
      status: string;
    }[];
  }[];
  afStub: string | null;
};

type PopupScorer = {
  minute: number | null;
  extra: number | null;
  team: string | null;
  player: string | null;
  assist: string | null;
  detail: string | null;
};

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "squad", label: "Squad" },
  { key: "season", label: "Season" },
  { key: "history", label: "History" },
  { key: "transfers", label: "Transfers" },
  { key: "notes", label: "Notes" },
];

export function ClubDossier({
  matchId,
  clubId,
  onClose,
  onPlayerClick,
  embedded = false,
}: {
  matchId: string;
  clubId: string;
  onClose: () => void;
  onPlayerClick?: (playerId: string) => void;
  embedded?: boolean;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [expandedPreviewId, setExpandedPreviewId] = useState<string | null>(
    null
  );
  const [selectedFx, setSelectedFx] = useState<ScheduleRow | null>(null);
  const [fxScorers, setFxScorers] = useState<PopupScorer[] | null>(null);
  const [fxLoading, setFxLoading] = useState(false);

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

  useEffect(() => {
    if (!selectedFx?.id) {
      setFxScorers(null);
      return;
    }
    let cancelled = false;
    setFxLoading(true);
    fetch(`/api/football/fixtures/${selectedFx.id}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Unavailable");
        return j as { scorers?: PopupScorer[] };
      })
      .then((j) => {
        if (!cancelled) setFxScorers(Array.isArray(j.scorers) ? j.scorers : []);
      })
      .catch(() => {
        if (!cancelled) setFxScorers([]);
      })
      .finally(() => {
        if (!cancelled) setFxLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedFx?.id]);

  const c = data?.club;
  const notes = data?.notes || [];
  const bioNotes = notes.filter(
    (n) =>
      /bio|narrative/i.test(n.title || "") || /bio/i.test(n.category || "")
  );
  const funNotes = notes.filter((n) => /fun|fact|trivia/i.test(n.title || ""));
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

  const won = data?.wonTrophies?.length
    ? data.wonTrophies
    : (data?.trophies || []).filter((t) =>
        /^(winner|champion|1st|first|winners)$/i.test((t.place || "").trim())
      );

  const notesOverviewBlock = (
    <NotesPanel
      matchId={matchId}
      initialNotes={notes}
      entityType="club"
      entityId={clubId}
      entityLabel={c?.name || "Club"}
      readOnly
    />
  );

  const notesBlock = (
    <div className="space-y-2">
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
                <div
                  className={`text-[11px] font-bold text-[#e2e8f0] mb-0.5 ${open ? "" : "truncate"}`}
                >
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
        entityLabel={c?.name || "Club"}
        fillHeight
      />
    </div>
  );

  return (
    <div
      className="player-dossier club-dossier"
      data-club-dossier="1"
      data-dossier-kind="club"
      data-dossier-craft="v2"
      data-embedded={embedded ? "1" : undefined}
    >
      <div className="player-dossier-titlebar">
        <div className="player-dossier-title">Club dossier</div>
        <div className="player-dossier-titlebar-actions">
          {!embedded ? (
            <button
              type="button"
              className="player-dossier-icon-btn focus-ring"
              onClick={onClose}
              aria-label="Close dossier"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
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
            <div className="flex items-start gap-2 min-w-0">
              <h2 className="player-dossier-name min-w-0 flex-1">
                {c?.name || "Club"}
              </h2>
              <SpeakNameButton
                text={c?.name || c?.shortName || "Club"}
                nationality={c?.country}
              />
            </div>
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
                      {c.stadiumName ||
                        deskVenueName(c.venue?.name) ||
                        c.venue?.name}
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
            {t.key === "transfers" && data?.transfers?.length
              ? ` (${data.transfers.length})`
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
            <VerdictBlock
              line={sayableLine}
              sub={sayableSub}
              fullBody={sayableNote?.body || null}
            />

            <Section title={`Notes (${notes.length})`} dense>
              {notes.length === 0 ? (
                <p className="text-xs text-[#64748b]">
                  No club notes linked yet.
                </p>
              ) : (
                notesOverviewBlock
              )}
            </Section>

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
                    value={
                      c.stadiumName ||
                      deskVenueName(c.venue?.name) ||
                      c.venue?.name ||
                      "—"
                    }
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
                    <Kv label="GD" value={String(data.standingsRow.gd)} />
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

            <Section title="Other competitions" dense>
              {(data?.competitions?.length || 0) === 0 ? (
                <p className="text-xs text-[#64748b]">
                  No other competition results in feed yet.
                </p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {(data?.competitions || []).map((comp) => (
                    <li key={comp.name}>
                      <div className="font-semibold text-[#e2e8f0] mb-0.5">
                        {comp.name}
                      </div>
                      <ul className="space-y-0.5 text-[#94a3b8]">
                        {comp.results.slice(0, 4).map((r, i) => (
                          <li key={i}>
                            {(r.date || "").slice(0, 10)} · {r.home} {r.score}{" "}
                            {r.away}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
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
                  <Fact
                    label="Played"
                    value={String(data.standingsRow.played)}
                  />
                  <Fact
                    label="W-D-L"
                    value={`${data.standingsRow.won}-${data.standingsRow.drawn}-${data.standingsRow.lost}`}
                  />
                  <Fact
                    label="Points"
                    value={String(data.standingsRow.points)}
                  />
                </div>
              ) : (
                <p className="text-xs text-[#64748b]">
                  No statistics row from feed.
                </p>
              )}
            </Section>

            <Section title="Unavailable" dense>
              {(data?.injuries?.length || 0) === 0 ? (
                <p className="text-xs text-[#64748b]">No injuries on file.</p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {(data?.injuries || []).map((i) => (
                    <li key={i.id}>
                      <span className="font-semibold text-[#e2e8f0]">
                        {i.shirtNumber ? `#${i.shirtNumber} ` : ""}
                        {i.playerName || "—"}
                      </span>
                      <span className="text-[#f87171]">
                        {" "}
                        · {i.injuryType || "—"}
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
                        <th>Comp</th>
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
                          <td className="muted">{fx.competition || "—"}</td>
                          <td className="font-medium">
                            {fx.id ? (
                              <button
                                type="button"
                                className="hover:underline text-left text-[#e2e8f0]"
                                onClick={() => setSelectedFx(fx)}
                              >
                                {fx.home} vs {fx.away}
                              </button>
                            ) : (
                              `${fx.home} vs ${fx.away}`
                            )}
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
            <Section title="Competitions won">
              {won.length === 0 ? (
                <p className="text-xs text-[#64748b]">
                  No winner trophies in feed.
                </p>
              ) : (
                <ul className="space-y-2 max-h-72 overflow-y-auto">
                  {won.map((tr, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 rounded-[2px] border border-white/[0.06] bg-[#10141a] px-2.5 py-2"
                    >
                      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[2px] bg-[#1a222d] text-amber-400">
                        <Trophy className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#e2e8f0]">
                          {tr.league}
                        </div>
                        <div className="text-[10px] text-[#64748b]">
                          {[tr.season || null, tr.place || null, tr.country || null]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Former head coaches" dense>
              {(data?.formerCoaches?.length || 0) === 0 ? (
                <p className="text-xs text-[#64748b]">
                  No former coaches in feed.
                </p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {(data?.formerCoaches || []).map((ch) => (
                    <li key={ch.id} className="flex items-center gap-2">
                      {ch.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={ch.photo}
                          alt=""
                          className="h-8 w-8 rounded-[2px] object-cover object-top border border-white/[0.08]"
                        />
                      ) : (
                        <span className="h-8 w-8 rounded-[2px] bg-[#1a222d]" />
                      )}
                      <div>
                        <div className="font-semibold text-[#e2e8f0]">
                          {ch.name}
                        </div>
                        <div className="text-[#64748b]">
                          {[ch.nationality || null, ch.start || null, ch.end ? `→ ${ch.end}` : null]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Current coach" dense>
              {data?.afCoach ? (
                <div className="flex items-center gap-3 text-xs">
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
              ) : (
                <p className="text-xs text-[#64748b]">No coaches on file.</p>
              )}
            </Section>

            <Section title="Club records" dense quiet>
              <p className="text-xs text-[#64748b]">
                AF does not publish a club-records endpoint — —
              </p>
            </Section>
          </div>
        )}

        {!loading && c && tab === "transfers" && (
          <Section title="Transfer history">
            {(data?.transfers?.length || 0) === 0 ? (
              <p className="text-xs text-[#64748b]">No transfers in feed.</p>
            ) : (
              <div className="overflow-x-auto max-h-[55vh]">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Player</th>
                      <th>Move</th>
                      <th>Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.transfers || []).map((tr, i) => (
                      <tr key={i}>
                        <td className="muted">{tr.date || "—"}</td>
                        <td className="font-semibold">{tr.player}</td>
                        <td className="muted">
                          {tr.from} → {tr.to}
                        </td>
                        <td className="muted">
                          {formatTransferFee(tr.type)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}

        {!loading && c && tab === "notes" && notesBlock}
      </div>

      {selectedFx ? (
        <div className="league-match-popup-root" data-club-match-popup="1">
          <button
            type="button"
            className="league-match-popup-backdrop"
            aria-label="Close match info"
            onClick={() => setSelectedFx(null)}
          />
          <div
            className="league-match-popup"
            role="dialog"
            aria-modal="true"
            aria-label="Match info"
          >
            <div className="league-match-popup-header">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wide text-[#64748b]">
                  {selectedFx.competition || "Match"}
                </div>
                <div className="font-bold text-sm text-[#e2e8f0]">
                  {selectedFx.home} {selectedFx.score} {selectedFx.away}
                </div>
                <div className="text-[11px] text-[#94a3b8]">
                  {(selectedFx.date || "").slice(0, 16).replace("T", " ")} ·{" "}
                  {selectedFx.status || "—"}
                </div>
              </div>
              <button
                type="button"
                className="player-dossier-icon-btn focus-ring"
                onClick={() => setSelectedFx(null)}
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="league-match-popup-section">
              <div className="league-match-popup-section-title">Scorers</div>
              {fxLoading ? (
                <div className="flex items-center gap-2 text-xs text-[#64748b]">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                </div>
              ) : fxScorers && fxScorers.length > 0 ? (
                <ul className="space-y-1 text-xs">
                  {fxScorers.map((g, i) => (
                    <li key={i} className="text-[#e2e8f0]">
                      {g.minute != null ? `${g.minute}'` : "—"}{" "}
                      {g.player || "—"}
                      {g.assist ? (
                        <span className="text-[#64748b]"> · {g.assist}</span>
                      ) : null}
                      {g.detail ? (
                        <span className="text-[#64748b]"> · {g.detail}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[#64748b]">
                  No scorers in feed for this fixture.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
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
