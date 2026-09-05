import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/layout/app-header";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { formatKickoff } from "@/lib/utils";
import {
  CalendarDays,
  StickyNote,
  Radio,
  AlertTriangle,
  MessageSquare,
  Plus,
} from "lucide-react";
import { DeleteMatchDesk } from "@/components/match/delete-match-desk";

export default async function DashboardPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const matchDays = await prisma.matchDay.findMany({
    orderBy: { date: "asc" },
    include: {
      matches: {
        include: {
          homeClub: true,
          awayClub: true,
        },
        orderBy: { kickoff: "asc" },
      },
    },
  });

  const allMatches = matchDays.flatMap((md) => md.matches);
  const liveCount = allMatches.filter((m) => m.status === "Live").length;
  const upcoming = allMatches.filter((m) => m.status !== "Full Time");
  const featured = upcoming.find((m) => m.featured) || upcoming[0];

  const [openChecklist, scriptsCount, notesCount] = await Promise.all([
    featured
      ? prisma.checklistItem.count({
          where: { matchId: featured.id, done: false },
        })
      : Promise.resolve(0),
    featured
      ? prisma.speak.count({ where: { matchId: featured.id } })
      : Promise.resolve(0),
    featured
      ? prisma.note.count({ where: { matchId: featured.id } })
      : Promise.resolve(0),
  ]);

  return (
    <div className="min-h-screen">
      <AppHeader user={user} matchId={featured?.id} />
      <main className="mx-auto max-w-[1400px] px-3 sm:px-4 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Good call, {user.name.split(" ")[0]}
            </h1>
            <p className="text-sm text-slate-500">
              Your commentary desk · Pitchline
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/match-day/new"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm hover:border-teal-400"
            >
              <Plus className="h-4 w-4" /> Add Match Desk
            </Link>
            {featured ? (
              <Link
                href={`/match-day/${featured.id}/notes`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm hover:border-teal-400"
              >
                <Plus className="h-4 w-4" /> Add Note
              </Link>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={<CalendarDays className="h-4 w-4" />}
            label="Match desks"
            value={String(matchDays.length)}
            tone="bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
          />
          <StatCard
            icon={<StickyNote className="h-4 w-4" />}
            label="Notes"
            value={String(notesCount)}
            tone="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          />
          <StatCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Open prep items"
            value={String(openChecklist)}
            tone="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          />
          <StatCard
            icon={<MessageSquare className="h-4 w-4" />}
            label="Scripts ready"
            value={String(scriptsCount)}
            tone="bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-teal-600" />
                My Match Desks
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              {matchDays.length === 0 && (
                <p className="text-sm text-slate-500">
                  No desks yet.{" "}
                  <Link href="/match-day/new" className="text-teal-600 hover:underline">
                    Create one
                  </Link>
                  .
                </p>
              )}
              {matchDays.map((md) => {
                const m0 = md.matches[0];
                const matchLabel = m0
                  ? `${m0.homeClub.shortName} vs ${m0.awayClub.shortName}`
                  : md.title;
                return (
                  <div
                    key={md.id}
                    className="rounded-lg border border-slate-100 dark:border-slate-800 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{md.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {formatKickoff(md.date)} · {md.competition} ·{" "}
                          {md.matches.length} matches
                        </div>
                      </div>
                      <DeleteMatchDesk
                        matchDayId={md.id}
                        matchLabel={matchLabel}
                        variant="list"
                      />
                    </div>
                    {m0 && (
                      <Link
                        href={`/match-day/${m0.id}`}
                        className="mt-2 inline-block text-xs text-teal-700 dark:text-teal-300 hover:underline"
                      >
                        Open desk →
                      </Link>
                    )}
                  </div>
                );
              })}
            </CardBody>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-rose-500" />
                Live and Upcoming Matches
              </CardTitle>
              <span className="text-xs text-slate-500">
                Live ({liveCount})
              </span>
            </CardHeader>
            <CardBody className="space-y-2">
              {upcoming.map((m) => (
                <Link
                  key={m.id}
                  href={`/match-day/${m.id}`}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-800 p-3 hover:border-teal-300 dark:hover:border-teal-700 hover:bg-teal-50/40 dark:hover:bg-teal-950/20 transition"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-lg">
                    {m.homeClub.badgeEmoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {m.homeClub.shortName} vs {m.awayClub.shortName}
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatKickoff(m.kickoff)}
                      {m.featured ? " · Featured" : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold tabular-nums">
                      {m.homeScore} – {m.awayScore}
                    </div>
                    <StatusBadge status={m.status} />
                  </div>
                </Link>
              ))}
              {upcoming.length === 0 && (
                <p className="text-sm text-slate-500">No upcoming matches.</p>
              )}
            </CardBody>
          </Card>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className={`rounded-xl p-4 ${tone}`}>
      <div className="flex items-center gap-2 text-xs font-medium opacity-80">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}
