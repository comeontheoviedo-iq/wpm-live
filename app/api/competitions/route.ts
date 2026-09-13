import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  PRIORITY_COMPETITIONS,
  mergeCompetitionOptions,
  parseAddedCompetitions,
  serializeAddedCompetitions,
  slugForCompetition,
  type UserAddedCompetition,
} from "@/lib/competitions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  let added: UserAddedCompetition[] = [];
  const session = await getSession();
  if (session) {
    const row = await prisma.user.findUnique({
      where: { id: session.id },
      select: { addedCompetitions: true },
    });
    added = parseAddedCompetitions(row?.addedCompetitions);
  }

  let list = mergeCompetitionOptions(added);
  if (q) {
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        c.broadcastName.toLowerCase().includes(q)
    );
  }

  return NextResponse.json({
    competitions: list,
    priority: PRIORITY_COMPETITIONS,
    added: added.map((c) => ({
      id: slugForCompetition(c.name, c.country, c.apiFootballLeagueId),
      ...c,
      broadcastName: c.broadcastName || c.name,
    })),
  });
}

/** Persist a user-added AF competition for this account only. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const apiFootballLeagueId = Number(body.apiFootballLeagueId ?? body.leagueId);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const country =
    typeof body.country === "string" && body.country.trim()
      ? body.country.trim()
      : "Unknown";
  const broadcastName =
    typeof body.broadcastName === "string" && body.broadcastName.trim()
      ? body.broadcastName.trim()
      : undefined;
  const type = typeof body.type === "string" ? body.type : undefined;

  if (!Number.isFinite(apiFootballLeagueId) || apiFootballLeagueId <= 0 || !name) {
    return NextResponse.json(
      { error: "apiFootballLeagueId and name are required" },
      { status: 400 }
    );
  }

  // Already in priority — no need to store, but return as selectable
  const priorityHit = PRIORITY_COMPETITIONS.find(
    (c) => c.apiFootballLeagueId === apiFootballLeagueId
  );
  if (priorityHit) {
    return NextResponse.json({
      competition: priorityHit,
      alreadyPriority: true,
      added: parseAddedCompetitions(
        (
          await prisma.user.findUnique({
            where: { id: session.id },
            select: { addedCompetitions: true },
          })
        )?.addedCompetitions
      ),
    });
  }

  const row = await prisma.user.findUnique({
    where: { id: session.id },
    select: { addedCompetitions: true },
  });
  const existing = parseAddedCompetitions(row?.addedCompetitions);
  const next: UserAddedCompetition = {
    apiFootballLeagueId,
    name,
    country,
    broadcastName,
    type,
  };
  const without = existing.filter((c) => c.apiFootballLeagueId !== apiFootballLeagueId);
  const merged = [...without, next].slice(-40); // soft cap per user

  await prisma.user.update({
    where: { id: session.id },
    data: { addedCompetitions: serializeAddedCompetitions(merged) },
  });

  return NextResponse.json({
    competition: {
      id: slugForCompetition(name, country, apiFootballLeagueId),
      name,
      country,
      broadcastName: broadcastName || name,
      apiFootballLeagueId,
      priority: 50,
    },
    alreadyPriority: false,
    added: merged,
  });
}
