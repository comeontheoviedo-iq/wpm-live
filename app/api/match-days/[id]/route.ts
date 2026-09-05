import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

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

  const matchDay = await prisma.matchDay.findUnique({
    where: { id },
    select: { id: true, userId: true, title: true },
  });

  if (!matchDay) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Owner-only when a user is attached; unowned legacy desks: any signed-in user
  if (matchDay.userId && matchDay.userId !== session.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Match (+ notes/events/packs/…) cascade via Prisma onDelete
  await prisma.matchDay.delete({ where: { id: matchDay.id } });

  return NextResponse.json({ ok: true, id: matchDay.id });
}
