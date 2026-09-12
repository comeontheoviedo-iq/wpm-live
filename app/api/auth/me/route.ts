import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canUseUrShow } from "@/lib/ur-access";
import { prisma } from "@/lib/prisma";
import { normalizeLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { preferredLocale: true, name: true, email: true, avatarInitials: true, theme: true },
  });

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
    user: {
      ...user,
      name: row?.name ?? user.name,
      email: row?.email ?? user.email,
      avatarInitials: row?.avatarInitials ?? user.avatarInitials,
      theme: row?.theme ?? user.theme,
      preferredLocale: normalizeLocale(row?.preferredLocale),
    },
    urNav: { enabled, matchDayId },
  });
}

/** PATCH — update preferredLocale (i18n foundation). */
export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const data: { preferredLocale?: string } = {};

  if (typeof body.preferredLocale === "string") {
    data.preferredLocale = normalizeLocale(body.preferredLocale);
  }

  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "No supported fields" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: session.id },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      avatarInitials: true,
      theme: true,
      preferredLocale: true,
    },
  });

  return NextResponse.json({
    user: {
      ...updated,
      preferredLocale: normalizeLocale(updated.preferredLocale),
    },
  });
}
