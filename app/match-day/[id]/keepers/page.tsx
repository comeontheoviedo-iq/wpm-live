import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getMatchFull } from "@/lib/match-data";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

export default async function KeepersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatchFull(id);
  if (!match) notFound();
  const keepers = await prisma.seasonKeeper.findMany({
    orderBy: { rank: "asc" },
    include: { player: true, club: true },
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Top keepers</h2>
        <p className="text-sm text-slate-500">Clean sheets & save volume</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Goalkeeper leaderboard</CardTitle>
        </CardHeader>
        <CardBody className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-100 dark:border-slate-800">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">Keeper</th>
                <th className="py-2 pr-2">Club</th>
                <th className="py-2 pr-2 text-right">CS</th>
                <th className="py-2 pr-2 text-right">Saves</th>
                <th className="py-2 text-right">Apps</th>
              </tr>
            </thead>
            <tbody>
              {keepers.map((k) => {
                const highlight =
                  k.clubId === match.homeClubId || k.clubId === match.awayClubId;
                return (
                  <tr
                    key={k.id}
                    className={`border-b border-slate-50 dark:border-slate-800/60 ${
                      highlight ? "bg-teal-50/50 dark:bg-teal-950/20" : ""
                    }`}
                  >
                    <td className="py-2.5 pr-2 font-semibold text-slate-500">
                      {k.rank}
                    </td>
                    <td className="py-2.5 pr-2 font-medium">{k.player.name}</td>
                    <td className="py-2.5 pr-2">
                      {k.club.badgeEmoji} {k.club.shortName}
                    </td>
                    <td className="py-2.5 pr-2 text-right font-bold tabular-nums">
                      {k.cleanSheets}
                    </td>
                    <td className="py-2.5 pr-2 text-right tabular-nums">
                      {k.saves}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-slate-500">
                      {k.appearances}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}
