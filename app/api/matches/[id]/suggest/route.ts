import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SuggestBody = {
  events?: {
    type: string;
    minute: number;
    description: string;
    playerId?: string | null;
    playerName?: string | null;
  }[];
};

type Suggestion = {
  id: string;
  eventKey: string;
  minute: number;
  eventType: string;
  eventLabel: string;
  text: string;
  source: "note" | "af_stat";
  noteId?: string;
  playerId?: string | null;
  playerName?: string | null;
};

function keywordsFromEvent(ev: {
  type: string;
  description: string;
  playerName?: string | null;
}) {
  const parts = [
    ev.playerName || "",
    ...String(ev.description || "").split(/[\s—–,.:;/()]+/),
  ]
    .map((p) => p.trim())
    .filter((p) => p.length >= 3)
    .map((p) => p.toLowerCase());
  return [...new Set(parts)].slice(0, 12);
}

function noteMatches(note: { title: string; body: string }, keys: string[]) {
  const hay = `${note.title}\n${note.body}`.toLowerCase();
  return keys.filter((k) => hay.includes(k));
}

function firstBullet(body: string): string | null {
  const lines = body
    .split(/\n+/)
    .map((l) =>
      l
        .replace(/^[-*•]+\s*/, "")
        .replace(/^"+|"+$/g, "")
        .trim()
    )
    .filter((l) => l.length > 18 && !/^profile:/i.test(l));
  if (!lines.length) return null;
  const line = lines[0];
  return line.length > 140 ? `${line.slice(0, 137)}…` : line;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: matchId } = await params;
  const body = (await req.json().catch(() => ({}))) as SuggestBody;
  let events = Array.isArray(body.events) ? body.events : [];

  // If no events passed, use recent match events (goal/card/sub)
  if (!events.length) {
    const recent = await prisma.matchEvent.findMany({
      where: {
        matchId,
        type: {
          in: [
            "goal",
            "penalty_goal",
            "own_goal",
            "yellow",
            "red",
            "sub",
            "penalty_miss",
          ],
        },
      },
      orderBy: [{ minute: "desc" }, { createdAt: "desc" }],
      take: 8,
      include: { player: true },
    });
    events = recent.map((e) => ({
      type: e.type,
      minute: e.minute,
      description: e.description,
      playerId: e.playerId,
      playerName: e.player?.name || null,
    }));
  }

  events = events.filter((e) =>
    /goal|yellow|red|sub|penalty/i.test(e.type || "")
  );
  if (!events.length) {
    return NextResponse.json({ suggestions: [] as Suggestion[] });
  }

  const notes = await prisma.note.findMany({
    where: { matchId },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  const playerIds = [
    ...new Set(
      events.map((e) => e.playerId).filter((x): x is string => Boolean(x))
    ),
  ];
  const players = playerIds.length
    ? await prisma.player.findMany({
        where: { id: { in: playerIds } },
        select: {
          id: true,
          name: true,
          appearances: true,
          goals: true,
          assists: true,
          shirtNumber: true,
        },
      })
    : [];
  const playerById = new Map(players.map((p) => [p.id, p]));

  // Resolve player names from description when missing
  const allSquad = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      homeClub: { include: { players: { select: { id: true, name: true } } } },
      awayClub: { include: { players: { select: { id: true, name: true } } } },
    },
  });
  const squadPlayers = [
    ...(allSquad?.homeClub.players || []),
    ...(allSquad?.awayClub.players || []),
  ];

  const suggestions: Suggestion[] = [];
  let seq = 0;

  for (const ev of events.slice(0, 6)) {
    let playerName = ev.playerName || null;
    let playerId = ev.playerId || null;
    if (!playerName) {
      const hit = squadPlayers.find((p) =>
        ev.description.toLowerCase().includes(p.name.toLowerCase())
      );
      if (hit) {
        playerName = hit.name;
        playerId = playerId || hit.id;
      }
    }
    const keys = keywordsFromEvent({ ...ev, playerName });
    const eventKey = `${ev.minute}:${ev.type}:${ev.description}`.slice(0, 120);
    const eventLabel = `${ev.minute}' ${ev.type.replace(/_/g, " ")}`;

    // Note-based bullets (1–2)
    const rankedNotes = notes
      .map((n) => {
        const hits = noteMatches(n, keys);
        let score = hits.length;
        if (playerId && n.entityId === playerId) score += 3;
        if (playerName && n.title.toLowerCase().includes(playerName.toLowerCase()))
          score += 2;
        if (n.pinned) score += 1;
        if (/hook/i.test(n.category || "") || /hook/i.test(n.title || ""))
          score += 1;
        return { n, score, hits };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    const usedBodies = new Set<string>();
    for (const { n } of rankedNotes.slice(0, 4)) {
      if (suggestions.filter((s) => s.eventKey === eventKey).length >= 2) break;
      const bullet = firstBullet(n.body) || n.title;
      if (!bullet || usedBodies.has(bullet)) continue;
      usedBodies.add(bullet);
      seq += 1;
      suggestions.push({
        id: `s-${seq}`,
        eventKey,
        minute: ev.minute,
        eventType: ev.type,
        eventLabel,
        text: bullet,
        source: "note",
        noteId: n.id,
        playerId,
        playerName,
      });
    }

    // Optional one factual AF/stored season line
    const pl = playerId ? playerById.get(playerId) : null;
    if (pl && (pl.appearances > 0 || pl.goals > 0)) {
      const already = suggestions.filter((s) => s.eventKey === eventKey).length;
      if (already < 3) {
        seq += 1;
        const bits = [
          pl.appearances > 0 ? `${pl.appearances} apps` : null,
          pl.goals > 0 ? `${pl.goals} goals` : null,
          pl.assists > 0 ? `${pl.assists} assists` : null,
        ].filter(Boolean);
        suggestions.push({
          id: `s-${seq}`,
          eventKey,
          minute: ev.minute,
          eventType: ev.type,
          eventLabel,
          text: `${pl.name} this season: ${bits.join(" · ")}`,
          source: "af_stat",
          playerId: pl.id,
          playerName: pl.name,
        });
      }
    }
  }

  return NextResponse.json({
    suggestions: suggestions.slice(0, 18),
  });
}
