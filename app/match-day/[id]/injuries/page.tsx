import { notFound } from "next/navigation";
import { getMatchFull } from "@/lib/match-data";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const tone: Record<string, string> = {
  out: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  doubtful: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  suspended:
    "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  fit: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

function parseOutSince(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const m = notes.match(/Out since\s+(\d{4}-\d{2}-\d{2}|\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4})/i);
  return m?.[1] || null;
}

function formatDay(raw: string): string {
  // Prefer en-GB London label when ISO-ish
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    try {
      return new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(raw.slice(0, 10) + "T12:00:00Z"));
    } catch {
      return raw;
    }
  }
  return raw;
}

export default async function InjuriesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatchFull(id);
  if (!match) notFound();

  const byClub = [
    {
      club: match.homeClub,
      items: match.injuries.filter((i) => i.clubId === match.homeClubId),
    },
    {
      club: match.awayClub,
      items: match.injuries.filter((i) => i.clubId === match.awayClubId),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Injuries & availability</h2>
        <p className="text-sm text-slate-500">
          Matchday medical board · out-since / return when API-Football provides
          them · Sync to refresh
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {byClub.map(({ club, items }) => (
          <Card key={club.id}>
            <CardHeader>
              <CardTitle>
                {club.badgeEmoji} {club.name}
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              {items.length === 0 && (
                <p className="text-sm text-slate-500">No issues listed.</p>
              )}
              {items.map((inj) => {
                const outSince = parseOutSince(inj.notes);
                const ret = inj.expectedReturn;
                return (
                  <div
                    key={inj.id}
                    className="rounded-xl border border-slate-100 dark:border-slate-800 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-sm">
                        #{inj.player.shirtNumber} {inj.player.name}
                      </div>
                      <Badge className={tone[inj.status] || tone.doubtful}>
                        {inj.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {inj.injuryType}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                      <span>
                        <span className="text-slate-400">Out since </span>
                        {outSince ? formatDay(outSince) : "—"}
                      </span>
                      <span>
                        <span className="text-slate-400">Expected return </span>
                        {ret ? formatDay(ret) : "—"}
                      </span>
                    </div>
                    {inj.notes && !outSince && (
                      <p className="text-xs mt-2 text-slate-600 dark:text-slate-300">
                        {inj.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
