import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NOTE_CATEGORIES } from "@/lib/defaults";
import { normalizeApostrophes } from "@/lib/utils";
import { rechunkOverlongLeagueNotes } from "@/lib/rechunk-league-notes";
import { assertMatchOwned } from "@/lib/tenancy";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get("matchId") || undefined;
  const entityType = searchParams.get("entityType") || undefined;
  const entityId = searchParams.get("entityId") || undefined;
  const category = searchParams.get("category") || undefined;

  if (matchId) {
    const access = await assertMatchOwned(matchId, session);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    try {
      await rechunkOverlongLeagueNotes(matchId);
    } catch {
      /* soft-fail */
    }
  }

  // Tenancy: own notes, or notes on a match desk the user owns
  const notes = await prisma.note.findMany({
    where: {
      AND: [
        matchId
          ? { matchId }
          : {
              OR: [
                { userId: session.id },
                { match: { matchDay: { userId: session.id } } },
              ],
            },
        ...(entityType ? [{ entityType }] : []),
        ...(entityId ? [{ entityId }] : []),
        ...(category ? [{ category }] : []),
      ],
    },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ notes, categories: NOTE_CATEGORIES });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const title = normalizeApostrophes(String(body.title || "").trim());
  // Quick-add empty note always works (body may be blank).
  const noteBody = normalizeApostrophes(String(body.body || "").trim());
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  const matchId = body.matchId ? String(body.matchId) : null;
  if (matchId) {
    const access = await assertMatchOwned(matchId, session);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
  }
  const category = String(body.category || "Custom");
  const note = await prisma.note.create({
    data: {
      title,
      body: noteBody,
      category,
      matchId,
      userId: session.id,
      entityType: body.entityType || null,
      entityId: body.entityId || null,
      pinned: Boolean(body.pinned),
    },
  });
  return NextResponse.json({ note });
}
