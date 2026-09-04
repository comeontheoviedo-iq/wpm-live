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
import { emptyDistributed } from "@/lib/pack-distribute";
import { applyPackDistribution } from "@/lib/pack-distribute-apply";

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

/** Per-template generate knobs — shorter templates skip heavy search by default. */
function generateOptionsFor(templateKey: string) {
  switch (templateKey) {
    case "research":
      return { googleSearch: true, maxOutputTokens: 8192, timeoutMs: 120_000 };
    case "profiles":
      return { googleSearch: true, maxOutputTokens: 6144, timeoutMs: 120_000 };
    case "intro":
      return { googleSearch: false, maxOutputTokens: 2048, timeoutMs: 60_000 };
    case "lineup":
      return { googleSearch: false, maxOutputTokens: 2048, timeoutMs: 60_000 };
    case "referee":
      return { googleSearch: false, maxOutputTokens: 1024, timeoutMs: 45_000 };
    case "hooks":
      return { googleSearch: false, maxOutputTokens: 3072, timeoutMs: 60_000 };
    default:
      return { googleSearch: true, maxOutputTokens: 4096, timeoutMs: 90_000 };
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
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
      "Prefer structured context above. Use search only when it adds current form/news. Mark unknowns clearly.",
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
      "Be accurate, scannable, and usable live. No invented stats.",
    ].join(" ");

    const genOpts = generateOptionsFor(templateKey);
    let result;
    try {
      result = await generateWithGemini(
        systemPrompt,
        `${template.prompt}\n\nMATCH CONTEXT:\n${ctx}\n\n${deepResearchBlock}${sourcesBlock}`,
        genOpts
      );
    } catch (firstErr) {
      // Last-resort retry without search / lower tokens
      console.error("[packs/generate] primary failed", templateKey, firstErr);
      result = await generateWithGemini(
        systemPrompt,
        `${template.prompt}\n\nMATCH CONTEXT:\n${ctx}\n\n${deepResearchBlock}${sourcesBlock}`,
        {
          googleSearch: false,
          maxOutputTokens: Math.min(genOpts.maxOutputTokens, 2048),
          timeoutMs: 45_000,
        }
      );
    }

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

    let distributed = emptyDistributed();
    if (!result.stub) {
      try {
        distributed = await applyPackDistribution({
          matchId: id,
          userId: session.id,
          templateKey,
          templateTitle: template.title,
          content: result.text,
          homeClub: { id: match.homeClub.id, name: match.homeClub.name },
          awayClub: { id: match.awayClub.id, name: match.awayClub.name },
          allPlayers,
        });
      } catch (distErr) {
        console.error("[packs/generate] distribute failed", templateKey, distErr);
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
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[packs/generate]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
