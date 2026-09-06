"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Loader2, RefreshCw, X } from "lucide-react";
import { NotesPanel, type NoteRow } from "@/components/notes/notes-panel";
import { cn } from "@/lib/utils";

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

type Tab = "overview" | "table" | "results" | "fixtures" | "history" | "notes";

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

function scoreLabel(fx: SlimFx) {
  if (fx.goals.home != null && fx.goals.away != null) {
    return `${fx.goals.home}–${fx.goals.away}`;
  }
  return "–";
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
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedFx, setSelectedFx] = useState<SlimFx | null>(null);

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

  function openFx(fx: SlimFx) {
    setSelectedFx(fx);
  }

  return (
    <div
      className="player-dossier league-dossier"
      data-league-dossier="1"
      data-dossier-kind="league"
      data-dossier-craft="v2"
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
              if (t.key !== "results" && t.key !== "fixtures") setSelectedFx(null);
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
          <Section title="Table">
            {!(data.standings?.length) ? (
              <p className="text-xs text-[#64748b]">No standings returned.</p>
            ) : (
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Club</th>
                      <th>MP</th>
                      <th>W</th>
                      <th>D</th>
                      <th>L</th>
                      <th>GD</th>
                      <th>Pts</th>
                      <th>Form</th>
                      <th>Zone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.standings.map((r) => (
                      <tr
                        key={`${r.rank}-${r.teamId}`}
                        className={cn(highlight.has(r.teamId) && "font-semibold")}
                      >
                        <td className="muted">{r.rank}</td>
                        <td>
                          {r.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={r.logo}
                              alt=""
                              className="inline h-3.5 w-3.5 mr-1 object-contain align-middle"
                            />
                          ) : null}
                          {r.team}
                        </td>
                        <td>{r.played}</td>
                        <td>{r.won}</td>
                        <td>{r.drawn}</td>
                        <td>{r.lost}</td>
                        <td>{r.gd}</td>
                        <td className="font-semibold">{r.points}</td>
                        <td className="muted font-mono text-[10px]">
                          {r.form || "—"}
                        </td>
                        <td
                          className="muted text-[10px] max-w-[8rem] truncate"
                          title={r.description || ""}
                        >
                          {r.description || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2 text-[10px] text-[#64748b]">
              Qualification / relegation zones appear in Zone when the feed
              provides descriptions.
            </p>
          </Section>
        )}

        {!busy && data && tab === "results" && (
          <div className="space-y-3">
            <Section title="Recent results">
              <FxList
                items={data.recent || []}
                empty="No recent results."
                highlight={highlight}
                onSelect={openFx}
                selectedId={selectedFx?.id}
              />
            </Section>
            {selectedFx ? (
              <MatchInfoPanel fx={selectedFx} onClose={() => setSelectedFx(null)} />
            ) : null}
          </div>
        )}

        {!busy && data && tab === "fixtures" && (
          <div className="space-y-3">
            <Section title="Live" dense>
              <FxList
                items={data.live || []}
                empty="No live matches."
                highlight={highlight}
                onSelect={openFx}
                selectedId={selectedFx?.id}
              />
            </Section>
            <Section title="Today" dense>
              <FxList
                items={data.todayFixtures || []}
                empty="No fixtures today."
                highlight={highlight}
                onSelect={openFx}
                selectedId={selectedFx?.id}
              />
            </Section>
            <Section title="Upcoming">
              <FxList
                items={data.upcoming || []}
                empty="No upcoming fixtures."
                highlight={highlight}
                onSelect={openFx}
                selectedId={selectedFx?.id}
              />
            </Section>
            {selectedFx ? (
              <MatchInfoPanel fx={selectedFx} onClose={() => setSelectedFx(null)} />
            ) : null}
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
    </div>
  );
}

function MatchInfoPanel({
  fx,
  onClose,
}: {
  fx: SlimFx;
  onClose: () => void;
}) {
  return (
    <Section title="Match info" dense>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1 text-xs">
          <div className="font-semibold text-[#e2e8f0]">
            {fx.home.name}{" "}
            <span className="tabular-nums">{scoreLabel(fx)}</span>{" "}
            {fx.away.name}
          </div>
          <div className="text-[#64748b] tabular-nums">{whenLabel(fx.date)}</div>
          <div className="text-[#64748b]">
            {fx.statusLong || fx.status}
            {fx.elapsed != null ? ` · ${fx.elapsed}'` : ""}
            {fx.round ? ` · ${fx.round}` : ""}
          </div>
          <div className="text-[10px] text-[#64748b] tabular-nums">
            Fixture id {fx.id}
          </div>
        </div>
        <button
          type="button"
          className="player-dossier-icon-btn focus-ring shrink-0"
          onClick={onClose}
          aria-label="Close match info"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </Section>
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

function FxList({
  items,
  empty,
  highlight,
  onSelect,
  selectedId,
}: {
  items: SlimFx[];
  empty: string;
  highlight: Set<number>;
  onSelect: (fx: SlimFx) => void;
  selectedId?: number;
}) {
  if (!items.length) return <p className="text-xs text-[#64748b]">{empty}</p>;
  return (
    <ul className="space-y-1 text-xs">
      {items.map((fx) => {
        const hi = highlight.has(fx.home.id) || highlight.has(fx.away.id);
        const selected = selectedId === fx.id;
        return (
          <li key={fx.id}>
            <button
              type="button"
              onClick={() => onSelect(fx)}
              className={cn(
                "w-full flex gap-2 items-center rounded-[2px] px-1.5 py-1 text-left border border-transparent hover:bg-[#12161c] hover:border-white/[0.06]",
                hi && "bg-[#12161c] font-semibold",
                selected && "border-white/20 bg-[#161b22]"
              )}
              data-league-fx={fx.id}
            >
              <span className="text-[#64748b] w-28 shrink-0 tabular-nums text-[10px]">
                {whenLabel(fx.date)}
              </span>
              <span className="flex-1 truncate text-[#e2e8f0]">
                {fx.home.name} vs {fx.away.name}
              </span>
              <span className="tabular-nums font-semibold text-[#e2e8f0]">
                {scoreLabel(fx)}
              </span>
              <span className="text-[10px] text-[#64748b] w-8 shrink-0">
                {fx.status}
              </span>
            </button>
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
