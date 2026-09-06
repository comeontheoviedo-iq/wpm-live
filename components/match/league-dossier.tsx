"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, Loader2, RefreshCw, BookOpen, X } from "lucide-react";
import { NotesPanel, type NoteRow } from "@/components/notes/notes-panel";

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

type Tab = "profile" | "schedule" | "standings" | "hof" | "map" | "seasons";

const TABS: { key: Tab; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "schedule", label: "Schedule" },
  { key: "standings", label: "Standings & Playoff" },
  { key: "hof", label: "Hall of Fame" },
  { key: "map", label: "Map" },
  { key: "seasons", label: "Seasons" },
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

export function LeagueDossier({
  matchId,
  notes = [],
}: {
  matchId: string;
  notes?: NoteRow[];
}) {
  const [data, setData] = useState<LeaguePayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("profile");
  const [fixtureDetail, setFixtureDetail] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/league`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.message || "Failed");
      setData(json);
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
  const highlight = new Set<number>();
  if (data?.homeTeamId) highlight.add(data.homeTeamId);
  if (data?.awayTeamId) highlight.add(data.awayTeamId);

  const titleTally = (() => {
    const map = new Map<string, number>();
    for (const row of data?.hallOfFame || []) {
      if (!row.champion) continue;
      map.set(row.champion, (map.get(row.champion) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  })();

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="relative overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 h-24 w-24 object-contain opacity-[0.1]" />
        ) : null}
        <div className="relative flex items-start gap-3">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-14 w-14 object-contain" />
          ) : (
            <div className="h-14 w-14 rounded-md bg-[var(--surface-muted)]" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black tracking-tight">
                {meta?.name || data?.competition || "League"}
              </h1>
              <span className="rounded-[var(--radius-sm)] bg-[var(--surface-muted)] text-[var(--foreground)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[var(--tracking-label)] border border-[var(--border)]">
                Active
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--muted-foreground)]">
              {meta?.countryFlag ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={meta.countryFlag} alt="" className="h-3 w-4 object-cover inline rounded-[1px]" />
              ) : null}
              {meta?.country ? <span>{meta.country}</span> : null}
              <span>Federation / FA</span>
              <span>Male · Senior</span>
              {data?.season != null ? <span>Season {data.season}</span> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={busy}
            className="desk-btn text-[11px] inline-flex items-center gap-1"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "tab-chip focus-ring rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[11px] font-semibold border whitespace-nowrap",
              tab === t.key
                ? "bg-[var(--surface)] border-[var(--border-strong)] shadow-xs text-[var(--foreground)]"
                : "border-transparent text-[var(--muted)] hover:bg-[var(--surface)]"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {err && (
        <div className="rounded-[var(--radius-sm)] border border-[var(--warning)]/40 bg-[var(--surface-muted)] px-3 py-2 text-xs flex gap-2 text-[var(--foreground)]">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {err}
        </div>
      )}
      {data?.message && (
        <div className="rounded-[var(--radius-sm)] border px-3 py-2 text-xs text-[var(--muted-foreground)]">{data.message}</div>
      )}

      {busy && !data ? (
        <div className="flex justify-center gap-2 text-sm text-[var(--muted)] py-10">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading league dossier…
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-3">
          <div className="space-y-3">
            {tab === "profile" && (
              <>
                <Panel title="Seasons tracked">
                  {(meta?.seasonsTracked?.length || 0) === 0 ? (
                    <p className="text-xs text-[var(--muted)]">No season list from feed.</p>
                  ) : (
                    <ul className="flex flex-wrap gap-1">
                      {meta!.seasonsTracked.map((s) => (
                        <li
                          key={s.year}
                          className={cn(
                            "rounded-[var(--radius-sm)] px-2 py-0.5 text-[10px] font-semibold border",
                            s.current
                              ? "border-[var(--border-strong)] bg-[var(--surface)] text-[var(--foreground)] shadow-xs"
                              : "border-[var(--border)] text-[var(--muted)]"
                          )}
                        >
                          {s.year}{s.current ? " · current" : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
                <Panel title="Last champion">
                  {data?.lastChampion ? (
                    <div className="flex items-center gap-2 text-xs">
                      {data.lastChampion.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={data.lastChampion.logo} alt="" className="h-6 w-6 object-contain" />
                      ) : null}
                      <span className="font-semibold">{data.lastChampion.name}</span>
                      <span className="text-[var(--muted)]">· {data.lastChampion.season}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--muted)]">Champion not in feed yet (plan/season limits).</p>
                  )}
                </Panel>
                <Panel title="Last runner-up">
                  {data?.lastRunnerUp ? (
                    <div className="flex items-center gap-2 text-xs">
                      {data.lastRunnerUp.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={data.lastRunnerUp.logo} alt="" className="h-6 w-6 object-contain" />
                      ) : null}
                      <span className="font-semibold">{data.lastRunnerUp.name}</span>
                      <span className="text-[var(--muted)]">· {data.lastRunnerUp.season}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--muted)]">Runner-up not in feed yet.</p>
                  )}
                </Panel>
              </>
            )}

            {tab === "schedule" && (
              <>
                <Panel title="Live">
                  <FxList items={data?.live || []} empty="No live matches." highlight={highlight} />
                </Panel>
                <Panel title="Today">
                  <FxList items={data?.todayFixtures || []} empty="No fixtures today." highlight={highlight} />
                </Panel>
                <Panel title="Upcoming">
                  <FxList items={data?.upcoming || []} empty="No upcoming fixtures." highlight={highlight} />
                </Panel>
                <Panel title="Recent results">
                  <FxList items={data?.recent || []} empty="No recent results." highlight={highlight} />
                </Panel>
              </>
            )}

            {tab === "standings" && (
              <Panel title="Table">
                {!(data?.standings?.length) ? (
                  <p className="text-xs text-[var(--muted)]">No standings returned.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="text-left text-[var(--muted)] border-b">
                          <th className="py-1.5 pr-1">#</th>
                          <th className="py-1.5 pr-2">Club</th>
                          <th className="py-1.5 px-1 text-right">MP</th>
                          <th className="py-1.5 px-1 text-right">W</th>
                          <th className="py-1.5 px-1 text-right">D</th>
                          <th className="py-1.5 px-1 text-right">L</th>
                          <th className="py-1.5 px-1 text-right">GD</th>
                          <th className="py-1.5 pl-1 text-right">Pts</th>
                          <th className="py-1.5 pl-2">Form</th>
                          <th className="py-1.5 pl-2">Zone</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data!.standings.map((r) => (
                          <tr
                            key={`${r.rank}-${r.teamId}`}
                            className={cn(
                              "border-b border-[var(--border)]",
                              highlight.has(r.teamId) && "bg-[var(--surface-muted)] font-semibold"
                            )}
                          >
                            <td className="py-1.5 pr-1 tabular-nums text-[var(--muted)]">{r.rank}</td>
                            <td className="py-1.5 pr-2 truncate max-w-[10rem]">
                              {r.logo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={r.logo} alt="" className="inline h-3.5 w-3.5 mr-1 object-contain" />
                              ) : null}
                              {r.team}
                            </td>
                            <td className="py-1.5 px-1 text-right tabular-nums">{r.played}</td>
                            <td className="py-1.5 px-1 text-right tabular-nums">{r.won}</td>
                            <td className="py-1.5 px-1 text-right tabular-nums">{r.drawn}</td>
                            <td className="py-1.5 px-1 text-right tabular-nums">{r.lost}</td>
                            <td className="py-1.5 px-1 text-right tabular-nums">{r.gd}</td>
                            <td className="py-1.5 pl-1 text-right tabular-nums font-semibold">{r.points}</td>
                            <td className="py-1.5 pl-2 font-mono text-[10px] text-[var(--muted)]">{r.form || "—"}</td>
                            <td className="py-1.5 pl-2 text-[10px] text-[var(--muted)] max-w-[8rem] truncate" title={r.description || ""}>
                              {r.description || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            )}

            {tab === "hof" && (
              <>
                <Panel title="Season winners">
                  {(data?.hallOfFame?.length || 0) === 0 ? (
                    <p className="text-xs text-[var(--muted)]">Hall of Fame empty — prior-season tables soft-failed or plan-limited.</p>
                  ) : (
                    <ul className="space-y-1.5 text-xs">
                      {data!.hallOfFame!.map((row) => (
                        <li key={row.season} className="flex gap-2 items-center">
                          <span className="tabular-nums text-[var(--muted)] w-12">{row.season}</span>
                          <span className="font-semibold flex-1 truncate">{row.champion || "—"}</span>
                          <span className="text-[var(--muted)] truncate">2nd {row.runnerUp || "—"}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
                <Panel title="Titles tally">
                  {titleTally.length === 0 ? (
                    <p className="text-xs text-[var(--muted)]">No title tally yet.</p>
                  ) : (
                    <ul className="space-y-1 text-xs">
                      {titleTally.map(([name, n]) => (
                        <li key={name} className="flex justify-between gap-2">
                          <span className="font-semibold">{name}</span>
                          <span className="tabular-nums">{n}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </>
            )}

            {tab === "map" && (
              <Panel title="Map">
                <p className="text-xs text-[var(--muted)]">
                  Geographic club map is not in the feed — showing country only.
                </p>
                <div className="mt-2 text-sm font-semibold">
                  {meta?.country || data?.competition || "—"}
                </div>
              </Panel>
            )}

            {tab === "seasons" && (
              <Panel title="Seasons">
                {(meta?.seasonsTracked?.length || 0) === 0 ? (
                  <p className="text-xs text-[var(--muted)]">No seasons list from feed.</p>
                ) : (
                  <ul className="space-y-1.5 text-xs">
                    {meta!.seasonsTracked.map((s) => (
                      <li key={s.year} className="flex gap-2">
                        <span className="font-semibold tabular-nums w-12">{s.year}</span>
                        <span className="text-[var(--muted)]">
                          {s.start || "?"} → {s.end || "?"}
                          {s.current ? " · current" : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )}
          </div>

          {tab === "profile" ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden flex flex-col min-h-[280px]">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b text-xs font-bold uppercase tracking-wide">
                <BookOpen className="h-3.5 w-3.5" /> League notes
              </div>
              <div className="p-2 flex-1 min-h-0">
                <NotesPanel
                  matchId={matchId}
                  initialNotes={notes}
                  entityType="league"
                  entityId={String(data?.leagueId || data?.competition || "league")}
                  entityLabel={meta?.name || data?.competition || "League"}
                  fillHeight
                />
              </div>
            </div>
          ) : (
            <Panel title="Desk tips">
              <p className="text-xs text-[var(--muted)]">
                European qualification zones appear in the Zone column when the feed provides descriptions (CL / EL / relegation).
              </p>
              {fixtureDetail ? (
                <p className="text-[10px] mt-2 text-[var(--muted)]">{fixtureDetail}</p>
              ) : null}
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="text-desk-label text-[var(--muted)] mb-2">{title}</div>
      {children}
    </div>
  );
}

function FxList({
  items,
  empty,
  highlight,
}: {
  items: SlimFx[];
  empty: string;
  highlight: Set<number>;
}) {
  if (!items.length) return <p className="text-xs text-[var(--muted)]">{empty}</p>;
  return (
    <ul className="space-y-1.5 text-xs">
      {items.map((fx) => {
        const hi = highlight.has(fx.home.id) || highlight.has(fx.away.id);
        const score =
          fx.goals.home != null && fx.goals.away != null
            ? `${fx.goals.home}–${fx.goals.away}`
            : "–";
        return (
          <li
            key={fx.id}
            className={cn(
              "flex gap-2 items-center rounded-md px-1.5 py-1",
              hi && "bg-[var(--surface-muted)] font-semibold"
            )}
          >
            <span className="text-[var(--muted)] w-28 shrink-0 tabular-nums text-[10px]">
              {whenLabel(fx.date)}
            </span>
            <span className="flex-1 truncate">
              {fx.home.name} vs {fx.away.name}
            </span>
            <span className="tabular-nums font-semibold">{score}</span>
            <span className="text-[10px] text-[var(--muted)] w-8">{fx.status}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Back-compat export used by League page */
export function LeagueIntel({ matchId }: { matchId: string }) {
  return <LeagueDossier matchId={matchId} />;
}
