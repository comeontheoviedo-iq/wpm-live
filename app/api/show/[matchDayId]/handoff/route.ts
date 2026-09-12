import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { packageHandoff, toBoardJson } from "@/lib/ur-show";

export const dynamic = "force-dynamic";

/**
 * Ready for desk handoff — packages AF fixture, overlay URL, approved creatives/social.
 * Consumer: Remote football comms desk (Restream / creatives / OBS).
 * Optional: UR_HANDOFF_WEBHOOK_URL env hook.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ matchDayId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { matchDayId } = await ctx.params;

  const result = await packageHandoff(matchDayId, session.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    ok: true,
    payload: result.payload,
    webhook: result.webhook,
    board: toBoardJson(result.show),
  });
}
