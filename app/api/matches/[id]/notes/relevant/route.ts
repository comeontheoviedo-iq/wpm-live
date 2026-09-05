import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateWithGemini, isGeminiConfigured } from "@/lib/gemini";
import { namesLooselyMatch, lastToken } from "@/lib/player-name";
import {
  classifyGameState,
  scoreNotesAgainstGameState,
  type GameStateEvent,
  type GameStateTag,
} from "@/lib/game-state-notes";

export const runtime = "nodejs";

type Body = {
  events?: {
    type: string;
    minute: number;
    description: string;
    playerId?: string | null;
    teamSide?: string | null;
  }[];
  /** Cap of note ids to return */
  limit?: number;
  /** LIVE game-state for early/late concede etc. note matching */
  gameState?: {
    minute?: number;
    status?: string;
    homeScore?: number;
    awayScore?: number;
    homeName?: string;
    awayName?: string;
    tags?: GameStateTag[];
    trigger?: GameStateEvent | null;
  };
};

type RelevantHit = {
  noteId: string;
  score: number;
  reason: string;
};

function keywordsFrom(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .split(/[\s—–,.:;/()'"!?]+/)
        .map((p) => p.trim())
        .filter((p) => p.length >= 3)
    ),
  ].slice(0, 24);
}

function heuristicRank(args: {
  notes: {
    id: string;
    title: string;
    body: string;
    category: string;
    entityType: string | null;
    entityId: string | null;
    pinned: boolean;
  }[];
  events: Body["events"];
  onPitchIds: Set<string>;
  recentSubIds: Set<string>;
  playerNames: Map<string, string>;
  limit: number;
}): RelevantHit[] {
  const events = args.events || [];
  const eventKeys = keywordsFrom(
    events.map((e) => `${e.type} ${e.description}`).join(" ")
  );
  const eventPlayerIds = new Set(
    events.map((e) => e.playerId).filter((x): x is string => Boolean(x))
  );
  const eventNames = events
    .map((e) => e.description || "")
    .join(" ");

  const scored = args.notes.map((n) => {
    let score = 0;
    const reasons: string[] = [];
    if (n.pinned) {
      score += 1;
    }
    if (n.entityId && eventPlayerIds.has(n.entityId)) {
      score += 8;
      reasons.push("event player");
    }
    if (n.entityId && args.onPitchIds.has(n.entityId)) {
      score += 2;
      reasons.push("on pitch");
    }
    if (n.entityId && args.recentSubIds.has(n.entityId)) {
      score += 4;
      reasons.push("recent sub");
    }
    const hay = `${n.title}\n${n.body}`.toLowerCase();
    const hits = eventKeys.filter((k) => hay.includes(k));
    if (hits.length) {
      score += Math.min(6, hits.length);
      reasons.push(`keywords:${hits.slice(0, 3).join(",")}`);
    }
    // Name overlap with event text
    if (n.entityId) {
      const pname = args.playerNames.get(n.entityId);
      if (pname && namesLooselyMatch(pname, eventNames)) {
        score += 5;
        reasons.push("name in events");
      } else if (pname) {
        const tok = lastToken(pname);
        if (tok.length >= 4 && eventNames.toLowerCase().includes(tok)) {
          score += 4;
          reasons.push("lastname in events");
        }
      }
    }
    if (/hook|funfact/i.test(n.category || "")) score += 1;
    if (/goal|sub|card|penalty/i.test(n.category || n.title || "")) score += 1;
    return {
      noteId: n.id,
      score,
      reason: reasons.slice(0, 3).join(" · ") || "context",
    };
  });

  return scored
    .filter((x) => x.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, args.limit);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: matchId } = await params;
  const body = (await req.json().catch(() => ({}))) as Body;
  const limit = Math.min(20, Math.max(3, Number(body.limit) || 8));

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      events: { orderBy: [{ minute: "desc" }, { createdAt: "desc" }], take: 20 },
      notes: {
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        take: 220,
      },
      homeClub: {
        include: {
          players: {
            select: {
              id: true,
              name: true,
              onPitch: true,
              isStarter: true,
              formationSlot: true,
            },
          },
        },
      },
      awayClub: {
        include: {
          players: {
            select: {
              id: true,
              name: true,
              onPitch: true,
              isStarter: true,
              formationSlot: true,
            },
          },
        },
      },
    },
  });
  if (!match)
    return NextResponse.json({ error: "Match not found" }, { status: 404 });

  const events =
    Array.isArray(body.events) && body.events.length
      ? body.events
      : match.events
          .filter((e) =>
            /goal|yellow|red|sub|penalty|var/i.test(e.type || "")
          )
          .slice(0, 10)
          .map((e) => ({
            type: e.type,
            minute: e.minute,
            description: e.description,
            playerId: e.playerId,
            teamSide: e.teamSide,
          }));

  const squad = [
    ...match.homeClub.players,
    ...match.awayClub.players,
  ];
  const playerNames = new Map(squad.map((p) => [p.id, p.name]));
  const onPitchIds = new Set(
    squad
      .filter((p) => p.onPitch || p.isStarter || p.formationSlot)
      .map((p) => p.id)
  );
  const recentSubIds = new Set(
    match.events
      .filter((e) => e.type === "sub")
      .slice(0, 8)
      .map((e) => e.playerId)
      .filter((x): x is string => Boolean(x))
  );

  let hits = heuristicRank({
    notes: match.notes,
    events,
    onPitchIds,
    recentSubIds,
    playerNames,
    limit: Math.max(limit, 12),
  });

  let source: "heuristic" | "gemini+heuristic" | "gamestate+heuristic" =
    "heuristic";

  // Game-state keyword matcher (early/late goal/concede, cards, HT/FT…)
  const gs = body.gameState;
  if (gs || events.length) {
    const trigger =
      gs?.trigger ||
      (events[0]
        ? {
            type: events[0].type,
            minute: events[0].minute,
            description: events[0].description,
            playerId: events[0].playerId,
            teamSide: events[0].teamSide ?? null,
          }
        : null);
    const snap = {
      minute: gs?.minute ?? match.minute ?? 0,
      status: gs?.status ?? match.status,
      homeScore: gs?.homeScore ?? match.homeScore,
      awayScore: gs?.awayScore ?? match.awayScore,
      homeName: gs?.homeName || match.homeClub.name,
      awayName: gs?.awayName || match.awayClub.name,
      trigger,
      events: [
        ...events.map((e) => ({
          type: e.type,
          minute: e.minute,
          description: e.description,
          playerId: e.playerId,
          teamSide: e.teamSide ?? null,
        })),
        ...match.events.slice(0, 40).map((e) => ({
          type: e.type,
          minute: e.minute,
          description: e.description,
          playerId: e.playerId,
          teamSide: e.teamSide,
        })),
      ],
    };
    const tags =
      Array.isArray(gs?.tags) && gs!.tags!.length
        ? gs!.tags!
        : classifyGameState(snap);
    const gsHits = scoreNotesAgainstGameState({
      notes: match.notes,
      tags,
      trigger,
      homeName: snap.homeName,
      awayName: snap.awayName,
      homeScore: snap.homeScore,
      awayScore: snap.awayScore,
      homeClubId: match.homeClubId,
      awayClubId: match.awayClubId,
      limit: Math.max(limit, 10),
    });
    if (gsHits.length) {
      const byId = new Map(hits.map((h) => [h.noteId, h]));
      for (const g of gsHits) {
        const prev = byId.get(g.noteId);
        if (prev) {
          prev.score += g.score;
          prev.reason = `${prev.reason} · gs:${g.reason}`.slice(0, 160);
        } else {
          byId.set(g.noteId, {
            noteId: g.noteId,
            score: g.score,
            reason: `gs:${g.reason}`,
          });
        }
      }
      hits = [...byId.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.max(limit, 12));
      source = "gamestate+heuristic";
    }
  }

  // Light Gemini re-rank over top heuristic candidates (titles only) — no invented facts
  if (isGeminiConfigured() && hits.length >= 3 && events.length) {
    try {
      const cand = hits.slice(0, 16).map((h) => {
        const n = match.notes.find((x) => x.id === h.noteId)!;
        return {
          id: n.id,
          title: n.title.slice(0, 80),
          category: n.category,
          entity: n.entityId ? playerNames.get(n.entityId) || n.entityType : n.entityType,
          preview: n.body.slice(0, 160),
        };
      });
      const eventBrief = events
        .slice(0, 6)
        .map((e) => `${e.minute}' ${e.type}: ${e.description}`)
        .join("\n");
      const scoreBrief = `${match.homeScore}-${match.awayScore} · min ${match.minute} · ${match.status}`;
      const result = await generateWithGemini(
        `You rank commentary prep notes for a LIVE football desk.
Return ONLY JSON: {"ids":["noteId",...]} with up to ${limit} note ids from the candidates,
most relevant to what is happening NOW (scorers, assisters, players on pitch, recent subs, score state).
Do not invent facts. Do not rewrite notes. Only reorder/filter the given ids.`,
        `Match: ${scoreBrief}\nRecent events:\n${eventBrief}\n\nCandidates:\n${JSON.stringify(cand)}`,
        { temperature: 0.1, maxOutputTokens: 256, timeoutMs: 8_000 }
      );
      if (!result.stub && result.text) {
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as { ids?: string[] };
          const ids = Array.isArray(parsed.ids) ? parsed.ids : [];
          const allowed = new Set(hits.map((h) => h.noteId));
          const reranked: RelevantHit[] = [];
          for (const id of ids) {
            if (!allowed.has(id)) continue;
            const prev = hits.find((h) => h.noteId === id)!;
            reranked.push({
              ...prev,
              score: prev.score + 10 - reranked.length,
              reason: `${prev.reason} · gemini`.trim(),
            });
          }
          // Keep any strong heuristic hits gemini dropped
          for (const h of hits) {
            if (reranked.some((x) => x.noteId === h.noteId)) continue;
            if (h.score >= 6) reranked.push(h);
          }
          if (reranked.length) {
            hits = reranked.slice(0, limit);
            source = source === "gamestate+heuristic"
              ? "gamestate+heuristic"
              : "gemini+heuristic";
          }
        }
      }
    } catch {
      /* keep heuristic */
    }
  }

  return NextResponse.json({
    noteIds: hits.slice(0, limit).map((h) => h.noteId),
    hits: hits.slice(0, limit),
    source,
    eventCount: events.length,
  });
}
