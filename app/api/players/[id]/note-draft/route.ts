import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { generateWithGemini, isGeminiConfigured } from "@/lib/gemini";
import { normalizeApostrophes } from "@/lib/utils";
import { europeanSeasonYear } from "@/lib/season";
import { getPlayerById } from "@/lib/api-football";

/**
 * Optional Gemini fill for + Create note: one factual blurb from existing
 * research notes + AF season stats only. Never invents. Soft-fails to empty.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: playerId } = await params;
  const url = new URL(req.url);
  const matchId = url.searchParams.get("matchId") || undefined;

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { club: true },
  });
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const notes = await prisma.note.findMany({
    where: {
      entityType: "player",
      entityId: playerId,
      ...(matchId ? { matchId } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 12,
  });

  let afLines: string[] = [];
  if (player.apiFootballPlayerId) {
    const match = matchId
      ? await prisma.match.findUnique({
          where: { id: matchId },
          include: { matchDay: true },
        })
      : null;
    const season = match ? europeanSeasonYear(match.kickoff) : europeanSeasonYear(new Date());
    const rows = await getPlayerById(player.apiFootballPlayerId, season).catch(() => []);
    const stats = rows[0]?.statistics || [];
    const teamId = player.club.apiFootballTeamId;
    const clubRows = teamId != null ? stats.filter((s) => s.team?.id === teamId) : stats;
    for (const s of clubRows.slice(0, 6)) {
      const apps = s.games?.appearences;
      const g = s.goals?.total;
      const a = s.goals?.assists;
      const mins = s.games?.minutes;
      afLines.push(
        `${s.league?.name || "Comp"} ${s.league?.season ?? season}: apps=${apps ?? "—"} goals=${g ?? "—"} assists=${a ?? "—"} mins=${mins ?? "—"} (team ${s.team?.name || "?"})`
      );
    }
  }

  const research = notes
    .map((n) => `NOTE "${n.title}": ${n.body}`.slice(0, 500))
    .join("\n");

  if (!isGeminiConfigured()) {
    // Prefer first existing factual note snippet
    const first = notes.find((n) => n.body?.trim());
    if (first?.body?.trim()) {
      return NextResponse.json({
        title: normalizeApostrophes(`${player.name} — note`),
        body: normalizeApostrophes(first.body.trim().slice(0, 400)),
        stub: true,
      });
    }
    return NextResponse.json({ error: "No Gemini and no existing research" }, { status: 404 });
  }

  if (!research && !afLines.length) {
    return NextResponse.json({ error: "No research/AF facts to summarise" }, { status: 404 });
  }

  const system = `You write ONE short factual commentary blurb (1–3 sentences) about a football player.
Use ONLY the RESEARCH NOTES and AF STATS provided. Do not invent transfers, injuries, ages, scores, or opinions.
If facts are thin, write a cautious line that only restates what is given. Never mention data-provider brand names.`;

  const user = `Player: ${player.name} (#${player.shirtNumber}) — ${player.club.name}, ${player.position}, ${player.nationality}
Season desk apps/goals/assists (stored): ${player.appearances} apps, ${player.goals}G, ${player.assists}A

AF STATS:
${afLines.join("\n") || "(none)"}

RESEARCH NOTES:
${research || "(none)"}

Write one factual blurb only. No heading. No bullet list.`;

  const result = await generateWithGemini(system, user, {
    googleSearch: false,
    temperature: 0.2,
    maxOutputTokens: 220,
  });

  const body = normalizeApostrophes((result.text || "").trim());
  if (!body) {
    return NextResponse.json({ error: "Empty model output" }, { status: 404 });
  }

  return NextResponse.json({
    title: normalizeApostrophes(`${player.name} — note`),
    body,
    stub: Boolean(result.stub),
  });
}
