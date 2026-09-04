import { notFound } from "next/navigation";
import { getMatchFull } from "@/lib/match-data";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function ScriptsPage({
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
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Scripts</h2>
          <p className="text-sm text-slate-500">
            Timed commentary cues for {match.homeClub.shortName} vs{" "}
            {match.awayClub.shortName}
          </p>
        </div>
        <Link
          href={`/match-day/${match.id}/packs`}
          className="text-sm text-teal-700 dark:text-teal-300 hover:underline"
        >
          Generate from Packs →
        </Link>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {groups.map((g) => {
          const items = match.speaks.filter((s) => s.timing === g);
          return (
            <Card key={g}>
              <CardHeader>
                <CardTitle className="capitalize">{g.replace("-", " ")}</CardTitle>
              </CardHeader>
              <CardBody className="space-y-3">
                {items.length === 0 && (
                  <p className="text-xs text-slate-500">No scripts in this slot yet.</p>
                )}
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
