import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canUseUrShow } from "@/lib/ur-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });

  const enabled = canUseUrShow(user);
  let matchDayId: string | null = null;

  if (enabled) {
    const claimed = await prisma.urShow.findFirst({
      where: { claimedByUserId: user.id },
      orderBy: { updatedAt: "desc" },
      select: { matchDayId: true },
    });
    if (claimed) {
      matchDayId = claimed.matchDayId;
    } else {
      const md = await prisma.matchDay.findFirst({
        where: { userId: user.id },
        orderBy: { date: "asc" },
        select: { id: true },
      });
      matchDayId = md?.id ?? null;
    }
  }

  return NextResponse.json({
    user,
    urNav: { enabled, matchDayId },
  });
}
