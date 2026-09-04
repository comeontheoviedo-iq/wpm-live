import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { STATUS_FLOW } from "@/lib/utils";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const status = String(body.status || "");
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
