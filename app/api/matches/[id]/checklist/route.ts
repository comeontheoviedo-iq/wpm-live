import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await params;
  const body = await req.json().catch(() => ({}));
  const itemId = String(body.id || "");
  const done = Boolean(body.done);
  const item = await prisma.checklistItem.update({
    where: { id: itemId },
    data: { done },
  });
  return NextResponse.json({ item });
}
