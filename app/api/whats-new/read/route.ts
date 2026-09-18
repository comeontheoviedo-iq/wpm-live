import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSession().catch(() => null);
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const row = await prisma.userProductUpdateRead.upsert({
      where: { userId: session.id },
      create: { userId: session.id, lastReadAt: now },
      update: { lastReadAt: now },
      select: { lastReadAt: true },
    });
    return NextResponse.json({
      ok: true,
      lastReadAt: row.lastReadAt.toISOString(),
    });
  } catch (e) {
    console.error("[whats-new/read POST]", e);
    return NextResponse.json({ error: "Could not mark read" }, { status: 500 });
  }
}
