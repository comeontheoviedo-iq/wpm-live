"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2, RefreshCw, X } from "lucide-react";
import { NotesPanel, type NoteRow } from "@/components/notes/notes-panel";
import { cn } from "@/lib/utils";
import { VerdictBlock } from "@/components/match/verdict-block";

type StandingRow = {
  rank: number;
  teamId: number;
  team: string;
  logo?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  form?: string | null;
  description?: string | null;
};

type SlimFx = {
  id: number;
  date: string;
  status: string;
  statusLong: string;
  elapsed: number | null;
  home: { id: number; name: string; logo?: string };
  away: { id: number; name: string; logo?: string };
  goals: { home: number | null; away: number | null };
  round?: string | null;
  competition?: string | null;
  venue?: { name: string | null; city: string | null } | null;
};

type LeaguePayload = {
  configured: boolean;
  competition: string;
  leagueId: number | null;
  season: number;
  homeTeamId?: number | null;
  awayTeamId?: number | null;
  standings: StandingRow[];
  recent: SlimFx[];
  upcoming: SlimFx[];
  live: SlimFx[];
  todayFixtures: SlimFx[];
  warnings?: string[];
  message?: string | null;
  leagueMeta?: {
    name: string;
    logo: string | null;
    country: string | null;
    countryFlag: string | null;
    type: string | null;
    seasonsTracked: { year: number; current?: boolean; start?: string; end?: string }[];
  } | null;
  hallOfFame?: {
    season: number;
    champion: string | null;
    runnerUp: string | null;
    championLogo?: string | null;
    runnerUpLogo?: string | null;
  }[];
  lastChampion?: { season: number; name: string; logo?: string | null } | null;
  lastRunnerUp?: { season: number; name: string; logo?: string | null } | null;
};

type Tab = "overview" | "table" | "results" | "fixtures" | "history" | "notes";
type ZoneKind = "cl" | "el" | "ecl" | "up" | "rel" | null;
type FormLetter = "W" | "D" | "L";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "table", label: "Table" },
  { key: "results", label: "Results" },
  { key: "fixtures", label: "Fixtures" },
  { key: "history", label: "History" },
  { key: "notes", label: "Notes" },
];

function whenLabel(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function dateGroupKey(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function dateGroupLabel(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function kickoffLabel(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

function scoreLabel(fx: SlimFx) {
  if (fx.goals.home != null && fx.goals.away != null) {
    return `${fx.goals.home}–${fx.goals.away}`;
  }
  return "–";
}

function gdLabel(gd: number) {
  if (gd > 0) return `+${gd}`;
  return String(gd);
}

function zoneKind(description?: string | null): ZoneKind {
  if (!description) return null;
  const d = description.toLowerCase();
  if (/relegat/.test(d)) return "rel";
  if (/champions\s*league|uefa\s*champions|^promotion\s*-\s*champions/.test(d))
    return "cl";
  if (/europa\s*league|uefa\s*europa/.test(d)) return "el";
  if (/conference|uefa\s*europa\s*conference/.test(d)) return "ecl";
  if (/promotion/.test(d)) return "up";
  return null;
}

function parseForm(form?: string | null): FormLetter[] {
  if (!form) return [];
  return form
    .toUpperCase()
    .replace(/[^WDL]/g, "")
    .slice(-5)
    .split("")
    .filter((c): c is FormLetter => c === "W" || c === "D" || c === "L");
}

function deskResult(fx: SlimFx, deskIds: Set<number>): FormLetter | null {
  if (fx.goals.home == null || fx.goals.away == null) return null;
  const homeDesk = deskIds.has(fx.home.id);
  const awayDesk = deskIds.has(fx.away.id);
  if (!homeDesk && !awayDesk) return null;
  if (fx.goals.home === fx.goals.away) return "D";
  const homeWon = fx.goals.home > fx.goals.away;
  if (homeDesk && !awayDesk) return homeWon ? "W" : "L";
  if (awayDesk && !homeDesk) return homeWon ? "L" : "W";
  return "D";
}

function isFinished(fx: SlimFx) {
  const s = (fx.status || "").toUpperCase();
  return (
    s === "FT" ||
    s === "AET" ||
    s === "PEN" ||
    s === "AWD" ||
    s === "WO" ||
    /finished|after|award/i.test(fx.statusLong || "")
  );
}

function isLiveStatus(fx: SlimFx) {
  const s = (fx.status || "").toUpperCase();
  return (
    s === "1H" ||
    s === "2H" ||
    s === "HT" ||
    s === "ET" ||
    s === "BT" ||
    s === "P" ||
    s === "LIVE" ||
    /live|half|extra/i.test(fx.statusLong || "")
  );
}

function groupByDate(items: SlimFx[]): { key: string; label: string; items: SlimFx[] }[] {
  const map = new Map<string, SlimFx[]>();
  for (const fx of items) {
    const key = dateGroupKey(fx.date);
    const list = map.get(key) || [];
    list.push(fx);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, list]) => ({
      key,
      label: dateGroupLabel(list[0].date),
      items: list.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      ),
    }));
}

function Crest({
  src,
  className,
}: {
  src?: string | null;
  className?: string;
}) {
  if (!src) {
    return <span className={cn("league-elite-crest is-empty", className)} aria-hidden />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={cn("league-elite-crest", className)}
      onError={(e) => {
        (e.target as HTMLImageElement).style.visibility = "hidden";
      }}
    />
  );
}

export function LeagueDossier({
  matchId,
  notes: notesProp = [],
}: {
  matchId: string;
  notes?: NoteRow[];
}) {
  const [data, setData] = useState<LeaguePayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedFx, setSelectedFx] = useState<SlimFx | null>(null);
  const [fetchedNotes, setFetchedNotes] = useState<NoteRow[]>(notesProp);

  async function load() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/league`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.message || "Failed");
      setData(json);
      // League Notes tab: load entityType=league (parent often passes []).
      try {
        const leagueKey = String(json.leagueId || json.competition || "league");
        const nRes = await fetch(
          `/api/notes?matchId=${encodeURIComponent(matchId)}&entityType=league`,
          { cache: "no-store" }
        );
        if (nRes.ok) {
          const nJson = await nRes.json();
          const rows = (nJson.notes || []) as NoteRow[];
          // Prefer notes keyed to this league id / competition name
          const keyed = rows.filter(
            (n) =>
              !n.entityId ||
              n.entityId === leagueKey ||
              n.entityId === String(json.leagueId || "") ||
              n.entityId === String(json.competition || "") ||
              n.entityId === "league"
          );
          setFetchedNotes(keyed.length ? keyed : rows);
        } else if (notesProp.length) {
          setFetchedNotes(notesProp);
        }
      } catch {
        if (notesProp.length) setFetchedNotes(notesProp);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load league dossier");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  const meta = data?.leagueMeta;
  const logo =
    meta?.logo ||
    (data?.leagueId
      ? `https://media.api-sports.io/football/leagues/${data.leagueId}.png`
      : null);
  const highlight = useMemo(() => {
    const set = new Set<number>();
    if (data?.homeTeamId) set.add(data.homeTeamId);
    if (data?.awayTeamId) set.add(data.awayTeamId);
    return set;
  }, [data?.homeTeamId, data?.awayTeamId]);

  const titleTally = (() => {
    const map = new Map<string, number>();
    for (const row of data?.hallOfFame || []) {
      if (!row.champion) continue;
      map.set(row.champion, (map.get(row.champion) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  })();

  const notes = fetchedNotes;
  const leagueNotes = notes.filter((n) => (n.body || n.title || "").trim());
  const hookNotes = leagueNotes.filter(
    (n) =>
      /hook|scout|verdict|sayable|lead|league/i.test(n.title || "") ||
      /hook|scout|verdict/i.test(n.category || "") ||
      n.pinned
  );
  const sayableNote = hookNotes[0] || leagueNotes[0] || null;

  const leagueName = meta?.name || data?.competition || "League";
  const sayableLine = sayableNote
    ? (sayableNote.title || "").trim() ||
      (sayableNote.body || "").split("\n")[0].trim()
    : [
        leagueName,
        meta?.country || null,
        data?.season != null ? `Season ${data.season}` : null,
        data?.lastChampion
          ? `Last champion ${data.lastChampion.name}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ");

  const sayableSub = sayableNote?.body
    ? sayableNote.body
        .trim()
        .split("\n")
        .slice(sayableNote.title ? 0 : 1, 2)
        .join(" ")
        .slice(0, 180)
    : [
        data?.standings?.length
          ? `${data.standings.length} clubs in table`
          : null,
        data?.live?.length ? `${data.live.length} live` : null,
        data?.todayFixtures?.length
          ? `${data.todayFixtures.length} today`
          : null,
        data?.lastRunnerUp
          ? `Runner-up ${data.lastRunnerUp.name}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ") || null;

  const resultGroups = useMemo(() => {
    const groups = groupByDate([...(data?.recent || [])]).reverse();
    return groups.map((g) => ({
      ...g,
      items: [...g.items].reverse(),
    }));
  }, [data?.recent]);

  const fixtureGroups = useMemo(() => {
    const seen = new Set<number>();
    const merged: SlimFx[] = [];
    for (const fx of [
      ...(data?.live || []),
      ...(data?.todayFixtures || []),
      ...(data?.upcoming || []),
    ]) {
      if (seen.has(fx.id)) continue;
      seen.add(fx.id);
      merged.push(fx);
    }
    return groupByDate(merged);
  }, [data?.live, data?.todayFixtures, data?.upcoming]);

  function openFx(fx: SlimFx) {
    setSelectedFx((prev) => (prev?.id === fx.id ? null : fx));
  }

  return (
    <div
      className="player-dossier league-dossier"
      data-league-dossier="1"
      data-dossier-kind="league"
      data-dossier-craft="v2"
      data-league-elite="1"
    >
      <div className="player-dossier-titlebar">
        <div className="player-dossier-title">League dossier</div>
        <div className="player-dossier-titlebar-actions">
          <button
            type="button"
            className="player-dossier-icon-btn focus-ring"
            onClick={() => void load()}
            disabled={busy}
            aria-label="Refresh league dossier"
            title="Refresh"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      <div className="player-dossier-identity">
        <div className="player-dossier-identity-row">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt=""
              className="player-dossier-photo league-dossier-crest"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="player-dossier-photo player-dossier-photo-fallback" />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="player-dossier-name">{leagueName}</h2>
            <div className="player-dossier-meta">
              {meta?.countryFlag ? (
                <span className="player-dossier-flag">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={meta.countryFlag} alt="" />
                </span>
              ) : null}
              {meta?.country ? <span>{meta.country}</span> : null}
              {meta?.type ? (
                <>
                  <span className="player-dossier-meta-sep" aria-hidden>
                    ·
                  </span>
                  <span className="player-dossier-meta-quiet">{meta.type}</span>
                </>
              ) : null}
              {data?.season != null ? (
                <>
                  <span className="player-dossier-meta-sep" aria-hidden>
                    ·
                  </span>
                  <span className="player-dossier-meta-quiet">
                    Season {data.season}
                  </span>
                </>
              ) : null}
            </div>
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
            onClick={() => {
              setTab(t.key);
              setSelectedFx(null);
            }}
            className={cn(
              "player-dossier-tab",
              tab === t.key && "is-active"
            )}
          >
            {t.label}
            {t.key === "notes" && notes.length ? ` (${notes.length})` : ""}
            {t.key === "table" && data?.standings?.length
              ? ` (${data.standings.length})`
              : ""}
          </button>
        ))}
      </div>

      <div className="player-dossier-body">
        {busy && !data ? (
          <div className="flex items-center gap-2 text-xs text-[#64748b] py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading league dossier…
          </div>
        ) : null}

        {err ? <p className="text-xs text-[#f87171]">{err}</p> : null}
        {data?.message ? (
          <p className="text-xs text-[#64748b] mb-2">{data.message}</p>
        ) : null}
        {(data?.warnings?.length || 0) > 0 ? (
          <ul className="mb-2 space-y-0.5">
            {data!.warnings!.map((w) => (
              <li key={w} className="text-[10px] text-[#64748b]">
                {w}
              </li>
            ))}
          </ul>
        ) : null}

        {!busy && data && tab === "overview" && (
          <div className="player-dossier-overview space-y-3">
            <VerdictBlock
              line={sayableLine}
              sub={sayableSub}
              fullBody={sayableNote?.body || null}
            />

            <div className="player-dossier-overview-cols">
              <Section title="Identity" dense quiet>
                <div className="player-dossier-kv">
                  <Kv label="League" value={leagueName} />
                  <Kv label="Country" value={meta?.country || "—"} />
                  <Kv label="Type" value={meta?.type || "—"} />
                  <Kv
                    label="Season"
                    value={data.season != null ? String(data.season) : "—"}
                  />
                  <Kv
                    label="Clubs"
                    value={
                      data.standings?.length
                        ? String(data.standings.length)
                        : "—"
                    }
                  />
                </div>
              </Section>

              <Section title="Last season" dense quiet>
                {data.lastChampion || data.lastRunnerUp ? (
                  <div className="player-dossier-kv">
                    <Kv
                      label="Champion"
                      value={
                        data.lastChampion
                          ? `${data.lastChampion.name} (${data.lastChampion.season})`
                          : "—"
                      }
                    />
                    <Kv
                      label="Runner-up"
                      value={
                        data.lastRunnerUp
                          ? `${data.lastRunnerUp.name} (${data.lastRunnerUp.season})`
                          : "—"
                      }
                    />
                  </div>
                ) : (
                  <p className="text-xs text-[#64748b]">
                    Prior champion / runner-up not in feed yet (plan or season
                    limits).
                  </p>
                )}
              </Section>
            </div>

            <Section title="Seasons tracked" dense quiet>
              {(meta?.seasonsTracked?.length || 0) === 0 ? (
                <p className="text-xs text-[#64748b]">No season list from feed.</p>
              ) : (
                <ul className="flex flex-wrap gap-1">
                  {meta!.seasonsTracked.map((s) => (
                    <li
                      key={s.year}
                      className={cn(
                        "rounded-[2px] px-2 py-0.5 text-[10px] font-semibold border",
                        s.current
                          ? "border-white/20 bg-[#12161c] text-[#e2e8f0]"
                          : "border-white/8 text-[#64748b]"
                      )}
                    >
                      {s.year}
                      {s.current ? " · current" : ""}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        )}

        {!busy && data && tab === "table" && (
          <div className="league-elite-panel" data-league-elite-table="1">
            {!(data.standings?.length) ? (
              <p className="league-elite-empty">No standings returned.</p>
            ) : (
              <div className="league-elite-table-wrap">
                <table className="league-elite-table">
                  <thead>
                    <tr>
                      <th className="is-rank">#</th>
                      <th className="is-club">Club</th>
                      <th className="is-num">P</th>
                      <th className="is-num">W</th>
                      <th className="is-num">D</th>
                      <th className="is-num">L</th>
                      <th className="is-num">GD</th>
                      <th className="is-num is-pts">Pts</th>
                      <th className="is-form">Form</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.standings.map((r, i) => {
                      const zone = zoneKind(r.description);
                      const form = parseForm(r.form);
                      const desk = highlight.has(r.teamId);
                      return (
                        <tr
                          key={`${r.rank}-${r.teamId}`}
                          className={cn(
                            desk && "is-desk",
                            i % 2 === 1 && "is-zebra",
                            zone && `is-zone-${zone}`
                          )}
                          title={r.description || undefined}
                          data-team-id={r.teamId}
                        >
                          <td className="is-rank">
                            <span className="league-elite-rank">{r.rank}</span>
                          </td>
                          <td className="is-club">
                            <span className="league-elite-club">
                              <Crest src={r.logo} />
                              <span className="league-elite-club-name">{r.team}</span>
                            </span>
                          </td>
                          <td className="is-num">{r.played}</td>
                          <td className="is-num">{r.won}</td>
                          <td className="is-num">{r.drawn}</td>
                          <td className="is-num">{r.lost}</td>
                          <td
                            className={cn(
                              "is-num",
                              r.gd > 0 && "is-pos",
                              r.gd < 0 && "is-neg"
                            )}
                          >
                            {gdLabel(r.gd)}
                          </td>
                          <td className="is-num is-pts">{r.points}</td>
                          <td className="is-form">
                            <span className="league-elite-form">
                              {form.length ? (
                                form.map((letter, fi) => (
                                  <span
                                    key={`${r.teamId}-${fi}-${letter}`}
                                    className={cn(
                                      "player-dossier-form-chip league-elite-form-pill",
                                      letter === "W" && "is-w",
                                      letter === "D" && "is-d",
                                      letter === "L" && "is-l"
                                    )}
                                  >
                                    {letter}
                                  </span>
                                ))
                              ) : (
                                <span className="league-elite-form-empty">—</span>
                              )}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {(data.standings?.length || 0) > 0 ? (
              <div className="league-elite-legend" aria-hidden>
                <span className="is-zone-cl">CL</span>
                <span className="is-zone-el">EL</span>
                <span className="is-zone-ecl">ECL</span>
                <span className="is-zone-rel">REL</span>
              </div>
            ) : null}
          </div>
        )}

        {!busy && data && tab === "results" && (
          <div className="league-elite-panel space-y-3" data-league-elite-results="1">
            {!(data.recent?.length) ? (
              <p className="league-elite-empty">No recent results.</p>
            ) : (
              <div className="league-elite-fx-groups">
                {resultGroups.map((g) => (
                  <section key={g.key} className="league-elite-fx-group">
                    <div className="league-elite-fx-date">{g.label}</div>
                    <ul className="league-elite-fx-list">
                      {g.items.map((fx) => (
                        <FxEliteRow
                          key={fx.id}
                          fx={fx}
                          mode="result"
                          highlight={highlight}
                          selected={selectedFx?.id === fx.id}
                          onSelect={openFx}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}

        {!busy && data && tab === "fixtures" && (
          <div className="league-elite-panel space-y-3" data-league-elite-fixtures="1">
            {!fixtureGroups.length ? (
              <p className="league-elite-empty">No fixtures returned.</p>
            ) : (
              <div className="league-elite-fx-groups">
                {fixtureGroups.map((g) => (
                  <section key={g.key} className="league-elite-fx-group">
                    <div className="league-elite-fx-date">{g.label}</div>
                    <ul className="league-elite-fx-list">
                      {g.items.map((fx) => (
                        <FxEliteRow
                          key={fx.id}
                          fx={fx}
                          mode="fixture"
                          highlight={highlight}
                          selected={selectedFx?.id === fx.id}
                          onSelect={openFx}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}

        {!busy && data && tab === "history" && (
          <div className="space-y-3">
            <Section title="Season winners">
              {(data.hallOfFame?.length || 0) === 0 ? (
                <p className="text-xs text-[#64748b]">
                  Hall of Fame empty — prior-season tables soft-failed or
                  plan-limited.
                </p>
              ) : (
                <div className="overflow-x-auto max-h-[40vh]">
                  <table>
                    <thead>
                      <tr>
                        <th>Season</th>
                        <th>Champion</th>
                        <th>Runner-up</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.hallOfFame!.map((row) => (
                        <tr key={row.season}>
                          <td className="muted">{row.season}</td>
                          <td className="font-semibold">{row.champion || "—"}</td>
                          <td className="muted">{row.runnerUp || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            <Section title="Titles tally" dense quiet>
              {titleTally.length === 0 ? (
                <p className="text-xs text-[#64748b]">No title tally yet.</p>
              ) : (
                <div className="player-dossier-kv">
                  {titleTally.map(([name, n]) => (
                    <Kv key={name} label={name} value={String(n)} />
                  ))}
                </div>
              )}
            </Section>

            <Section title="Seasons" dense quiet>
              {(meta?.seasonsTracked?.length || 0) === 0 ? (
                <p className="text-xs text-[#64748b]">No seasons list from feed.</p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {meta!.seasonsTracked.map((s) => (
                    <li key={s.year} className="flex gap-2">
                      <span className="font-semibold tabular-nums w-12 text-[#e2e8f0]">
                        {s.year}
                      </span>
                      <span className="text-[#64748b]">
                        {s.start || "?"} → {s.end || "?"}
                        {s.current ? " · current" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Map" dense quiet>
              <p className="text-xs text-[#64748b]">
                Geographic club map is not in the feed — showing country only.
              </p>
              <div className="mt-2 text-sm font-semibold text-[#e2e8f0]">
                {meta?.country || data.competition || "—"}
              </div>
            </Section>
          </div>
        )}

        {!busy && data && tab === "notes" && (
          <div className="space-y-3">
            <NotesPanel
              matchId={matchId}
              initialNotes={notes}
              entityType="league"
              entityId={String(data.leagueId || data.competition || "league")}
              entityLabel={leagueName}
              fillHeight
            />
          </div>
        )}
      </div>

      {selectedFx ? (
        <MatchInfoModal
          fx={selectedFx}
          competition={leagueName}
          standings={data?.standings || []}
          onClose={() => setSelectedFx(null)}
        />
      ) : null}
    </div>
  );
}

function FxEliteRow({
  fx,
  mode,
  highlight,
  selected,
  onSelect,
}: {
  fx: SlimFx;
  mode: "result" | "fixture";
  highlight: Set<number>;
  selected: boolean;
  onSelect: (fx: SlimFx) => void;
}) {
  const hi = highlight.has(fx.home.id) || highlight.has(fx.away.id);
  const result = mode === "result" ? deskResult(fx, highlight) : null;
  const live = isLiveStatus(fx);
  const finished = isFinished(fx);
  const homeHi = highlight.has(fx.home.id);
  const awayHi = highlight.has(fx.away.id);

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(fx)}
        className={cn(
          "league-elite-fx-row",
          hi && "is-desk",
          selected && "is-selected",
          result === "W" && "is-w",
          result === "D" && "is-d",
          result === "L" && "is-l",
          live && "is-live"
        )}
        data-league-fx={fx.id}
      >
        <span className="league-elite-fx-time">
          {mode === "fixture" ? (
            live ? (
              <span className="league-elite-live-badge">
                {fx.elapsed != null ? `${fx.elapsed}'` : "LIVE"}
              </span>
            ) : (
              kickoffLabel(fx.date)
            )
          ) : (
            <span className="league-elite-fx-status">
              {finished ? "FT" : fx.status || "—"}
            </span>
          )}
        </span>

        <span className={cn("league-elite-fx-side is-home", homeHi && "is-hi")}>
          <span className="league-elite-fx-name truncate">{fx.home.name}</span>
          <Crest src={fx.home.logo} />
        </span>

        <span className="league-elite-fx-score">
          {mode === "result" || finished || live || fx.goals.home != null ? (
            <span className="league-elite-fx-score-nums">{scoreLabel(fx)}</span>
          ) : (
            <span className="league-elite-fx-vs">vs</span>
          )}
        </span>

        <span className={cn("league-elite-fx-side is-away", awayHi && "is-hi")}>
          <Crest src={fx.away.logo} />
          <span className="league-elite-fx-name truncate">{fx.away.name}</span>
        </span>

        {result ? (
          <span className={cn("league-elite-wdl", `is-${result.toLowerCase()}`)}>
            {result}
          </span>
        ) : mode === "result" ? (
          <span className="league-elite-wdl is-muted" aria-hidden>
            ·
          </span>
        ) : (
          <span className="league-elite-fx-meta">
            {fx.round ? fx.round.replace(/^Regular Season - /i, "R") : ""}
          </span>
        )}
      </button>
    </li>
  );
}

function venueLabel(fx: SlimFx) {
  const name = fx.venue?.name?.trim() || "";
  const city = fx.venue?.city?.trim() || "";
  if (name && city && name.toLowerCase() !== city.toLowerCase()) {
    return `${name} · ${city}`;
  }
  return name || city || null;
}

type PopupScorer = {
  minute: number | null;
  extra: number | null;
  team: string | null;
  teamId: number | null;
  player: string | null;
  assist: string | null;
  detail: string | null;
};

function MatchInfoModal({
  fx,
  competition,
  standings,
  onClose,
}: {
  fx: SlimFx;
  competition?: string | null;
  standings: StandingRow[];
  onClose: () => void;
}) {
  const [scorers, setScorers] = useState<PopupScorer[] | null>(null);
  const [scorersLoading, setScorersLoading] = useState(false);
  const [scorersErr, setScorersErr] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const finished = isFinished(fx);
  const live = isLiveStatus(fx);

  // Results / live: load goal scorers for the popup (soft-fail)
  useEffect(() => {
    if (!finished && !live) {
      setScorers(null);
      setScorersErr(null);
      return;
    }
    let cancelled = false;
    setScorersLoading(true);
    setScorersErr(null);
    fetch(`/api/football/fixtures/${fx.id}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Scorers unavailable");
        return j as { scorers?: PopupScorer[] };
      })
      .then((j) => {
        if (cancelled) return;
        setScorers(Array.isArray(j.scorers) ? j.scorers : []);
      })
      .catch((e) => {
        if (cancelled) return;
        setScorers([]);
        setScorersErr(e instanceof Error ? e.message : "Scorers soft-fail");
      })
      .finally(() => {
        if (!cancelled) setScorersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fx.id, finished, live]);
  const venue = venueLabel(fx);
  const competitionLabel = fx.competition || competition || null;
  const roundLabel = fx.round || null;
  const homeStanding = standings.find((r) => r.teamId === fx.home.id) || null;
  const awayStanding = standings.find((r) => r.teamId === fx.away.id) || null;
  const homeForm = parseForm(homeStanding?.form);
  const awayForm = parseForm(awayStanding?.form);
  const hasForm = homeForm.length > 0 || awayForm.length > 0;
  const score = scoreLabel(fx);
  const showScore = finished || live || (fx.goals.home != null && fx.goals.away != null);
  const statusText = [
    fx.statusLong || fx.status || null,
    fx.elapsed != null ? `${fx.elapsed}'` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="league-match-popup-root" data-league-match-popup="1">
      <button
        type="button"
        className="league-match-popup-backdrop"
        aria-label="Close match info"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="league-match-popup-title"
        className="league-match-popup"
        data-league-match-info="1"
      >
        <div className="league-match-popup-titlebar">
          <div className="league-match-popup-kicker">Match info</div>
          <button
            type="button"
            className="player-dossier-icon-btn focus-ring shrink-0"
            onClick={onClose}
            aria-label="Close match info"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="league-match-popup-body">
          <div className="league-match-popup-scoreboard">
            <div className="league-match-popup-team is-home">
              <Crest src={fx.home.logo} className="league-match-popup-crest" />
              <div className="league-match-popup-team-name" id="league-match-popup-title">
                {fx.home.name}
              </div>
              {homeStanding?.rank != null ? (
                <div className="league-match-popup-rank">#{homeStanding.rank}</div>
              ) : null}
            </div>

            <div className="league-match-popup-center">
              {showScore ? (
                <div className="league-match-popup-score tabular-nums">{score}</div>
              ) : (
                <div className="league-match-popup-vs">vs</div>
              )}
              <div className="league-match-popup-status">
                {live ? (
                  <span className="league-elite-live-badge">
                    {fx.elapsed != null ? `${fx.elapsed}'` : "LIVE"}
                  </span>
                ) : finished ? (
                  <span>FT</span>
                ) : (
                  <span>{fx.status || "NS"}</span>
                )}
              </div>
            </div>

            <div className="league-match-popup-team is-away">
              <Crest src={fx.away.logo} className="league-match-popup-crest" />
              <div className="league-match-popup-team-name">{fx.away.name}</div>
              {awayStanding?.rank != null ? (
                <div className="league-match-popup-rank">#{awayStanding.rank}</div>
              ) : null}
            </div>
          </div>

          <div className="league-match-popup-meta">
            <div className="league-match-popup-meta-row">
              <span className="league-match-popup-meta-label">Kick-off</span>
              <span className="league-match-popup-meta-value tabular-nums">
                {whenLabel(fx.date)}
              </span>
            </div>
            <div className="league-match-popup-meta-row">
              <span className="league-match-popup-meta-label">Venue</span>
              <span className="league-match-popup-meta-value">
                {venue || <span className="is-soft">Not in feed</span>}
              </span>
            </div>
            <div className="league-match-popup-meta-row">
              <span className="league-match-popup-meta-label">Status</span>
              <span className="league-match-popup-meta-value">
                {statusText || "—"}
              </span>
            </div>
            <div className="league-match-popup-meta-row">
              <span className="league-match-popup-meta-label">Competition</span>
              <span className="league-match-popup-meta-value">
                {[competitionLabel, roundLabel].filter(Boolean).join(" · ") || (
                  <span className="is-soft">Not in feed</span>
                )}
              </span>
            </div>
            <div className="league-match-popup-meta-row">
              <span className="league-match-popup-meta-label">Fixture id</span>
              <span className="league-match-popup-meta-value tabular-nums">{fx.id}</span>
            </div>
          </div>

          <div className="league-match-popup-section">
            <div className="league-match-popup-section-title">Form</div>
            {hasForm ? (
              <div className="league-match-popup-form-grid">
                <div className="league-match-popup-form-row">
                  <span className="league-match-popup-form-label truncate">
                    {fx.home.name}
                  </span>
                  <span className="league-elite-form">
                    {homeForm.length ? (
                      homeForm.map((letter, fi) => (
                        <span
                          key={`h-${fi}-${letter}`}
                          className={cn(
                            "player-dossier-form-chip league-elite-form-pill",
                            letter === "W" && "is-w",
                            letter === "D" && "is-d",
                            letter === "L" && "is-l"
                          )}
                        >
                          {letter}
                        </span>
                      ))
                    ) : (
                      <span className="league-elite-form-empty">—</span>
                    )}
                  </span>
                </div>
                <div className="league-match-popup-form-row">
                  <span className="league-match-popup-form-label truncate">
                    {fx.away.name}
                  </span>
                  <span className="league-elite-form">
                    {awayForm.length ? (
                      awayForm.map((letter, fi) => (
                        <span
                          key={`a-${fi}-${letter}`}
                          className={cn(
                            "player-dossier-form-chip league-elite-form-pill",
                            letter === "W" && "is-w",
                            letter === "D" && "is-d",
                            letter === "L" && "is-l"
                          )}
                        >
                          {letter}
                        </span>
                      ))
                    ) : (
                      <span className="league-elite-form-empty">—</span>
                    )}
                  </span>
                </div>
              </div>
            ) : (
              <p className="league-match-popup-soft">Form not in standings feed.</p>
            )}
          </div>

          <div className="league-match-popup-section" data-league-popup-scorers="1">
            <div className="league-match-popup-section-title">Scorers</div>
            {!(finished || live) ? (
              <p className="league-match-popup-soft">
                Scorers available after kick-off.
              </p>
            ) : scorersLoading ? (
              <p className="league-match-popup-soft inline-flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading scorers…
              </p>
            ) : scorers && scorers.length > 0 ? (
              <ul className="league-match-popup-scorers space-y-1">
                {scorers.map((g, i) => {
                  const min =
                    g.minute != null
                      ? `${g.minute}${g.extra != null ? `+${g.extra}` : ""}'`
                      : "·";
                  const own = /own/i.test(g.detail || "");
                  const pen = /penalty/i.test(g.detail || "");
                  const label = [
                    g.player || "Unknown",
                    own ? "(OG)" : null,
                    pen ? "(pen)" : null,
                    g.assist ? `· ${g.assist}` : null,
                  ]
                    .filter(Boolean)
                    .join(" ");
                  const side =
                    g.teamId === fx.home.id
                      ? "home"
                      : g.teamId === fx.away.id
                        ? "away"
                        : null;
                  return (
                    <li
                      key={`${g.minute}-${g.player}-${i}`}
                      className="flex items-baseline gap-2 text-[11px] text-slate-300"
                    >
                      <span className="note-queue-minute shrink-0 tabular-nums text-slate-500">
                        {min}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                      <span className="shrink-0 text-[9px] uppercase tracking-wide text-slate-600">
                        {side === "home"
                          ? fx.home.name
                          : side === "away"
                            ? fx.away.name
                            : g.team || ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="league-match-popup-soft">
                {scorersErr || "No scorers in feed for this fixture."}
              </p>
            )}
          </div>

          <div className="league-match-popup-section">
            <div className="league-match-popup-section-title">H2H</div>
            <p className="league-match-popup-soft">
              Head-to-head not in league dossier payload.
            </p>
          </div>
        </div>
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

/** Back-compat export used by League page */
export function LeagueIntel({ matchId }: { matchId: string }) {
  return <LeagueDossier matchId={matchId} />;
}
