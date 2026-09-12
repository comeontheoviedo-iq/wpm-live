import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { STATUS_FLOW } from "@/lib/utils";
import { buildHt2hIntroScript } from "@/lib/ht-2h-intro";


async function saveHt2hIntro(matchId: string, userId: string) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        matchDay: true,
        homeClub: true,
        awayClub: true,
        events: { orderBy: [{ minute: "asc" }, { createdAt: "asc" }] },
      },
    });
    if (!match) return;
    const homeName = match.homeClub.shortName || match.homeClub.name;
    const awayName = match.awayClub.shortName || match.awayClub.name;
    const script = buildHt2hIntroScript({
      homeName,
      awayName,
      homeScore: match.homeScore ?? 0,
      awayScore: match.awayScore ?? 0,
      competition: match.matchDay.competition,
      events: match.events.map((e) => ({
        type: e.type,
        minute: e.minute,
        description: e.description,
        teamSide: e.teamSide,
      })),
      homeFormation: match.homeFormation,
      awayFormation: match.awayFormation,
    });
    const title = `2nd half intro · ${homeName} ${match.homeScore}–${match.awayScore} ${awayName}`;
    const existing = await prisma.speak.findFirst({
      where: {
        matchId: match.id,
        timing: "half-time",
        OR: [
          { title: { startsWith: "2nd half intro" } },
          { title: { startsWith: "2H intro" } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing && existing.status !== "edited") {
      await prisma.speak.update({
        where: { id: existing.id },
        data: { title, body: script, status: "generated" },
      });
    } else if (!existing) {
      await prisma.speak.create({
        data: {
          matchId: match.id,
          userId,
          title,
          body: script,
          timing: "half-time",
          status: "generated",
          order: 0,
        },
      });
    }
    await prisma.packSection.upsert({
      where: {
        matchId_templateKey: {
          matchId: match.id,
          templateKey: "ht_2h_intro",
        },
      },
      create: {
        matchId: match.id,
        templateKey: "ht_2h_intro",
        title: "2nd half intro",
        content: script,
        status: "ready",
      },
      update: {
        content: script,
        title: "2nd half intro",
        status: "ready",
      },
    });
  } catch (err) {
    console.error("[status] ht-2h-intro soft-fail", err);
  }
}

const PERIOD_CONTROLS = ["HT", "2H", "FT", "1H"] as const;
type PeriodControl = (typeof PERIOD_CONTROLS)[number];

/**
 * Manual desk status / period overrides.
 * AF sync remains source of truth when it catches up — these fire at the whistle.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const periodControlRaw = String(
    body.periodControl || (!body.status ? body.period : "") || ""
  ).toUpperCase();
  const periodControl = PERIOD_CONTROLS.includes(periodControlRaw as PeriodControl)
    ? (periodControlRaw as PeriodControl)
    : null;
  const status = String(body.status || "");

  const existing = await prisma.match.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Period whistle controls (HT / 2H / FT) — do not require STATUS_FLOW status body
  if (periodControl && !status) {
    const data: {
      status: string;
      period: string;
      minute?: number;
    } = {
      status: existing.status,
      period: periodControl,
    };

    if (periodControl === "HT") {
      data.status = "Live";
      data.period = "HT";
      data.minute = 45;
      await prisma.matchEvent.create({
        data: {
          matchId: id,
          type: "halftime",
          minute: 45,
          description: "Half-time",
          commentary: "Half-time whistle — break.",
        },
      });
    } else if (periodControl === "2H") {
      data.status = "Live";
      data.period = "2H";
      data.minute = Math.max(existing.minute || 0, 46);
      await prisma.matchEvent.create({
        data: {
          matchId: id,
          type: "kickoff",
          minute: 46,
          description: "Second half — kick-off",
          commentary: "Second half underway.",
        },
      });
    } else if (periodControl === "FT") {
      data.status = "Full Time";
      data.period = "FT";
      await prisma.matchEvent.create({
        data: {
          matchId: id,
          type: "fulltime",
          minute: Math.max(existing.minute || 90, 90),
          description: "Full time",
          commentary: "That's the final whistle.",
        },
      });
    } else if (periodControl === "1H") {
      data.status = "Live";
      data.period = "1H";
      data.minute = existing.minute > 0 ? existing.minute : 1;
    }

    const match = await prisma.match.update({ where: { id }, data });
    if (periodControl === "HT") {
      void saveHt2hIntro(id, session.id);
    }
    return NextResponse.json({ match });
  }

  if (!STATUS_FLOW.includes(status as (typeof STATUS_FLOW)[number])) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const data: {
    status: string;
    period?: string;
    minute?: number;
  } = { status };

  if (status === "Live") {
    data.period = "1H";
    data.minute = 1;
    await prisma.matchEvent.create({
      data: {
        matchId: id,
        type: "kickoff",
        minute: 0,
        description: "Kick-off — 1st half",
        commentary: "We're underway!",
      },
    });
  }
  if (status === "Full Time") {
    data.period = "FT";
    await prisma.matchEvent.create({
      data: {
        matchId: id,
        type: "fulltime",
        minute: 90,
        description: "Full time",
        commentary: "That's the final whistle.",
      },
    });
  }

  const match = await prisma.match.update({ where: { id }, data });
  return NextResponse.json({ match });
}
