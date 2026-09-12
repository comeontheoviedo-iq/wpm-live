import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { findOwnedMatchDay } from "@/lib/tenancy";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const matchDay = await findOwnedMatchDay(id, session.id);
  if (!matchDay) {
    // Hide existence of other users' desks
    const exists = await prisma.matchDay.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Match (+ notes/events/packs/…) cascade via Prisma onDelete
  await prisma.matchDay.delete({ where: { id: matchDay.id } });

  return NextResponse.json({ ok: true, id: matchDay.id });
}
