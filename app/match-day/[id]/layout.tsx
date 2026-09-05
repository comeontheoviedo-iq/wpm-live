import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getMatchFull } from "@/lib/match-data";
import { AppHeader } from "@/components/layout/app-header";
import { MatchNav } from "@/components/layout/match-nav";
import { StatusControl } from "@/components/match/status-control";
import { DeleteMatchDesk } from "@/components/match/delete-match-desk";
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
    <div className="min-h-dvh pb-0">
      <AppHeader user={user} matchId={match.id} />
      <div className="desk-chrome relative overflow-hidden bg-white/95 dark:bg-slate-950/95">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(13,148,136,0.08),transparent_45%),radial-gradient(ellipse_at_top_right,rgba(14,165,233,0.06),transparent_40%)]"
        />
        <div className="relative mx-auto flex max-w-[1600px] flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-4 sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="text-xl drop-shadow-sm sm:text-2xl">
              {match.homeClub.badgeEmoji}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold tracking-tight text-slate-900 dark:text-white sm:text-base">
                {match.homeClub.name}{" "}
                <span className="font-medium text-slate-400">vs</span>{" "}
                {match.awayClub.name}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 sm:text-desk-xs">
                <span className="font-medium text-slate-600 dark:text-slate-400">
                  {match.matchDay.competition}
                </span>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <span>{formatKickoff(match.kickoff)}</span>
                <StatusBadge status={match.status} />
                {match.status === "Live" && (
                  <span className="rounded-full bg-rose-500/10 px-2 py-0.5 font-semibold tabular-nums text-rose-600 ring-1 ring-rose-500/20 dark:text-rose-400">
                    {match.minute}&apos; · {match.homeScore}-{match.awayScore}
                  </span>
                )}
              </div>
            </div>
            <span className="text-xl drop-shadow-sm sm:text-2xl">
              {match.awayClub.badgeEmoji}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <StatusControl matchId={match.id} status={match.status} />
            <DeleteMatchDesk
              matchDayId={match.matchDayId}
              matchLabel={`${match.homeClub.shortName} vs ${match.awayClub.shortName}`}
              variant="overflow"
            />
          </div>
        </div>
      </div>
      <MatchNav matchId={match.id} />
      <div className="mx-auto max-w-[1600px] px-2 py-1.5 sm:px-3">{children}</div>
    </div>
  );
}
