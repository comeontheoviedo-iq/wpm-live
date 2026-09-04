import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getMatchFull } from "@/lib/match-data";
import { AppHeader } from "@/components/layout/app-header";
import { MatchNav } from "@/components/layout/match-nav";
import { StatusControl } from "@/components/match/status-control";
import { StatusBadge } from "@/components/ui/badge";
import { formatKickoff } from "@/lib/utils";

export default async function MatchDayLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/login");
  const { id } = await params;
  const match = await getMatchFull(id);
  if (!match) notFound();

  return (
    <div className="min-h-dvh pb-2">
      <AppHeader user={user} matchId={match.id} />
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="mx-auto max-w-[1600px] px-3 sm:px-4 py-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xl sm:text-2xl">{match.homeClub.badgeEmoji}</span>
            <div className="min-w-0">
              <div className="font-bold text-slate-900 dark:text-white truncate text-sm sm:text-base">
                {match.homeClub.name}{" "}
                <span className="text-slate-400 font-normal">vs</span>{" "}
                {match.awayClub.name}
              </div>
              <div className="text-[11px] sm:text-xs text-slate-500 flex flex-wrap items-center gap-2">
                <span>{match.matchDay.competition}</span>
                <span>·</span>
                <span>{formatKickoff(match.kickoff)}</span>
                <StatusBadge status={match.status} />
                {match.status === "Live" && (
                  <span className="font-semibold text-rose-600">
                    {match.minute}&apos; · {match.homeScore}-{match.awayScore}
                  </span>
                )}
              </div>
            </div>
            <span className="text-xl sm:text-2xl">{match.awayClub.badgeEmoji}</span>
          </div>
          <div className="sm:ml-auto">
            <StatusControl matchId={match.id} status={match.status} />
          </div>
        </div>
      </div>
      <MatchNav matchId={match.id} />
      <div className="mx-auto max-w-[1600px] px-3 sm:px-4 py-2">{children}</div>
    </div>
  );
}
