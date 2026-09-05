"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  homeName?: string;
  awayName?: string;
  standings: StandingRow[];
  recent: SlimFx[];
  upcoming: SlimFx[];
  live: SlimFx[];
  todayFixtures: SlimFx[];
  warnings?: string[];
  message?: string | null;
  error?: string;
};

function scoreLabel(fx: SlimFx) {
  const h = fx.goals.home;
  const a = fx.goals.away;
  if (h == null || a == null) return "–";
  return `${h}–${a}`;
}

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

function FixtureList({
  items,
  empty,
  highlightIds,
}: {
  items: SlimFx[];
  empty: string;
  highlightIds?: Set<number>;
}) {
  if (!items.length) {
    return <p className="text-xs text-slate-500 py-3">{empty}</p>;
  }
  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {items.map((fx) => {
        const hi =
          highlightIds &&
          (highlightIds.has(fx.home.id) || highlightIds.has(fx.away.id));
        return (
          <li
            key={fx.id}
            className={cn(
              "flex items-center gap-2 py-2 text-xs",
              hi && "bg-teal-50/60 dark:bg-teal-950/30 -mx-1 px-1 rounded"
            )}
          >
            <span className="w-[7.5rem] shrink-0 text-slate-500 tabular-nums">
              {fx.status === "1H" || fx.status === "2H" || fx.status === "HT" || fx.status === "LIVE"
                ? `${fx.elapsed ?? "LIVE"}'`
                : whenLabel(fx.date)}
            </span>
            <span className="flex-1 min-w-0 truncate font-medium">
              {fx.home.name}{" "}
              <span className="text-slate-400 font-normal">vs</span>{" "}
              {fx.away.name}
            </span>
            <span
              className={cn(
                "tabular-nums font-semibold shrink-0",
                fx.status === "1H" || fx.status === "2H" || fx.status === "LIVE"
                  ? "text-rose-600"
                  : "text-slate-700 dark:text-slate-200"
              )}
            >
              {scoreLabel(fx)}
            </span>
            <span className="w-10 text-right text-[10px] text-slate-400 shrink-0">
              {fx.status}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function LeagueIntel({ matchId }: { matchId: string }) {
  const [data, setData] = useState<LeaguePayload | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/league`);
      const json = (await res.json()) as LeaguePayload;
      if (!res.ok && json.error) throw new Error(json.error);
      setData(json);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load league intel");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  const highlight = new Set<number>();
  if (data?.homeTeamId) highlight.add(data.homeTeamId);
  if (data?.awayTeamId) highlight.add(data.awayTeamId);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold">League</h1>
          <p className="text-xs text-slate-500">
            {data
              ? `${data.competition}${data.leagueId ? ` · AF ${data.leagueId}` : ""} · season ${data.season}`
              : "Competition table, form, fixtures & live scores from API-Football."}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => load()}
          disabled={busy}
          className="gap-1.5"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </Button>
      </div>

      {err && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-900 dark:text-amber-100 flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {err}
        </div>
      )}

      {data?.message && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
          {data.message}
        </div>
      )}

      {data?.warnings?.length ? (
        <ul className="text-[11px] text-amber-800 dark:text-amber-200 space-y-0.5 list-disc pl-4">
          {data.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}

      {busy && !data ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading league intel…
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Live in competition</CardTitle>
            </CardHeader>
            <CardBody>
              <FixtureList
                items={data?.live || []}
                empty="No live matches in this competition right now."
                highlightIds={highlight}
              />
            </CardBody>
          </Card>

          <Card className="lg:row-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Table</CardTitle>
            </CardHeader>
            <CardBody className="overflow-x-auto">
              {!data?.standings?.length ? (
                <p className="text-xs text-slate-500 py-3">
                  No standings returned (plan limits or season not available).
                </p>
              ) : (
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-slate-800">
                      <th className="py-1.5 pr-1 font-medium">#</th>
                      <th className="py-1.5 pr-2 font-medium">Club</th>
                      <th className="py-1.5 px-1 font-medium text-right">P</th>
                      <th className="py-1.5 px-1 font-medium text-right">W</th>
                      <th className="py-1.5 px-1 font-medium text-right">D</th>
                      <th className="py-1.5 px-1 font-medium text-right">L</th>
                      <th className="py-1.5 px-1 font-medium text-right">GD</th>
                      <th className="py-1.5 pl-1 font-medium text-right">Pts</th>
                      <th className="py-1.5 pl-2 font-medium">Form</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.standings.map((r) => {
                      const hi = highlight.has(r.teamId);
                      return (
                        <tr
                          key={`${r.rank}-${r.teamId}`}
                          className={cn(
                            "border-b border-slate-50 dark:border-slate-900",
                            hi && "bg-teal-50 dark:bg-teal-950/40 font-semibold"
                          )}
                        >
                          <td className="py-1.5 pr-1 tabular-nums text-slate-500">
                            {r.rank}
                          </td>
                          <td className="py-1.5 pr-2 truncate max-w-[10rem]">
                            {r.team}
                          </td>
                          <td className="py-1.5 px-1 text-right tabular-nums">
                            {r.played}
                          </td>
                          <td className="py-1.5 px-1 text-right tabular-nums">
                            {r.won}
                          </td>
                          <td className="py-1.5 px-1 text-right tabular-nums">
                            {r.drawn}
                          </td>
                          <td className="py-1.5 px-1 text-right tabular-nums">
                            {r.lost}
                          </td>
                          <td className="py-1.5 px-1 text-right tabular-nums">
                            {r.gd}
                          </td>
                          <td className="py-1.5 pl-1 text-right tabular-nums font-semibold">
                            {r.points}
                          </td>
                          <td className="py-1.5 pl-2 font-mono text-[10px] tracking-tight text-slate-500">
                            {r.form || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recent results</CardTitle>
            </CardHeader>
            <CardBody>
              <FixtureList
                items={data?.recent || []}
                empty="No recent results (check Free-plan season access)."
                highlightIds={highlight}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Upcoming fixtures</CardTitle>
            </CardHeader>
            <CardBody>
              <FixtureList
                items={data?.upcoming || []}
                empty="No upcoming fixtures returned."
                highlightIds={highlight}
              />
            </CardBody>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Today in competition</CardTitle>
            </CardHeader>
            <CardBody>
              <FixtureList
                items={data?.todayFixtures || []}
                empty="No fixtures for this league today."
                highlightIds={highlight}
              />
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
