import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { normalizeApostrophes } from "@/lib/utils";
import { assertMatchOwned, findOwnedNote } from "@/lib/tenancy";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await findOwnedNote(id, session.id);
  if (!existing) {
    const any = await prisma.note.findUnique({ where: { id }, select: { id: true } });
    if (!any) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  for (const key of [
    "title",
    "body",
    "category",
    "entityType",
    "entityId",
    "pinned",
    "matchId",
  ]) {
    if (key in body) data[key] = body[key];
  }
  if (typeof data.title === "string") data.title = normalizeApostrophes(data.title);
  if (typeof data.body === "string") data.body = normalizeApostrophes(data.body);
  if (data.matchId) {
    const access = await assertMatchOwned(String(data.matchId), session);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
  }
  const note = await prisma.note.update({ where: { id }, data });
  return NextResponse.json({ note });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await findOwnedNote(id, session.id);
  if (!existing) {
    const any = await prisma.note.findUnique({ where: { id }, select: { id: true } });
    if (!any) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await prisma.note.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
