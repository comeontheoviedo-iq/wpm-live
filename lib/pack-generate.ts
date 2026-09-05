/** Shared pack section generation (HTTP route + sync auto-lineup). */

import { prisma } from "./prisma";
import { generateWithGemini, isGeminiConfigured } from "./gemini";
import {
  PACK_TEMPLATE_SEEDS,
  buildMatchContextPrompt,
} from "./pack-templates";
import { broadcastLabelFor } from "./competitions";
import { formatKickoff } from "./utils";
import { emptyDistributed, type DistributedCounts } from "./pack-distribute";
import { applyPackDistribution } from "./pack-distribute-apply";

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

function generateOptionsFor(templateKey: string) {
  switch (templateKey) {
    case "research":
      return { googleSearch: true, maxOutputTokens: 12288, timeoutMs: 180_000 };
    case "profiles":
      return { googleSearch: true, maxOutputTokens: 8192, timeoutMs: 150_000 };
    case "intro":
      return { googleSearch: true, maxOutputTokens: 8192, timeoutMs: 180_000 };
    case "lineup":
      return { googleSearch: false, maxOutputTokens: 2048, timeoutMs: 60_000 };
    case "referee":
      return { googleSearch: false, maxOutputTokens: 2048, timeoutMs: 60_000 };
    case "hooks":
      return { googleSearch: true, maxOutputTokens: 8192, timeoutMs: 150_000 };
    default:
      return { googleSearch: true, maxOutputTokens: 4096, timeoutMs: 90_000 };
  }
}

const RESEARCH_BRIEF_PROMPT = `Produce a FACTUAL RESEARCH BRIEF only (not an on-air script).
Use grounded search + MATCH CONTEXT. Mark Unknown when missing. No invention.
Headings required:
## Venue & atmosphere
## Table position & form
## Last 7 days
## Continental / competition context
## Team news
## Opposition identity
## Manager / touchline
## Referee & cards
## Tactical battle lines
## Key players
## Must-mention facts
## Unknowns
Keep it dense and cited (outlet/date).`;

export type GeneratePackResult = {
  section: {
    id: string;
    matchId: string;
    templateKey: string;
    title: string;
    content: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  };
  stub: boolean;
  gemini: boolean;
  model?: string;
  grounded: boolean;
  searchQueries: string[];
  distributed: DistributedCounts;
};

export async function generatePackForMatch(args: {
  matchId: string;
  templateKey: string;
  userId: string;
  sources?: unknown;
}): Promise<GeneratePackResult> {
  const { matchId, templateKey, userId } = args;
  const userSources = parseOptionalSources(args.sources);

  const match = await prisma.match.findUnique({
    where: { id: matchId },
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
  if (!match) throw new Error("Match not found");

  let template = await prisma.packTemplate.findUnique({
    where: { key: templateKey },
  });
  if (!template) {
    const seed = PACK_TEMPLATE_SEEDS.find((t) => t.key === templateKey);
    if (!seed) throw new Error("Unknown template");
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
    .map(
      (p) =>
        `#${p.shirtNumber} ${p.name}${p.position ? ` (${p.position})` : ""}`
    );
  const awayXi = awayPlayers
    .filter((p) => p.isStarter)
    .map(
      (p) =>
        `#${p.shirtNumber} ${p.name}${p.position ? ` (${p.position})` : ""}`
    );
  const homeSquad = homePlayers.map(
    (p) => `#${p.shirtNumber} ${p.name}${p.position ? ` · ${p.position}` : ""}`
  );
  const awaySquad = awayPlayers.map(
    (p) => `#${p.shirtNumber} ${p.name}${p.position ? ` · ${p.position}` : ""}`
  );
  const referee = match.officials.find((o) => o.role === "Referee")?.official
    .name;

  const injuryLines = match.injuries.map((inj) => {
    const who = inj.player?.name || "Unknown";
    const club = inj.club?.name || "";
    const detail = [
      inj.status,
      inj.injuryType,
      inj.notes,
      inj.expectedReturn ? `return ${inj.expectedReturn}` : null,
    ]
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
    ...(injuryLines.length
      ? injuryLines.map((l) => `- ${l}`)
      : ["- None listed"]),
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
    "Be accurate, scannable, and usable live.",
    "You are not allowed to invent. If unsure write Unknown.",
    templateKey === "hooks"
      ? "For hooks: demand 15+ true grounded lines; never invent to pad."
      : "Prefer fewer true hooks over colourful fiction.",
    "Ground claims in MATCH CONTEXT, desk/API data, or grounded search only.",
    "Never fabricate stats, quotes, injuries, transfers, or personal stories.",
  ].join(" ");

  const genOpts = generateOptionsFor(templateKey);
  const baseUser = `MATCH CONTEXT:\n${ctx}\n\n${deepResearchBlock}${sourcesBlock}`;
  let result;
  try {
    let researchSpine = "";
    if (templateKey === "intro" || templateKey === "research") {
      try {
        const brief = await generateWithGemini(
          systemPrompt,
          `${RESEARCH_BRIEF_PROMPT}\n\n${baseUser}`,
          {
            googleSearch: true,
            maxOutputTokens: 8192,
            timeoutMs: 150_000,
          }
        );
        if (!brief.stub && brief.text && brief.text.length > 80) {
          researchSpine = brief.text;
        }
      } catch (briefErr) {
        console.error(
          "[pack-generate] research brief step failed",
          templateKey,
          briefErr
        );
      }
    }

    const spineBlock = researchSpine
      ? `\n\n=== RESEARCH BRIEF (use as factual spine; still no invention) ===\n${researchSpine}`
      : "";

    result = await generateWithGemini(
      systemPrompt,
      `${template.prompt}\n\n${baseUser}${spineBlock}`,
      genOpts
    );
  } catch (firstErr) {
    console.error("[pack-generate] primary failed", templateKey, firstErr);
    result = await generateWithGemini(
      systemPrompt,
      `${template.prompt}\n\n${baseUser}`,
      {
        googleSearch: false,
        maxOutputTokens: Math.min(genOpts.maxOutputTokens, 4096),
        timeoutMs: 60_000,
      }
    );
  }

  const section = await prisma.packSection.upsert({
    where: { matchId_templateKey: { matchId, templateKey } },
    create: {
      matchId,
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
        matchId,
        userId,
        templateKey,
        templateTitle: template.title,
        content: result.text,
        homeClub: { id: match.homeClub.id, name: match.homeClub.name },
        awayClub: { id: match.awayClub.id, name: match.awayClub.name },
        allPlayers,
      });
    } catch (distErr) {
      console.error("[pack-generate] distribute failed", templateKey, distErr);
    }
  }

  return {
    section,
    stub: result.stub,
    gemini: isGeminiConfigured(),
    model: result.model,
    grounded: Boolean(result.grounded),
    searchQueries: result.searchQueries || [],
    distributed,
  };
}

/** Stable fingerprint of current starters for auto-lineup dedup. */
export async function computeLineupXiHash(matchId: string): Promise<string> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { homeClubId: true, awayClubId: true },
  });
  if (!match) return "";
  const starters = await prisma.player.findMany({
    where: {
      clubId: { in: [match.homeClubId, match.awayClubId] },
      OR: [{ isStarter: true }, { onPitch: true }],
    },
    select: {
      id: true,
      clubId: true,
      formationSlot: true,
      shirtNumber: true,
      name: true,
    },
    orderBy: [{ clubId: "asc" }, { formationSlot: "asc" }, { name: "asc" }],
  });
  return starters
    .map(
      (p) =>
        `${p.clubId}:${p.formationSlot || "?"}:${p.id}:${p.shirtNumber}:${p.name}`
    )
    .join("|");
}

export async function resolvePackUserId(matchId: string): Promise<string | null> {
  const note = await prisma.note.findFirst({
    where: { matchId, userId: { not: null } },
    select: { userId: true },
    orderBy: { updatedAt: "desc" },
  });
  if (note?.userId) return note.userId;
  const speak = await prisma.speak.findFirst({
    where: { matchId, userId: { not: null } },
    select: { userId: true },
  });
  if (speak?.userId) return speak.userId;
  const demo = await prisma.user.findFirst({
    where: { email: "demo@pitchline.app" },
    select: { id: true },
  });
  if (demo) return demo.id;
  const any = await prisma.user.findFirst({ select: { id: true } });
  return any?.id ?? null;
}

/**
 * When Official lineups land (or XI changes after confirmed), generate the
 * lineup pack ("let's look at the two teams") and distribute Speaks.
 * Fire-and-forget safe — catches its own errors.
 */
export async function maybeAutoGenerateLineupPack(args: {
  matchId: string;
  previousStatus: string | null | undefined;
  newStatus: string;
}): Promise<{ triggered: boolean; reason: string }> {
  const { matchId, previousStatus, newStatus } = args;
  if (newStatus !== "confirmed") {
    return { triggered: false, reason: "not_confirmed" };
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      lineupPackGeneratedAt: true,
      lineupPackXiHash: true,
    },
  });
  if (!match) return { triggered: false, reason: "missing_match" };

  const xiHash = await computeLineupXiHash(matchId);
  const transitioned =
    previousStatus !== "confirmed" && newStatus === "confirmed";
  const xiChanged =
    Boolean(match.lineupPackGeneratedAt) &&
    Boolean(xiHash) &&
    match.lineupPackXiHash !== xiHash;

  // Already confirmed + same XI → skip every subsequent sync
  if (!transitioned && !xiChanged) {
    if (match.lineupPackGeneratedAt && match.lineupPackXiHash === xiHash) {
      return { triggered: false, reason: "already_generated_same_xi" };
    }
    // Confirmed but never generated (e.g. field added later)
    const existing = await prisma.packSection.findUnique({
      where: {
        matchId_templateKey: { matchId, templateKey: "lineup" },
      },
    });
    if (
      existing?.content?.trim() &&
      existing.status === "generated" &&
      match.lineupPackGeneratedAt
    ) {
      return { triggered: false, reason: "section_exists" };
    }
    if (!transitioned && match.lineupPackGeneratedAt) {
      return { triggered: false, reason: "skip_confirmed_sync" };
    }
  }

  const userId = await resolvePackUserId(matchId);
  if (!userId) return { triggered: false, reason: "no_user" };

  try {
    const result = await generatePackForMatch({
      matchId,
      templateKey: "lineup",
      userId,
    });
    await prisma.match.update({
      where: { id: matchId },
      data: {
        lineupPackGeneratedAt: new Date(),
        lineupPackXiHash: xiHash,
      },
    });
    return {
      triggered: true,
      reason: result.stub
        ? "generated_stub"
        : transitioned
          ? "generated_on_confirm"
          : "generated_on_xi_change",
    };
  } catch (e) {
    console.error("[auto-lineup-pack]", matchId, e);
    return {
      triggered: false,
      reason: `error:${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
