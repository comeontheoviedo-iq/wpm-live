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
          <h2 className="text-xl font-bold tracking-tight">Scripts</h2>
          <p className="text-sm text-[var(--muted)]">
            Timed commentary cues for {match.homeClub.shortName} vs{" "}
            {match.awayClub.shortName}
          </p>
        </div>
        <Link
          href={`/match-day/${match.id}/packs`}
          className="text-sm font-semibold text-[var(--brand-dark)] dark:text-[var(--brand)] hover:underline"
        >
          Generate from Research →
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
                  <p className="text-xs text-[var(--muted)]">No scripts in this slot yet.</p>
                )}
                {items.map((s) => (
                  <article
                    key={s.id}
                    className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)] p-3"
                  >
                    <h4 className="text-sm font-semibold text-[var(--foreground)]">
                      {s.title}
                    </h4>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)] leading-relaxed whitespace-pre-wrap">
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
