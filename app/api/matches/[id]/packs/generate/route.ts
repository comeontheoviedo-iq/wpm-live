import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateWithGemini, isGeminiConfigured } from "@/lib/gemini";
import {
  PACK_TEMPLATE_SEEDS,
  buildMatchContextPrompt,
} from "@/lib/pack-templates";
import { broadcastLabelFor } from "@/lib/competitions";
import { formatKickoff } from "@/lib/utils";
import {
  emptyDistributed,
  extractClubSections,
  extractPlayerHooks,
  extractPlayerSections,
  type DistributedCounts,
} from "@/lib/pack-distribute";

async function upsertEntityNote(args: {
  matchId: string;
  userId: string;
  title: string;
  body: string;
  category: string;
  entityType: string;
  entityId: string;
  pinned?: boolean;
}) {
  const existing = await prisma.note.findFirst({
    where: {
      matchId: args.matchId,
      entityType: args.entityType,
      entityId: args.entityId,
      category: args.category,
    },
  });
  if (existing) {
    await prisma.note.update({
      where: { id: existing.id },
      data: {
        title: args.title,
        body: args.body,
        pinned: args.pinned ?? existing.pinned,
      },
    });
  } else {
    await prisma.note.create({
      data: {
        matchId: args.matchId,
        userId: args.userId,
        title: args.title,
        body: args.body,
        category: args.category,
        entityType: args.entityType,
        entityId: args.entityId,
        pinned: args.pinned ?? false,
      },
    });
  }
}

function parseOptionalSources(raw: unknown): { urls: string[]; notes: string } {
  const urls: string[] = [];
  let notes = "";
  if (!raw || typeof raw !== "object") return { urls, notes };
  const o = raw as { urls?: unknown; notes?: unknown; text?: unknown };
  if (Array.isArray(o.urls)) {
    for (const u of o.urls) {
      const s = String(u || "").trim();
      if (s && /^https?:\/\//i.test(s)) urls.push(s);
    }
  }
  if (typeof o.urls === "string") {
    for (const line of o.urls.split(/\n+/)) {
      const s = line.trim();
      if (s && /^https?:\/\//i.test(s)) urls.push(s);
    }
  }
  notes = String(o.notes || o.text || "").trim();
  return { urls: [...new Set(urls)].slice(0, 20), notes: notes.slice(0, 8000) };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const templateKey = String(body.templateKey || "");
  if (!templateKey) {
    return NextResponse.json({ error: "templateKey required" }, { status: 400 });
  }
  const userSources = parseOptionalSources(body.sources);

  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      homeClub: { include: { players: true } },
      awayClub: { include: { players: true } },
      matchDay: true,
      venue: true,
      notes: true,
      officials: { include: { official: true } },
      injuries: { include: { player: true, club: true } },
    },
  });
  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let template = await prisma.packTemplate.findUnique({ where: { key: templateKey } });
  if (!template) {
    const seed = PACK_TEMPLATE_SEEDS.find((t) => t.key === templateKey);
    if (!seed) return NextResponse.json({ error: "Unknown template" }, { status: 404 });
    template = {
      id: `seed-${seed.key}`,
      key: seed.key,
      title: seed.title,
      description: seed.description,
      section: seed.section,
      prompt: seed.prompt,
      order: seed.order,
    };
  }

  const homePlayers = match.homeClub.players;
  const awayPlayers = match.awayClub.players;
  const homeXi = homePlayers
    .filter((p) => p.isStarter)
    .map((p) => `#${p.shirtNumber} ${p.name}${p.position ? ` (${p.position})` : ""}`);
  const awayXi = awayPlayers
    .filter((p) => p.isStarter)
    .map((p) => `#${p.shirtNumber} ${p.name}${p.position ? ` (${p.position})` : ""}`);
  const homeSquad = homePlayers.map(
    (p) => `#${p.shirtNumber} ${p.name}${p.position ? ` · ${p.position}` : ""}`
  );
  const awaySquad = awayPlayers.map(
    (p) => `#${p.shirtNumber} ${p.name}${p.position ? ` · ${p.position}` : ""}`
  );
  const referee = match.officials.find((o) => o.role === "Referee")?.official.name;

  const injuryLines = match.injuries.map((inj) => {
    const who = inj.player?.name || "Unknown";
    const club = inj.club?.name || "";
    const detail = [inj.status, inj.injuryType, inj.notes, inj.expectedReturn ? `return ${inj.expectedReturn}` : null]
      .filter(Boolean)
      .join(" · ");
    return `${who}${club ? ` (${club})` : ""} — ${detail || "injury"}`;
  });

  const allPlayers = [
    ...homePlayers.map((p) => ({ id: p.id, name: p.name })),
    ...awayPlayers.map((p) => ({ id: p.id, name: p.name })),
  ];

  let predictionsBlock = match.predictionsAdvice || "";
  if (match.predictionsJson) {
    try {
      const pj = JSON.parse(match.predictionsJson) as {
        advice?: string;
        percent?: { home?: number; draw?: number; away?: number };
        winner?: { name?: string };
      };
      const bits = [
        pj.advice,
        pj.percent
          ? `Home ${pj.percent.home ?? "?"} / Draw ${pj.percent.draw ?? "?"} / Away ${pj.percent.away ?? "?"}%`
          : null,
        pj.winner?.name ? `Lean: ${pj.winner.name}` : null,
      ].filter(Boolean);
      if (bits.length) predictionsBlock = bits.join(" · ");
    } catch {
      /* keep advice */
    }
  }

  const ctx = buildMatchContextPrompt({
    home: match.homeClub.name,
    away: match.awayClub.name,
    competition: match.matchDay.competition,
    broadcastCompetition: broadcastLabelFor(match.matchDay.competition),
    kickoff: formatKickoff(match.kickoff),
    venue: match.venue?.name,
    homeFormation: match.homeFormation,
    awayFormation: match.awayFormation,
    lineupStatus: match.lineupStatus,
    referee,
    homeXi,
    awayXi,
    notes: match.notes.map((n) => `${n.title}: ${n.body}`),
  });

  const deepResearchBlock = [
    "=== DEEP RESEARCH CONTEXT (auto — from match desk / API-Football) ===",
    `Fixture ID: ${match.apiFootballFixtureId ?? "unlinked"}`,
    `H2H: ${match.h2hSummary || "Unknown"}`,
    `Predictions: ${predictionsBlock || "Unknown"}`,
    `Injuries (${injuryLines.length}):`,
    ...(injuryLines.length ? injuryLines.map((l) => `- ${l}`) : ["- None listed"]),
    `HOME SQUAD (${homeSquad.length}): ${homeSquad.join("; ") || "TBC"}`,
    `AWAY SQUAD (${awaySquad.length}): ${awaySquad.join("; ") || "TBC"}`,
    "",
    "Use Google Search grounding to deepen: recent form, team news, tactical notes, player storylines, competition stakes.",
    "Do NOT invent stats — prefer grounded search + the structured context above. Mark unknowns clearly.",
  ].join("\n");

  const sourcesBlock =
    userSources.urls.length || userSources.notes
      ? [
          "",
          "=== OPTIONAL USER STEERING SOURCES (append — do not require) ===",
          ...userSources.urls.map((u) => `URL: ${u}`),
          userSources.notes ? `Notes:\n${userSources.notes}` : "",
          "Weigh these alongside search grounding when relevant.",
        ]
          .filter(Boolean)
          .join("\n")
      : "";

  const systemPrompt = [
    "You are Pitchline, a football commentary prep assistant.",
    "You have Google Search grounding enabled — search for current, accurate match intel automatically.",
    "Replicate the depth of a Gemini Notebook deep-research brief: scannable headings, actionable on-air lines, no invented numbers.",
  ].join(" ");

  const result = await generateWithGemini(
    systemPrompt,
    `${template.prompt}\n\nMATCH CONTEXT:\n${ctx}\n\n${deepResearchBlock}${sourcesBlock}`,
    { googleSearch: true, maxOutputTokens: 8192 }
  );

  const section = await prisma.packSection.upsert({
    where: { matchId_templateKey: { matchId: id, templateKey } },
    create: {
      matchId: id,
      templateKey,
      title: template.title,
      content: result.text,
      status: result.stub ? "draft" : "generated",
    },
    update: {
      title: template.title,
      content: result.text,
      status: result.stub ? "draft" : "generated",
    },
  });

  const distributed: DistributedCounts = emptyDistributed();

  if (!result.stub) {
    if (templateKey === "intro" || templateKey === "lineup") {
      const timing = templateKey === "lineup" ? "kickoff" : "pre-match";
      const existing = await prisma.speak.findFirst({
        where: { matchId: id, title: template.title },
      });
      if (existing) {
        await prisma.speak.update({
          where: { id: existing.id },
          data: { body: result.text, timing },
        });
      } else {
        await prisma.speak.create({
          data: {
            matchId: id,
            userId: session.id,
            title: template.title,
            body: result.text,
            timing,
            order: templateKey === "lineup" ? 2 : 1,
          },
        });
      }
      distributed.scripts += 1;
    }

    if (templateKey === "hooks") {
      await prisma.note.create({
        data: {
          matchId: id,
          userId: session.id,
          title: "Generated hooks & fillers",
          body: result.text,
          category: "Hook",
          entityType: "match",
          entityId: id,
          pinned: true,
        },
      });
      distributed.matchNotes += 1;

      const playerHooks = extractPlayerHooks(result.text, allPlayers);
      for (const ph of playerHooks) {
        await upsertEntityNote({
          matchId: id,
          userId: session.id,
          title: ph.title,
          body: ph.body,
          category: "Hook",
          entityType: "player",
          entityId: ph.player.id,
        });
        distributed.playerNotes += 1;
      }
    }

    if (templateKey === "referee") {
      await upsertEntityNote({
        matchId: id,
        userId: session.id,
        title: "Referee",
        body: result.text,
        category: "Match",
        entityType: "match",
        entityId: id,
      });
      distributed.matchNotes += 1;
    }

    if (templateKey === "research") {
      await upsertEntityNote({
        matchId: id,
        userId: session.id,
        title: template.title,
        body: result.text,
        category: "Match",
        entityType: "match",
        entityId: id,
      });
      distributed.matchNotes += 1;

      const clubSecs = extractClubSections(
        result.text,
        { id: match.homeClub.id, name: match.homeClub.name },
        { id: match.awayClub.id, name: match.awayClub.name }
      );
      for (const cs of clubSecs) {
        await upsertEntityNote({
          matchId: id,
          userId: session.id,
          title: cs.title,
          body: cs.body,
          category: "Club",
          entityType: "club",
          entityId: cs.clubId,
        });
        distributed.clubNotes += 1;
      }
    }

    if (templateKey === "profiles") {
      const playerSecs = extractPlayerSections(result.text, allPlayers);
      for (const ps of playerSecs) {
        await upsertEntityNote({
          matchId: id,
          userId: session.id,
          title: ps.title,
          body: ps.body,
          category: "Bio",
          entityType: "player",
          entityId: ps.player.id,
        });
        distributed.playerNotes += 1;
      }
      if (playerSecs.length < 3) {
        await prisma.note.create({
          data: {
            matchId: id,
            userId: session.id,
            title: "Player profiles pack",
            body: result.text,
            category: "Bio",
            entityType: "match",
            entityId: id,
          },
        });
        distributed.matchNotes += 1;
      }
    }
  }

  return NextResponse.json({
    section,
    stub: result.stub,
    gemini: isGeminiConfigured(),
    model: result.model,
    grounded: Boolean(result.grounded),
    searchQueries: result.searchQueries || [],
    distributed,
  });
}
