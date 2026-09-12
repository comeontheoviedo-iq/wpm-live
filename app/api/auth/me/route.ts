import { NextResponse } from "next/server";
import { createSession, getSession } from "@/lib/auth";
import { canUseUrShow } from "@/lib/ur-access";
import { prisma } from "@/lib/prisma";
import { normalizeLocale } from "@/lib/i18n";
import { initialsFromName, normalizeTimezone } from "@/lib/profile-options";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      preferredLocale: true,
      sharedIntelOptIn: true,
      name: true,
      email: true,
      avatarInitials: true,
      theme: true,
      image: true,
      bio: true,
      timezone: true,
    },
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
      image: row?.image ?? user.image ?? null,
      bio: row?.bio ?? null,
      timezone: row?.timezone ?? null,
      preferredLocale: normalizeLocale(row?.preferredLocale),
      sharedIntelOptIn: Boolean(row?.sharedIntelOptIn),
    },
    urNav: { enabled, matchDayId },
  });
}

/**
 * PATCH — own profile only: name, bio, timezone, preferredLocale, sharedIntelOptIn.
 * Email is auth-bound and read-only here.
 */
export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const data: {
    preferredLocale?: string;
    sharedIntelOptIn?: boolean;
    name?: string;
    avatarInitials?: string;
    bio?: string | null;
    timezone?: string | null;
  } = {};

  if (typeof body.preferredLocale === "string") {
    data.preferredLocale = normalizeLocale(body.preferredLocale);
  }

  if (typeof body.sharedIntelOptIn === "boolean") {
    data.sharedIntelOptIn = body.sharedIntelOptIn;
  }

  if (typeof body.name === "string") {
    const name = body.name.trim().slice(0, 80);
    if (name.length < 1) {
      return NextResponse.json({ error: "Display name is required" }, { status: 400 });
    }
    data.name = name;
    data.avatarInitials = initialsFromName(name);
  }

  if ("bio" in body) {
    if (body.bio == null || body.bio === "") {
      data.bio = null;
    } else if (typeof body.bio === "string") {
      data.bio = body.bio.trim().slice(0, 280) || null;
    } else {
      return NextResponse.json({ error: "Invalid bio" }, { status: 400 });
    }
  }

  if ("timezone" in body) {
    if (body.timezone == null || body.timezone === "") {
      data.timezone = null;
    } else if (typeof body.timezone === "string") {
      const tz = normalizeTimezone(body.timezone);
      if (!tz) {
        return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
      }
      data.timezone = tz;
    } else {
      return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
    }
  }

  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "No supported fields" }, { status: 400 });
  }

  // Tenancy: always update by session id — never accept body.userId.
  const updated = await prisma.user.update({
    where: { id: session.id },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      avatarInitials: true,
      theme: true,
      image: true,
      bio: true,
      timezone: true,
      preferredLocale: true,
      sharedIntelOptIn: true,
    },
  });

  if (data.name || data.avatarInitials) {
    await createSession({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      avatarInitials: updated.avatarInitials,
      theme: updated.theme,
      image: updated.image,
    });
  }

  return NextResponse.json({
    user: {
      ...updated,
      preferredLocale: normalizeLocale(updated.preferredLocale),
      sharedIntelOptIn: Boolean(updated.sharedIntelOptIn),
    },
  });
}
