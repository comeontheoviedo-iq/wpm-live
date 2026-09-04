import { notFound } from "next/navigation";
import { getMatchFull } from "@/lib/match-data";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ClubsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatchFull(id);
  if (!match) notFound();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Clubs</h2>
        <p className="text-sm text-slate-500">Profiles & squads</p>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        {[match.homeClub, match.awayClub].map((club) => (
          <Card key={club.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-white text-sm"
                  style={{ backgroundColor: club.primaryColor }}
                >
                  {club.abbreviation.slice(0, 2)}
                </span>
                {club.badgeEmoji} {club.name}
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Nickname</span>
                  <div className="font-medium">{club.nickname}</div>
                </div>
                <div>
                  <span className="text-slate-500">Founded</span>
                  <div className="font-medium">{club.founded}</div>
                </div>
                <div>
                  <span className="text-slate-500">City</span>
                  <div className="font-medium">{club.city}</div>
                </div>
                <div>
                  <span className="text-slate-500">Home</span>
                  <div className="font-medium">{club.stadiumName}</div>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase text-slate-500 mb-2">
                  Coach
                </h4>
                {club.coaches[0] && (
                  <p>
                    {club.coaches[0].name} · {club.coaches[0].nationality}
                    {club.coaches[0].age ? ` · ${club.coaches[0].age}y` : ""}
                  </p>
                )}
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase text-slate-500 mb-2">
                  Squad ({club.players.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-80 overflow-y-auto">
                  {club.players.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-xs"
                    >
                      <span className="w-6 font-bold tabular-nums text-slate-400">
                        {p.shirtNumber}
                      </span>
                      <span className="font-medium flex-1 truncate">
                        {p.name}
                        {p.isCaptain ? " ©" : ""}
                      </span>
                      <span className="text-slate-400">{p.position}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
