import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { advanceUrStatus, toBoardJson, UR_SHOW_STATUSES } from "@/lib/ur-show";
import { prisma } from "@/lib/prisma";
import { findOwnedUrShow } from "@/lib/ur-show";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ matchDayId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { matchDayId } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  if (body.status && typeof body.status === "string") {
    if (!UR_SHOW_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    const show = await findOwnedUrShow(matchDayId, session.id);
    if (!show) return NextResponse.json({ error: "Show not claimed" }, { status: 404 });
    await prisma.urShow.update({
      where: { id: show.id },
      data: { status: body.status },
    });
    const refreshed = await findOwnedUrShow(matchDayId, session.id);
    return NextResponse.json({ claimed: true, board: toBoardJson(refreshed!) });
  }

  const direction = body.direction === "back" ? "back" : "next";
  const result = await advanceUrStatus(matchDayId, session.id, direction);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ claimed: true, board: toBoardJson(result.show!) });
}
