import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  claimMatchDayForUr,
  findOwnedUrShow,
  toBoardJson,
  refreshUrShowFromMatch,
  maybeAdvanceUrStatusFromCompleteness,
} from "@/lib/ur-show";
import { ShowBoardClient } from "@/components/show/show-board-client";
import { ClaimUrButton } from "@/components/show/claim-ur-button";
import { canUseUrShow } from "@/lib/ur-access";
import { displayText } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ShowBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ matchDayId: string }>;
  searchParams: Promise<{ claim?: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/login");
  if (!canUseUrShow(user)) notFound();

  const { matchDayId } = await params;
  const sp = await searchParams;

  const matchDay = await prisma.matchDay.findFirst({
    where: { id: matchDayId, userId: user.id },
    select: { id: true, title: true },
  });
  if (!matchDay) notFound();

  let show = await findOwnedUrShow(matchDayId, user.id);
  if (!show && sp.claim === "1") {
    const result = await claimMatchDayForUr(matchDayId, user.id);
    if (result.ok) show = result.show;
  }

  if (!show) {
    return (
      <ClaimGate
        matchDayId={matchDayId}
        title={matchDay.title}
        user={{ name: user.name, avatarInitials: user.avatarInitials }}
      />
    );
  }

  // Autofill + strip legacy wrong-fixture art / apply known pack (e.g. Strasbourg–Monaco)
  const refreshed = await refreshUrShowFromMatch(matchDayId, user.id, {
    forceText: true,
  });
  if (refreshed.ok) show = refreshed.show;
  await maybeAdvanceUrStatusFromCompleteness(matchDayId, user.id);
  show = (await findOwnedUrShow(matchDayId, user.id)) || show;

  return (
    <ShowBoardClient
      initialBoard={toBoardJson(show) as Parameters<typeof ShowBoardClient>[0]["initialBoard"]}
      user={{ name: user.name, avatarInitials: user.avatarInitials }}
    />
  );
}

function ClaimGate({
  matchDayId,
  title,
  user,
}: {
  matchDayId: string;
  title: string;
  user: { name: string; avatarInitials: string };
}) {
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4"
      style={{ background: "#0B0F14", color: "#F4F7FA" }}
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7EB6FF]">
        U&R · CoComms · {user.name}
      </div>
      <h1 className="max-w-md text-center text-xl font-bold tracking-tight">
        Enable U&R for this match-day?
      </h1>
      <p className="max-w-sm text-center text-[13px] text-white/50">
        {displayText(title)} — enables a Show board on your personal account (not a separate
        portal). Restream / creatives / OBS hand off to Remote football comms
        desk when you&apos;re ready.
      </p>
      <ClaimUrButton matchDayId={matchDayId} />
      <a
        href="/dashboard"
        className="text-[11px] font-semibold text-white/40 hover:text-[#7EB6FF]"
      >
        Back to desks
      </a>
    </div>
  );
}
