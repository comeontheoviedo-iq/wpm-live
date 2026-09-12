import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canUseUrShow } from "@/lib/ur-access";
import { prisma } from "@/lib/prisma";
import {
  findOwnedUrShow,
  toBoardJson,
  destinationsGate,
} from "@/lib/ur-show";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ matchDayId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUseUrShow(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { matchDayId } = await ctx.params;

  const owned = await prisma.matchDay.findFirst({
    where: { id: matchDayId, userId: session.id },
    select: { id: true },
  });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const show = await findOwnedUrShow(matchDayId, session.id);
  if (!show) {
    return NextResponse.json({ claimed: false, matchDayId });
  }
  return NextResponse.json({ claimed: true, board: toBoardJson(show) });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ matchDayId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUseUrShow(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { matchDayId } = await ctx.params;

  const show = await findOwnedUrShow(matchDayId, session.id);
  if (!show) return NextResponse.json({ error: "Show not claimed" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "update");

  if (action === "creative") {
    const creativeId = String(body.creativeId || "");
    const status = String(body.status || "");
    if (!creativeId || !["pending", "approved", "rejected"].includes(status)) {
      return NextResponse.json({ error: "creativeId + status required" }, { status: 400 });
    }
    const creative = show.creatives.find((c) => c.id === creativeId);
    if (!creative) return NextResponse.json({ error: "Creative not found" }, { status: 404 });
    await prisma.urCreative.update({
      where: { id: creativeId },
      data: {
        status,
        ...(typeof body.assetUrl === "string" ? { assetUrl: body.assetUrl || null } : {}),
      },
    });
    // Approve → schedule matching social slots
    if (status === "approved") {
      await prisma.urSocialSlot.updateMany({
        where: { urShowId: show.id, creativeKind: creative.kind },
        data: { approved: true, status: "scheduled" },
      });
    }
  } else if (action === "social") {
    const slotId = String(body.slotId || "");
    if (!slotId) return NextResponse.json({ error: "slotId required" }, { status: 400 });
    const slot = show.socialSlots.find((s) => s.id === slotId);
    if (!slot) return NextResponse.json({ error: "Slot not found" }, { status: 404 });
    await prisma.urSocialSlot.update({
      where: { id: slotId },
      data: {
        ...(typeof body.approved === "boolean" ? { approved: body.approved } : {}),
        ...(typeof body.copy === "string" ? { copy: body.copy } : {}),
        ...(typeof body.assetUrl === "string" ? { assetUrl: body.assetUrl || null } : {}),
        ...(typeof body.platform === "string" ? { platform: body.platform } : {}),
        ...(body.scheduledAt
          ? { scheduledAt: new Date(body.scheduledAt) }
          : {}),
        ...(body.approved === true ? { status: "scheduled" } : {}),
        ...(body.approved === false ? { status: "draft" } : {}),
      },
    });
  } else {
    // Destinations + YT metadata
    const data: Record<string, string | null> = {};
    if ("youtubeWatchUrl" in body) {
      data.youtubeWatchUrl = body.youtubeWatchUrl
        ? String(body.youtubeWatchUrl).trim()
        : null;
    }
    if ("restreamExternalUrl" in body) {
      data.restreamExternalUrl = body.restreamExternalUrl
        ? String(body.restreamExternalUrl).trim()
        : null;
    }
    if ("ytTitle" in body) {
      data.ytTitle = body.ytTitle ? String(body.ytTitle).trim() : null;
    }
    if ("ytDescription" in body) {
      data.ytDescription = body.ytDescription
        ? String(body.ytDescription).trim()
        : null;
    }
    if ("igStillUrl" in body) {
      data.igStillUrl = body.igStillUrl ? String(body.igStillUrl).trim() : null;
    }
    if (Object.keys(data).length) {
      await prisma.urShow.update({ where: { id: show.id }, data });
    }
  }

  const refreshed = await findOwnedUrShow(matchDayId, session.id);
  const board = toBoardJson(refreshed!);
  // Attach live gate after destination edits
  board.destinationsGate = destinationsGate(
    refreshed!.youtubeWatchUrl,
    refreshed!.restreamExternalUrl
  );
  return NextResponse.json({ claimed: true, board });
}
