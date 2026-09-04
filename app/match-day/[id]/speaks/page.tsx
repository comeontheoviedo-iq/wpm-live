import { notFound } from "next/navigation";
import { getMatchFull } from "@/lib/match-data";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SpeaksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatchFull(id);
  if (!match) notFound();

  const groups = ["pre-match", "kickoff", "half-time", "full-time"] as const;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Speaks</h2>
        <p className="text-sm text-slate-500">
          Timed commentary cues for {match.homeClub.shortName} vs{" "}
          {match.awayClub.shortName}
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {groups.map((g) => {
          const items = match.speaks.filter((s) => s.timing === g);
          if (!items.length) return null;
          return (
            <Card key={g}>
              <CardHeader>
                <CardTitle className="capitalize">{g.replace("-", " ")}</CardTitle>
              </CardHeader>
              <CardBody className="space-y-3">
                {items.map((s) => (
                  <article
                    key={s.id}
                    className="rounded-lg border border-slate-100 dark:border-slate-800 p-3"
                  >
                    <h4 className="text-sm font-semibold text-teal-700 dark:text-teal-300">
                      {s.title}
                    </h4>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {s.body}
                    </p>
                  </article>
                ))}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
