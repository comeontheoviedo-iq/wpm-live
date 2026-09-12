import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canUseUrShow } from "@/lib/ur-access";
import { packageHandoff, goLiveUrShow, toBoardJson } from "@/lib/ur-show";

export const dynamic = "force-dynamic";

/**
 * Handoff to Remote football comms desk (U+R).
 * Body.action:
 *   - ready_for_desk (default)
 *   - go_live — signal only (Restream destinations + We're live); does NOT start encoder
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ matchDayId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUseUrShow(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { matchDayId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "ready_for_desk");

  if (action === "go_live") {
    const result = await goLiveUrShow(matchDayId, session.id, {
      force: body.force === true,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      ok: true,
      action: "go_live",
      payload: result.payload,
      webhook: result.webhook,
      softWarn: result.softWarn,
      board: toBoardJson(result.show),
    });
  }

  const result = await packageHandoff(matchDayId, session.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    ok: true,
    action: "ready_for_desk",
    payload: result.payload,
    webhook: result.webhook,
    board: toBoardJson(result.show),
  });
}
