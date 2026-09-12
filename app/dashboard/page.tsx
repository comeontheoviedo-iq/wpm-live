import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { StatusBadge } from "@/components/ui/badge";
import { cn, formatKickoff } from "@/lib/utils";
import { leagueIdForCompetition } from "@/lib/competitions";
import {
  CalendarDays,
  Radio,
  Plus,
  ArrowRight,
  Mic2,
} from "lucide-react";
import { DeleteMatchDesk } from "@/components/match/delete-match-desk";
import { ClaimUrButton } from "@/components/show/claim-ur-button";
import { canUseUrShow } from "@/lib/ur-access";

function teamCrestUrl(apiFootballTeamId: number | null | undefined) {
  return apiFootballTeamId
    ? `https://media.api-sports.io/football/teams/${apiFootballTeamId}.png`
    : null;
}

function leagueCrestUrl(competition: string) {
  const id = leagueIdForCompetition(competition);
  return id ? `https://media.api-sports.io/football/leagues/${id}.png` : null;
}

function isPreMatchStatus(status: string) {
  const s = status.toLowerCase();
  return (
    s === "assigned" ||
    s === "upcoming" ||
    s === "scheduled" ||
    s === "not started" ||
    s === "ns"
  );
}

export default async function DashboardPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  const showUr = canUseUrShow(user);

  const matchDays = await prisma.matchDay.findMany({
    where: { userId: user.id },
    orderBy: { date: "asc" },
    include: {
      matches: {
        include: {
          homeClub: true,
          awayClub: true,
        },
        orderBy: { kickoff: "asc" },
      },
      urShow: { select: { id: true, status: true } },
    },
  });

  const allMatches = matchDays.flatMap((md) =>
    md.matches.map((m) => ({ ...m, matchDay: md }))
  );
  const liveCount = allMatches.filter((m) => m.status === "Live").length;
  const upcoming = allMatches.filter((m) => m.status !== "Full Time");
  const featured = upcoming.find((m) => m.featured) || upcoming[0] || null;
  const featuredMatchDay = featured?.matchDay ?? null;
  const otherDesks = featuredMatchDay
    ? matchDays.filter((md) => md.id !== featuredMatchDay.id)
    : matchDays;

  const homeCrest = featured
    ? teamCrestUrl(featured.homeClub.apiFootballTeamId)
    : null;
  const awayCrest = featured
    ? teamCrestUrl(featured.awayClub.apiFootballTeamId)
    : null;
  const competitionName =
    featuredMatchDay?.competition || featured?.matchDay.competition || "";
  const competitionCrest = competitionName
    ? leagueCrestUrl(competitionName)
    : null;
  const preMatch = featured ? isPreMatchStatus(featured.status) : true;

  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <AppHeader user={user} matchId={featured?.id} />
      <div className="flex min-h-0 w-full items-stretch">
        <AppSidebar liveCount={liveCount} />
        <main className="min-w-0 flex-1 px-2 py-2 sm:px-3 sm:py-3">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-2.5">
            {/* Compact page chrome — broadcast desk, not SaaS hub */}
            <section id="ur" className="desk-header flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-3.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Mic2 className="h-3.5 w-3.5 text-[var(--brand)]" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                    CoComms
                  </span>
                  {liveCount > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-[var(--radius-xs)] bg-[var(--live-soft)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--live)]">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--live)]" />
                      {liveCount} live
                    </span>
                  ) : null}
                </div>
                <h1 className="mt-1 truncate text-base font-bold tracking-tight text-[var(--foreground)] sm:text-lg">
                  Matchday
                </h1>
                <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                  Call sheet · open the board or stand up a new desk.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/match-day/new"
                  className="desk-btn focus-ring interactive-press inline-flex items-center gap-1.5 bg-[var(--surface-elevated)] px-3 py-2 text-[11px] font-semibold text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create desk
                </Link>
              </div>
            </section>

            {/* Hero call-sheet board */}
            {featured ? (
              <section
                className="relative overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[#0a0d12]"
                aria-label="Featured match board"
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-[0.35]"
                  style={{
                    background:
                      "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(20,184,166,0.12), transparent 55%), linear-gradient(180deg, rgba(16,20,26,0.2) 0%, rgba(3,4,5,0.85) 100%)",
                  }}
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-8 bottom-0 top-1/3 rounded-[50%] opacity-[0.07]"
                  style={{
                    background:
                      "radial-gradient(ellipse at center, rgba(34,197,94,0.55), transparent 68%)",
                  }}
                />

                <div className="relative flex flex-col gap-4 p-4 sm:p-5 md:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--brand)]">
                        Next board
                      </span>
                      {featured.featured ? (
                        <span className="rounded-[var(--radius-xs)] border border-[var(--brand)]/35 bg-[var(--brand-soft)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--brand)]">
                          Featured
                        </span>
                      ) : null}
                    </div>
                    <StatusBadge status={featured.status} />
                  </div>

                  {/* Crest strip: home · competition · away */}
                  <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5">
                    <CrestBlock
                      crestUrl={homeCrest}
                      fallback={featured.homeClub.badgeEmoji}
                      name={featured.homeClub.shortName}
                      side="home"
                    />
                    <div className="flex flex-col items-center gap-2 px-1 sm:px-3">
                      {competitionCrest ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={competitionCrest}
                          alt=""
                          className="h-8 w-8 rounded-[2px] bg-white/95 object-contain p-0.5 sm:h-9 sm:w-9"
                        />
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
                          {competitionName || "Match"}
                        </span>
                      )}
                      {preMatch ? (
                        <div className="text-2xl font-black tracking-[0.18em] text-white/55 sm:text-3xl">
                          VS
                        </div>
                      ) : (
                        <div className="font-[var(--font-tabular)] text-3xl font-black tabular-nums tracking-tight text-[var(--foreground)] sm:text-4xl">
                          {featured.homeScore}
                          <span className="mx-1.5 text-white/35">–</span>
                          {featured.awayScore}
                        </div>
                      )}
                    </div>
                    <CrestBlock
                      crestUrl={awayCrest}
                      fallback={featured.awayClub.badgeEmoji}
                      name={featured.awayClub.shortName}
                      side="away"
                    />
                  </div>

                  <div className="text-center">
                    <div className="text-lg font-bold tracking-tight text-[var(--foreground)] sm:text-xl">
                      {featured.homeClub.shortName}{" "}
                      <span className="font-medium text-[var(--muted)]">vs</span>{" "}
                      {featured.awayClub.shortName}
                    </div>
                    <div className="mt-1 text-[11px] text-[var(--muted)] sm:text-[12px]">
                      {formatKickoff(featured.kickoff)}
                      {competitionName ? ` · ${competitionName}` : ""}
                      {featuredMatchDay ? ` · ${featuredMatchDay.title}` : ""}
                    </div>
                  </div>

                  <div className="flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
                    <Link
                      href={`/match-day/${featured.id}`}
                      className="focus-ring interactive-press inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-[var(--brand)] px-6 py-3 text-[13px] font-bold uppercase tracking-[0.08em] text-[#041016] shadow-[0_0_0_1px_rgba(20,184,166,0.35),0_8px_28px_rgba(20,184,166,0.18)] hover:brightness-110"
                    >
                      Open desk
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      href={`/match-day/${featured.id}/notes`}
                      className="desk-btn focus-ring interactive-press inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--foreground)]"
                    >
                      Add note
                    </Link>
                    {showUr && featuredMatchDay ? (
                      <ClaimUrButton
                        matchDayId={featuredMatchDay.id}
                        claimed={Boolean(featuredMatchDay.urShow)}
                      />
                    ) : null}
                  </div>
                </div>
              </section>
            ) : (
              <section className="relative overflow-hidden rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[#0a0d12] px-4 py-10 text-center">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-10 bottom-0 top-1/4 rounded-[50%] opacity-[0.08]"
                  style={{
                    background:
                      "radial-gradient(ellipse at center, rgba(34,197,94,0.5), transparent 70%)",
                  }}
                />
                <div className="relative mx-auto max-w-md">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                    Call sheet clear
                  </div>
                  <h2 className="mt-2 text-base font-bold text-[var(--foreground)]">
                    No boards on the desk
                  </h2>
                  <p className="mt-1 text-[12px] text-[var(--muted)]">
                    Stand up a matchday board when you have a fixture to call.
                  </p>
                  <Link
                    href="/match-day/new"
                    className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--brand)] px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.08em] text-[#041016] hover:brightness-110"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create desk
                  </Link>
                </div>
              </section>
            )}

            {/* Live & upcoming — thin ticker, not a twin card */}
            <section
              className="overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)]"
              aria-label="Live and upcoming"
            >
              <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-muted)]/50 px-3 py-1.5">
                <Radio className="h-3 w-3 text-[var(--live)]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
                  Live & upcoming
                </span>
                <span className="ml-auto tabular-nums text-[10px] font-semibold text-[var(--muted)]">
                  Live {liveCount}
                </span>
              </div>
              <div className="flex gap-2 overflow-x-auto px-2 py-2 scrollbar-thin">
                {upcoming.length === 0 ? (
                  <p className="w-full px-2 py-2 text-center text-[11px] text-[var(--muted)]">
                    No upcoming fixtures on the ticker.
                  </p>
                ) : (
                  upcoming.map((m) => {
                    const isLive = m.status === "Live";
                    const crest = teamCrestUrl(m.homeClub.apiFootballTeamId);
                    return (
                      <Link
                        key={m.id}
                        href={`/match-day/${m.id}`}
                        className={cn(
                          "flex min-w-[11.5rem] max-w-[16rem] shrink-0 items-center gap-2 rounded-[var(--radius-xs)] border border-[var(--border)] bg-[#0f1319] px-2.5 py-2 transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]/60",
                          isLive && "border-[var(--live)]/35 bg-[var(--live-soft)]/20",
                          featured?.id === m.id && "ring-1 ring-[var(--brand)]/40"
                        )}
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-[2px] bg-white/95 ring-1 ring-[var(--border)]">
                          {crest ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={crest}
                              alt=""
                              className="h-6 w-6 object-contain"
                            />
                          ) : (
                            <span className="text-sm">{m.homeClub.badgeEmoji}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[11px] font-semibold tracking-tight text-[var(--foreground)]">
                            {m.homeClub.shortName}{" "}
                            <span className="text-[var(--muted)]">vs</span>{" "}
                            {m.awayClub.shortName}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[9px] text-[var(--muted)]">
                            <span className="truncate">{formatKickoff(m.kickoff)}</span>
                            {!isPreMatchStatus(m.status) ? (
                              <span className="font-[var(--font-tabular)] tabular-nums text-[var(--foreground)]">
                                {m.homeScore}–{m.awayScore}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <StatusBadge status={m.status} />
                      </Link>
                    );
                  })
                )}
              </div>
            </section>

            {/* Other desks — compact list under hero */}
            <section className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]">
              <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-muted)]/60 px-3 py-2">
                <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
                  <CalendarDays className="h-3.5 w-3.5 text-[var(--brand)]" />
                  {featured ? "Other boards" : "Boards"}
                </h2>
                <Link
                  href="/match-day/new"
                  className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--brand)] hover:underline"
                >
                  New
                </Link>
              </header>
              <div className="divide-y divide-[var(--border)]">
                {otherDesks.length === 0 && (
                  <div className="px-3 py-5 text-center">
                    <p className="text-[12px] text-[var(--muted)]">
                      {featured
                        ? "No other boards yet — this desk is the call sheet."
                        : "No desks yet."}
                    </p>
                    {!featured ? (
                      <Link
                        href="/match-day/new"
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--brand)] hover:underline"
                      >
                        <Plus className="h-3 w-3" />
                        Create one
                      </Link>
                    ) : null}
                  </div>
                )}
                {otherDesks.map((md) => {
                  const m0 = md.matches[0];
                  const matchLabel = m0
                    ? `${m0.homeClub.shortName} vs ${m0.awayClub.shortName}`
                    : md.title;
                  const rowCrest = m0
                    ? teamCrestUrl(m0.homeClub.apiFootballTeamId)
                    : null;
                  return (
                    <div
                      key={md.id}
                      className="group flex items-center gap-2.5 px-3 py-2 hover:bg-[var(--surface-muted)]/50"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[2px] bg-white/95 ring-1 ring-[var(--border)]">
                        {rowCrest ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={rowCrest}
                            alt=""
                            className="h-7 w-7 object-contain"
                          />
                        ) : (
                          <span className="text-sm">
                            {m0?.homeClub.badgeEmoji ?? "⚽"}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold tracking-tight text-[var(--foreground)]">
                          {md.title}
                        </div>
                        <div className="mt-0.5 truncate text-[10px] text-[var(--muted)]">
                          {formatKickoff(md.date)} · {md.competition} ·{" "}
                          {md.matches.length} match
                          {md.matches.length === 1 ? "" : "es"}
                        </div>
                      </div>
                      {m0 ? (
                        <Link
                          href={`/match-day/${m0.id}`}
                          className="desk-btn focus-ring interactive-press hidden items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold text-[var(--brand)] sm:inline-flex"
                        >
                          Open
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      ) : null}
                      {showUr ? (
                        <ClaimUrButton
                          matchDayId={md.id}
                          claimed={Boolean(md.urShow)}
                          compact
                        />
                      ) : null}
                      <DeleteMatchDesk
                        matchDayId={md.id}
                        matchLabel={matchLabel}
                        variant="list"
                      />
                    </div>
                  );
                })}
                {featuredMatchDay ? (
                  <div className="flex items-center gap-2.5 bg-[var(--surface-muted)]/25 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-semibold text-[var(--foreground)]">
                        {featuredMatchDay.title}
                        <span className="ml-2 text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--brand)]">
                          On call sheet
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-[10px] text-[var(--muted)]">
                        {formatKickoff(featuredMatchDay.date)} ·{" "}
                        {featuredMatchDay.competition}
                      </div>
                    </div>
                    <DeleteMatchDesk
                      matchDayId={featuredMatchDay.id}
                      matchLabel={
                        featured
                          ? `${featured.homeClub.shortName} vs ${featured.awayClub.shortName}`
                          : featuredMatchDay.title
                      }
                      variant="list"
                    />
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

function CrestBlock({
  crestUrl,
  fallback,
  name,
  side,
}: {
  crestUrl: string | null;
  fallback: string;
  name: string;
  side: "home" | "away";
}) {
  return (
    <div
      className={cn(
        "flex min-w-[5.5rem] flex-col items-center gap-2 sm:min-w-[6.5rem]",
        side === "away" && "order-none"
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[3px] bg-white/95 shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_8px_24px_rgba(0,0,0,0.45)] sm:h-16 sm:w-16">
        {crestUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={crestUrl} alt="" className="h-12 w-12 object-contain sm:h-14 sm:w-14" />
        ) : (
          <span className="text-2xl sm:text-3xl">{fallback}</span>
        )}
      </div>
      <div className="max-w-[7rem] truncate text-center text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--foreground)] sm:text-[12px]">
        {name}
      </div>
    </div>
  );
}
