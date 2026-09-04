import { notFound } from "next/navigation";
import { getMatchFull } from "@/lib/match-data";
import { OverviewBoard } from "@/components/match/overview-board";
import { EventComposer } from "@/components/live/event-composer";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function MatchOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatchFull(id);
  if (!match) notFound();

  const referee = match.officials.find((o) => o.role === "Referee")?.official
    .name;

  const players = [
    ...match.homeClub.players.map((p) => ({
      id: p.id,
      name: p.name,
      shirtNumber: p.shirtNumber,
      side: "home" as const,
      team: match.homeClub.shortName,
    })),
    ...match.awayClub.players.map((p) => ({
      id: p.id,
      name: p.name,
      shirtNumber: p.shirtNumber,
      side: "away" as const,
      team: match.awayClub.shortName,
    })),
  ];

  const done = match.checklistItems.filter((c) => c.done).length;
  const total = match.checklistItems.length;

  return (
    <div className="grid lg:grid-cols-12 gap-4">
      <aside className="lg:col-span-3 space-y-3 order-2 lg:order-1">
        <Card>
          <CardHeader>
            <CardTitle>Match Events</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 max-h-72 overflow-y-auto">
            {match.events.length === 0 && (
              <p className="text-xs text-slate-500">No events yet.</p>
            )}
            {match.events.map((e) => (
              <div
                key={e.id}
                className="rounded-lg bg-slate-50 dark:bg-slate-800/60 px-2.5 py-2 text-xs"
              >
                <div className="font-semibold text-teal-700 dark:text-teal-300">
                  {e.minute}&apos; · {e.type.replace("_", " ")}
                </div>
                <div className="text-slate-700 dark:text-slate-200">
                  {e.description}
                </div>
                {e.commentary && (
                  <div className="mt-1 italic text-slate-500">
                    “{e.commentary}”
                  </div>
                )}
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Match Statistics</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {match.statistics.map((s) => (
              <div
                key={s.id}
                className="grid grid-cols-3 text-xs items-center gap-2"
              >
                <span className="text-right font-semibold tabular-nums">
                  {s.homeValue}
                </span>
                <span className="text-center text-slate-500">{s.label}</span>
                <span className="font-semibold tabular-nums">{s.awayValue}</span>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prep snapshot</CardTitle>
          </CardHeader>
          <CardBody className="text-sm space-y-2">
            <div>
              Checklist: {done}/{total} complete
            </div>
            <div>Scripts: {match.speaks.length} loaded</div>
            <div>Notes: {match.notes.length}</div>
            <div>Injuries tracked: {match.injuries.length}</div>
            <Link
              href={`/match-day/${match.id}/prep`}
              className="text-teal-600 text-xs font-medium hover:underline"
            >
              Open prep →
            </Link>
          </CardBody>
        </Card>
      </aside>

      <section className="lg:col-span-6 order-1 lg:order-2 space-y-4">
        <OverviewBoard
          matchId={match.id}
          homeName={match.homeClub.shortName}
          awayName={match.awayClub.shortName}
          homeColor={match.homeClub.primaryColor}
          awayColor={match.awayClub.primaryColor}
          homeFormation={match.homeFormation}
          awayFormation={match.awayFormation}
          homePlayers={match.homeClub.players}
          awayPlayers={match.awayClub.players}
          homeCoach={match.homeClub.coaches[0]}
          awayCoach={match.awayClub.coaches[0]}
          referee={referee}
          lineupStatus={match.lineupStatus}
          apiFootballFixtureId={match.apiFootballFixtureId}
          lastFeedSyncAt={match.lastFeedSyncAt}
          status={match.status}
          notes={match.notes.map((n) => ({
            id: n.id,
            title: n.title,
            body: n.body,
            category: n.category,
            entityType: n.entityType,
            entityId: n.entityId,
            pinned: n.pinned,
          }))}
        />
      </section>

      <aside className="lg:col-span-3 space-y-3 order-3">
        <EventComposer
          matchId={match.id}
          homeName={match.homeClub.shortName}
          awayName={match.awayClub.shortName}
          homeScore={match.homeScore}
          awayScore={match.awayScore}
          minute={match.minute || 1}
          players={players}
          compact
        />
        <Card>
          <CardHeader>
            <CardTitle>Quick links</CardTitle>
          </CardHeader>
          <CardBody className="grid grid-cols-2 gap-2 text-xs">
            {[
              "scripts",
              "packs",
              "notes",
              "injuries",
              "scorers",
              "keepers",
              "penalties",
              "venue",
              "weather",
              "fans",
              "live",
              "print",
            ].map((s) => (
              <Link
                key={s}
                href={`/match-day/${match.id}/${s}`}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-2 capitalize hover:border-teal-400 text-center"
              >
                {s}
              </Link>
            ))}
          </CardBody>
        </Card>
        <p className="text-[10px] text-slate-400 px-1">
          Data freshness:{" "}
          {match.lastFeedSyncAt
            ? `API-Football sync ${new Date(match.lastFeedSyncAt).toLocaleString("en-GB", { timeZone: "Europe/London" })} PT`
            : "seeded / manual · sync when key linked"}
        </p>
      </aside>
    </div>
  );
}
