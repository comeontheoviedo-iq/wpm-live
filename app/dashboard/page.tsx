import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { StatusBadge } from "@/components/ui/badge";
import { cn, formatKickoff } from "@/lib/utils";
import {
  CalendarDays,
  StickyNote,
  Radio,
  AlertTriangle,
  MessageSquare,
  Plus,
  ArrowRight,
  Mic2,
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

  const firstName = user.name.split(" ")[0] || "Commentator";

  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <AppHeader user={user} matchId={featured?.id} />
      <div className="flex min-h-0 w-full items-stretch">
        <AppSidebar liveCount={liveCount} />
        <main className="min-w-0 flex-1 px-2 py-2 sm:px-3 sm:py-3">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-3">
            {/* Desk strip — not a marketing hero */}
            <section className="desk-header flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-3.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Mic2 className="h-3.5 w-3.5 text-[var(--brand)]" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                    Hub · {firstName}
                  </span>
                  {liveCount > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-[var(--radius-xs)] bg-[var(--live-soft)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--live)]">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--live)]" />
                      {liveCount} live
                    </span>
                  ) : null}
                </div>
                <h1 className="mt-1 truncate text-base font-bold tracking-tight text-[var(--foreground)] sm:text-lg">
                  Match desks
                </h1>
                <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                  Open a desk or stand up a new matchday board.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/match-day/new"
                  className="desk-btn focus-ring interactive-press inline-flex items-center gap-1.5 bg-[var(--brand)] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[#041016] hover:brightness-110"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create desk
                </Link>
                {featured ? (
                  <>
                    <Link
                      href={`/match-day/${featured.id}`}
                      className="desk-btn focus-ring interactive-press inline-flex items-center gap-1.5 bg-[var(--surface-elevated)] px-3 py-2 text-[11px] font-semibold text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
                    >
                      Open featured
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <Link
                      href={`/match-day/${featured.id}/notes`}
                      className="desk-btn focus-ring interactive-press inline-flex items-center gap-1.5 bg-[var(--surface-elevated)] px-3 py-2 text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--foreground)]"
                    >
                      <StickyNote className="h-3.5 w-3.5" />
                      Add note
                    </Link>
                  </>
                ) : null}
              </div>
            </section>

            {/* Dense meter strip — not pastel SaaS cards */}
            <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Meter
                icon={<CalendarDays className="h-3.5 w-3.5" />}
                label="Desks"
                value={String(matchDays.length)}
              />
              <Meter
                icon={<StickyNote className="h-3.5 w-3.5" />}
                label="Notes"
                value={String(notesCount)}
                hint={featured ? "on featured" : undefined}
              />
              <Meter
                icon={<AlertTriangle className="h-3.5 w-3.5" />}
                label="Open prep"
                value={String(openChecklist)}
                accent={openChecklist > 0 ? "warning" : undefined}
              />
              <Meter
                icon={<MessageSquare className="h-3.5 w-3.5" />}
                label="Scripts"
                value={String(scriptsCount)}
              />
            </section>

            <div className="grid gap-3 lg:grid-cols-5">
              {/* Desk list */}
              <section className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] lg:col-span-2">
                <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-muted)]/60 px-3 py-2">
                  <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
                    <CalendarDays className="h-3.5 w-3.5 text-[var(--brand)]" />
                    My desks
                  </h2>
                  <Link
                    href="/match-day/new"
                    className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--brand)] hover:underline"
                  >
                    New
                  </Link>
                </header>
                <div className="divide-y divide-[var(--border)]">
                  {matchDays.length === 0 && (
                    <div className="px-3 py-6 text-center">
                      <p className="text-[12px] text-[var(--muted)]">
                        No desks yet.
                      </p>
                      <Link
                        href="/match-day/new"
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--brand)] hover:underline"
                      >
                        <Plus className="h-3 w-3" />
                        Create one
                      </Link>
                    </div>
                  )}
                  {matchDays.map((md) => {
                    const m0 = md.matches[0];
                    const matchLabel = m0
                      ? `${m0.homeClub.shortName} vs ${m0.awayClub.shortName}`
                      : md.title;
                    return (
                      <div
                        key={md.id}
                        className="group flex items-start gap-2 px-3 py-2.5 hover:bg-[var(--surface-muted)]/50"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-semibold tracking-tight text-[var(--foreground)]">
                            {md.title}
                          </div>
                          <div className="mt-0.5 truncate text-[10px] text-[var(--muted)]">
                            {formatKickoff(md.date)} · {md.competition} ·{" "}
                            {md.matches.length} match
                            {md.matches.length === 1 ? "" : "es"}
                          </div>
                          {m0 ? (
                            <Link
                              href={`/match-day/${m0.id}`}
                              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--brand)] hover:underline"
                            >
                              Open desk
                              <ArrowRight className="h-3 w-3" />
                            </Link>
                          ) : null}
                        </div>
                        <DeleteMatchDesk
                          matchDayId={md.id}
                          matchLabel={matchLabel}
                          variant="list"
                        />
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Rundown */}
              <section className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] lg:col-span-3">
                <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-muted)]/60 px-3 py-2">
                  <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
                    <Radio className="h-3.5 w-3.5 text-[var(--live)]" />
                    Live & upcoming
                  </h2>
                  <span className="tabular-nums text-[10px] font-semibold text-[var(--muted)]">
                    Live {liveCount}
                  </span>
                </header>
                <div className="divide-y divide-[var(--border)]">
                  {upcoming.map((m) => {
                    const isLive = m.status === "Live";
                    return (
                      <Link
                        key={m.id}
                        href={`/match-day/${m.id}`}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 transition-colors",
                          "hover:bg-[var(--surface-muted)]/70",
                          isLive && "bg-[var(--live-soft)]/25"
                        )}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[#0f1319] text-base ring-1 ring-[var(--border)]">
                          {m.homeClub.badgeEmoji}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-semibold tracking-tight text-[var(--foreground)]">
                            {m.homeClub.shortName}{" "}
                            <span className="font-medium text-[var(--muted)]">vs</span>{" "}
                            {m.awayClub.shortName}
                          </div>
                          <div className="mt-0.5 truncate text-[10px] text-[var(--muted)]">
                            {formatKickoff(m.kickoff)}
                            {m.featured ? " · Featured" : ""}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-[13px] font-bold tabular-nums text-[var(--foreground)]">
                            {m.homeScore} – {m.awayScore}
                          </div>
                          <div className="mt-0.5 flex justify-end">
                            <StatusBadge status={m.status} />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                  {upcoming.length === 0 && (
                    <p className="px-3 py-6 text-center text-[12px] text-[var(--muted)]">
                      No upcoming matches. Create a desk to get on air.
                    </p>
                  )}
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Meter({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent?: "warning" | "live";
}) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
        <span
          className={cn(
            "opacity-80",
            accent === "warning" && "text-[var(--warning)]",
            accent === "live" && "text-[var(--live)]"
          )}
        >
          {icon}
        </span>
        {label}
        {hint ? (
          <span className="ml-auto font-medium normal-case tracking-normal opacity-70">
            {hint}
          </span>
        ) : null}
      </div>
      <div
        className={cn(
          "mt-1 font-[var(--font-tabular)] text-xl font-bold tabular-nums tracking-tight text-[var(--foreground)]",
          accent === "warning" && "text-[var(--warning)]",
          accent === "live" && "text-[var(--live)]"
        )}
      >
        {value}
      </div>
    </div>
  );
}
