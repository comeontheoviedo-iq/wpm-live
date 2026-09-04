import { NextResponse } from "next/server";
import { getMatchFull } from "@/lib/match-data";
import { getSession } from "@/lib/auth";
import { formatKickoff } from "@/lib/utils";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const match = await getMatchFull(id);
  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    home: match.homeClub.name,
    away: match.awayClub.name,
    kickoff: formatKickoff(match.kickoff),
    venue: match.venue?.name || "TBC",
    speaks: match.speaks.map((s) => ({
      title: s.title,
      body: s.body,
      timing: s.timing,
    })),
    homeSquad: match.homeClub.players.map((p) => ({
      num: p.shirtNumber,
      name: p.name,
      pos: p.position,
    })),
    awaySquad: match.awayClub.players.map((p) => ({
      num: p.shirtNumber,
      name: p.name,
      pos: p.position,
    })),
    injuries: match.injuries.map((i) => ({
      player: i.player.name,
      status: i.status,
      type: i.injuryType,
    })),
    checklist: match.checklistItems.map((c) => ({
      label: c.label,
      done: c.done,
    })),
  });
}
