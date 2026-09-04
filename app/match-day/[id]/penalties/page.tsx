import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getMatchFull } from "@/lib/match-data";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PenaltiesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatchFull(id);
  if (!match) notFound();
  const records = await prisma.penaltyRecord.findMany({
    where: {
      clubId: { in: [match.homeClubId, match.awayClubId] },
    },
    include: { club: true, player: true },
  });
  const matchPens = match.events.filter((e) =>
    ["penalty_goal", "penalty_miss"].includes(e.type)
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Penalties</h2>
        <p className="text-sm text-slate-500">
          This match&apos;s spot-kicks plus club taker records
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Match penalty events</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2">
          {matchPens.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">
              No penalty events yet — Sync during/after the match to load.
            </p>
          ) : (
            matchPens.map((e) => (
              <div
                key={e.id}
                className="rounded-xl border border-slate-100 dark:border-slate-800 px-3 py-2 text-sm flex items-center justify-between gap-2"
              >
                <div>
                  <span className="font-bold text-teal-700 dark:text-teal-300 tabular-nums mr-2">
                    {e.minute}&apos;
                  </span>
                  {e.description}
                </div>
                <span
                  className={`text-[10px] uppercase font-bold ${
                    e.type === "penalty_goal"
                      ? "text-emerald-600"
                      : "text-amber-600"
                  }`}
                >
                  {e.type === "penalty_goal" ? "Scored" : "Missed"}
                </span>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {[match.homeClub, match.awayClub].map((club) => {
          const clubRecords = records.filter((r) => r.clubId === club.id);
          return (
            <Card key={club.id}>
              <CardHeader>
                <CardTitle>
                  {club.badgeEmoji} {club.name}
                </CardTitle>
              </CardHeader>
              <CardBody className="space-y-3">
                {clubRecords.length === 0 ? (
                  <p className="text-sm text-slate-500 py-2">
                    Sync to load penalty taker records.
                  </p>
                ) : (
                  clubRecords.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-xl border border-slate-100 dark:border-slate-800 p-3"
                    >
                      <div className="font-semibold text-sm">{r.takerName}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2 py-0.5">
                          Scored {r.scored}
                        </span>
                        <span className="rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2 py-0.5">
                          Missed {r.missed}
                        </span>
                        <span className="rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 px-2 py-0.5">
                          Saved {r.saved}
                        </span>
                        <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 capitalize">
                          {r.preference}
                        </span>
                      </div>
                      {r.notes && (
                        <p className="text-xs text-slate-500 mt-2">{r.notes}</p>
                      )}
                    </div>
                  ))
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
