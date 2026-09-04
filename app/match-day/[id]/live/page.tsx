import { notFound } from "next/navigation";
import { getMatchFull } from "@/lib/match-data";
import { EventComposer } from "@/components/live/event-composer";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

export default async function LivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatchFull(id);
  if (!match) notFound();

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

  return (
    <div className="grid lg:grid-cols-5 gap-4">
      <div className="lg:col-span-3 space-y-4">
        <div className="flex items-end justify-between gap-3">
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
              {match.status === "Live" ? ` · ${match.minute}'` : ""} · mobile-first
              composer with keyboard shortcuts
            </p>
          </div>
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
      <div className="lg:col-span-2">
        <Card className="sticky top-20">
          <CardHeader>
            <CardTitle>Event timeline</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 max-h-[70vh] overflow-y-auto">
            {match.events.map((e) => (
              <div
                key={e.id}
                className="rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-teal-700 dark:text-teal-300">
                    {e.minute}&apos;
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">
                    {e.type.replace("_", " ")}
                  </span>
                </div>
                <div className="mt-0.5">{e.description}</div>
                {e.commentary && (
                  <div className="mt-1 text-xs italic text-slate-500">
                    {e.commentary}
                  </div>
                )}
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
