import { notFound } from "next/navigation";
import { getMatchFull } from "@/lib/match-data";
import { playingColorsForMatch } from "@/lib/kit-colors";
import { EventComposer } from "@/components/live/event-composer";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedBanner } from "@/components/match/feed-banner";
import { LivePitch } from "@/components/match/live-pitch";
import { EventTimeline } from "@/components/match/event-timeline";

export default async function LivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatchFull(id);
  if (!match) notFound();

  const { homeColor, awayColor, homeKit, awayKit } =
    playingColorsForMatch(match);

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

  const notes = match.notes.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    category: n.category,
    entityType: n.entityType,
    entityId: n.entityId,
    pinned: n.pinned,
  }));

  const referee = match.officials.find((o) => o.role === "Referee")?.official.name;

  return (
    <div className="space-y-4">
      <FeedBanner
        matchId={match.id}
        apiFootballFixtureId={match.apiFootballFixtureId}
        lineupStatus={match.lineupStatus}
        lastFeedSyncAt={match.lastFeedSyncAt}
        status={match.status}
      />
      <div className="grid lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 space-y-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              Live desk
              {match.status === "Live" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 text-white text-[10px] px-2 py-0.5 uppercase tracking-wide">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  On air
                </span>
              )}
            </h2>
            <p className="text-sm text-slate-500">
              Score {match.homeScore}–{match.awayScore}
              {match.status === "Live" ? ` · ${match.minute}'` : ""} · composer +
              formation sync
            </p>
          </div>
          <EventComposer
            matchId={match.id}
            homeName={match.homeClub.shortName}
            awayName={match.awayClub.shortName}
            homeScore={match.homeScore}
            awayScore={match.awayScore}
            minute={match.minute || 1}
            players={players}
          />
        </div>
        <div className="lg:col-span-4 space-y-3">
          <LivePitch
            matchId={match.id}
            homeName={match.homeClub.shortName}
            awayName={match.awayClub.shortName}
            homeColor={homeColor}
            awayColor={awayColor}
            homeKit={homeKit}
            awayKit={awayKit}
            homeFormation={match.homeFormation}
            awayFormation={match.awayFormation}
            homePlayers={match.homeClub.players}
            awayPlayers={match.awayClub.players}
            homeCoach={match.homeClub.coaches[0]}
            awayCoach={match.awayClub.coaches[0]}
            referee={referee}
            lineupStatus={match.lineupStatus}
            notes={notes}
          />
        </div>
        <div className="lg:col-span-3">
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle>Event timeline</CardTitle>
            </CardHeader>
            <CardBody className="max-h-[70vh] overflow-hidden">
              <EventTimeline
                events={match.events.map((e) => ({
                  id: e.id,
                  type: e.type,
                  minute: e.minute,
                  description: e.description,
                  teamSide: e.teamSide,
                  commentary: e.commentary,
                  playerId: e.playerId,
                }))}
                maxHeightClass="max-h-[70vh]"
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
