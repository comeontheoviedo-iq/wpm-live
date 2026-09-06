import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SPEAK_TIMINGS } from "@/lib/defaults";
import { normalizeApostrophes } from "@/lib/utils";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const title = normalizeApostrophes(String(body.title || "").trim());
    const speakBody = normalizeApostrophes(String(body.body || "").trim());
    if (!title) {
      return NextResponse.json({ error: "title required" }, { status: 400 });
    }
    const matchId = body.matchId ? String(body.matchId) : null;
    if (!matchId) {
      return NextResponse.json({ error: "matchId required" }, { status: 400 });
    }
    const timingRaw = String(body.timing || "pre-match");
    const timing = (SPEAK_TIMINGS as readonly string[]).includes(timingRaw)
      ? timingRaw
      : "pre-match";

    let order = Number.isFinite(Number(body.order)) ? Number(body.order) : NaN;
    if (!Number.isFinite(order)) {
      const max = await prisma.speak.aggregate({
        where: { matchId, timing },
        _max: { order: true },
      });
      order = (max._max.order ?? 0) + 1;
    }

    const speak = await prisma.speak.create({
      data: {
        matchId,
        userId: session.id,
        title,
        body: speakBody,
        timing,
        order,
        status: "edited",
      },
    });
    return NextResponse.json({ speak });
  } catch (e) {
    console.error("[speaks POST]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
