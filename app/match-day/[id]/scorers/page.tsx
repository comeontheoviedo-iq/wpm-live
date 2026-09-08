import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getMatchFull } from "@/lib/match-data";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ScorersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatchFull(id);
  if (!match) notFound();
  const scorers = await prisma.seasonScorer.findMany({
    where: { clubId: { in: [match.homeClubId, match.awayClubId] } },
    orderBy: [{ goals: "desc" }, { rank: "asc" }],
    include: { player: true, club: true },
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Top scorers</h2>
        <p className="text-sm text-slate-500">
          Season goals for {match.homeClub.shortName} &{" "}
          {match.awayClub.shortName}
          {match.matchDay.competition ? ` · ${match.matchDay.competition}` : ""}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Scoring chart</CardTitle>
        </CardHeader>
        <CardBody className="overflow-x-auto">
          {scorers.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              Sync to load season scorers from the live feed.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-100 dark:border-slate-800">
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">Player</th>
                  <th className="py-2 pr-2">Club</th>
                  <th className="py-2 pr-2 text-right">G</th>
                  <th className="py-2 text-right">A</th>
                </tr>
              </thead>
              <tbody>
                {scorers.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-slate-50 dark:border-slate-800/60 bg-teal-50/40 dark:bg-teal-950/20"
                  >
                    <td className="py-2.5 pr-2 font-semibold text-slate-500">
                      {s.rank}
                    </td>
                    <td className="py-2.5 pr-2 font-medium">{s.player.name}</td>
                    <td className="py-2.5 pr-2">
                      {s.club.badgeEmoji} {s.club.shortName}
                    </td>
                    <td className="py-2.5 pr-2 text-right font-bold tabular-nums">
                      {s.goals}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-slate-500">
                      {s.assists}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
