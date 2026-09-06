import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SPEAK_TIMINGS } from "@/lib/defaults";
import { normalizeApostrophes } from "@/lib/utils";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    for (const key of ["title", "body", "timing", "order", "status"] as const) {
      if (key in body) data[key] = body[key];
    }
    if (typeof data.title === "string") {
      data.title = normalizeApostrophes(data.title.trim());
    }
    if (typeof data.body === "string") {
      data.body = normalizeApostrophes(data.body);
    }
    if (typeof data.timing === "string") {
      const t = data.timing;
      if (!(SPEAK_TIMINGS as readonly string[]).includes(t)) {
        return NextResponse.json({ error: "invalid timing" }, { status: 400 });
      }
    }
    if ("order" in data) {
      const n = Number(data.order);
      if (!Number.isFinite(n)) {
        return NextResponse.json({ error: "invalid order" }, { status: 400 });
      }
      data.order = Math.round(n);
    }
    const contentTouched =
      "title" in data || "body" in data || "timing" in data || "order" in data;
    if (contentTouched && data.status == null) {
      data.status = "edited";
    }
    const speak = await prisma.speak.update({ where: { id }, data });
    return NextResponse.json({ speak });
  } catch (e) {
    console.error("[speaks PATCH]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    await prisma.speak.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[speaks DELETE]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
