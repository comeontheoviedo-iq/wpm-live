import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canUseUrShow } from "@/lib/ur-access";
import { claimMatchDayForUr, toBoardJson } from "@/lib/ur-show";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ matchDayId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUseUrShow(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { matchDayId } = await ctx.params;

  const result = await claimMatchDayForUr(matchDayId, session.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    claimed: true,
    created: result.created,
    board: toBoardJson(result.show),
  });
}
