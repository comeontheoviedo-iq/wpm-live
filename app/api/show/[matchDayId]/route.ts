import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canUseUrShow } from "@/lib/ur-access";
import { prisma } from "@/lib/prisma";
import {
  findOwnedUrShow,
  toBoardJson,
  destinationsGate,
  refreshUrShowFromMatch,
  maybeAdvanceUrStatusFromCompleteness,
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

  let show = await findOwnedUrShow(matchDayId, session.id);
  if (!show) {
    return NextResponse.json({ claimed: false, matchDayId });
  }

  // Refresh autofill + strip legacy wrong-fixture art / apply known pack
  const refreshed = await refreshUrShowFromMatch(matchDayId, session.id, {
    forceText: true,
  });
  if (refreshed.ok) show = refreshed.show;
  await maybeAdvanceUrStatusFromCompleteness(matchDayId, session.id);
  show = (await findOwnedUrShow(matchDayId, session.id)) || show;

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

  if (action === "refresh-from-match") {
    const result = await refreshUrShowFromMatch(matchDayId, session.id, {
      forceText: true,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    await maybeAdvanceUrStatusFromCompleteness(matchDayId, session.id);
    const refreshed = await findOwnedUrShow(matchDayId, session.id);
    return NextResponse.json({ claimed: true, board: toBoardJson(refreshed!) });
  }

  if (action === "creative") {
    const creativeId = String(body.creativeId || "");
    const status = body.status != null ? String(body.status) : null;
    if (!creativeId) {
      return NextResponse.json({ error: "creativeId required" }, { status: 400 });
    }
    const creative = show.creatives.find((c) => c.id === creativeId);
    if (!creative) return NextResponse.json({ error: "Creative not found" }, { status: 404 });
    if (status && !["pending", "approved", "rejected"].includes(status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    await prisma.urCreative.update({
      where: { id: creativeId },
      data: {
        ...(status ? { status } : {}),
        ...(typeof body.assetUrl === "string" ? { assetUrl: body.assetUrl || null } : {}),
        ...(typeof body.canvaId === "string" ? { canvaId: body.canvaId || null } : {}),
        ...(typeof body.canvaUrl === "string" ? { canvaUrl: body.canvaUrl || null } : {}),
        ...(typeof body.label === "string" ? { label: body.label } : {}),
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
  } else if (action === "set-assets") {
    // U+R desk hook: push per-show creatives without inventing Restream/YT
    const result = await refreshUrShowFromMatch(matchDayId, session.id, {
      forceText: false,
      ...(typeof body.ytThumbUrl === "string" || body.ytThumbUrl === null
        ? { ytThumbUrl: body.ytThumbUrl }
        : {}),
      ...(typeof body.fbCoverUrl === "string" || body.fbCoverUrl === null
        ? { fbCoverUrl: body.fbCoverUrl }
        : {}),
      ...(typeof body.igStillUrl === "string" || body.igStillUrl === null
        ? { igStillUrl: body.igStillUrl }
        : {}),
      ...(typeof body.ytThumbCanvaId === "string" || body.ytThumbCanvaId === null
        ? { ytThumbCanvaId: body.ytThumbCanvaId }
        : {}),
      ...(typeof body.ytThumbCanvaUrl === "string" || body.ytThumbCanvaUrl === null
        ? { ytThumbCanvaUrl: body.ytThumbCanvaUrl }
        : {}),
      ...(typeof body.fbCoverCanvaId === "string" || body.fbCoverCanvaId === null
        ? { fbCoverCanvaId: body.fbCoverCanvaId }
        : {}),
      ...(typeof body.fbCoverCanvaUrl === "string" || body.fbCoverCanvaUrl === null
        ? { fbCoverCanvaUrl: body.fbCoverCanvaUrl }
        : {}),
      ...(typeof body.igStillCanvaId === "string" || body.igStillCanvaId === null
        ? { igStillCanvaId: body.igStillCanvaId }
        : {}),
      ...(typeof body.igStillCanvaUrl === "string" || body.igStillCanvaUrl === null
        ? { igStillCanvaUrl: body.igStillCanvaUrl }
        : {}),
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    // Open / HT / FT moment hooks (match-specific only — never cross-fixture)
    const momentKinds = ["open", "ht", "ft"] as const;
    for (const kind of momentKinds) {
      const prefix =
        kind === "open" ? "open" : kind === "ht" ? "ht" : "ft";
      const assetKey = `${prefix}Url` as string;
      const canvaIdKey = `${prefix}CanvaId` as string;
      const canvaUrlKey = `${prefix}CanvaUrl` as string;
      if (
        !(assetKey in body) &&
        !(canvaIdKey in body) &&
        !(canvaUrlKey in body)
      ) {
        continue;
      }
      const row = show.creatives.find((c) => c.kind === kind);
      if (!row) continue;
      await prisma.urCreative.update({
        where: { id: row.id },
        data: {
          ...(assetKey in body
            ? {
                assetUrl:
                  body[assetKey] == null || body[assetKey] === ""
                    ? null
                    : String(body[assetKey]),
              }
            : {}),
          ...(canvaIdKey in body
            ? {
                canvaId:
                  body[canvaIdKey] == null || body[canvaIdKey] === ""
                    ? null
                    : String(body[canvaIdKey]),
              }
            : {}),
          ...(canvaUrlKey in body
            ? {
                canvaUrl:
                  body[canvaUrlKey] == null || body[canvaUrlKey] === ""
                    ? null
                    : String(body[canvaUrlKey]),
              }
            : {}),
        },
      });
    }
  } else {
    // Destinations + YT metadata + top-level asset URL shortcuts
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

    // Convenience: ytThumbUrl / fbCoverUrl on root PATCH also write creative rows
    const assetOpts: Parameters<typeof refreshUrShowFromMatch>[2] = {
      forceText: false,
    };
    let touchAssets = false;
    if ("ytThumbUrl" in body || "ytThumbCanvaId" in body || "ytThumbCanvaUrl" in body) {
      touchAssets = true;
      if ("ytThumbUrl" in body) assetOpts.ytThumbUrl = body.ytThumbUrl ? String(body.ytThumbUrl) : null;
      if ("ytThumbCanvaId" in body)
        assetOpts.ytThumbCanvaId = body.ytThumbCanvaId ? String(body.ytThumbCanvaId) : null;
      if ("ytThumbCanvaUrl" in body)
        assetOpts.ytThumbCanvaUrl = body.ytThumbCanvaUrl ? String(body.ytThumbCanvaUrl) : null;
    }
    if ("fbCoverUrl" in body || "fbCoverCanvaId" in body || "fbCoverCanvaUrl" in body) {
      touchAssets = true;
      if ("fbCoverUrl" in body) assetOpts.fbCoverUrl = body.fbCoverUrl ? String(body.fbCoverUrl) : null;
      if ("fbCoverCanvaId" in body)
        assetOpts.fbCoverCanvaId = body.fbCoverCanvaId ? String(body.fbCoverCanvaId) : null;
      if ("fbCoverCanvaUrl" in body)
        assetOpts.fbCoverCanvaUrl = body.fbCoverCanvaUrl ? String(body.fbCoverCanvaUrl) : null;
    }
    if ("igStillUrl" in body || "igStillCanvaId" in body || "igStillCanvaUrl" in body) {
      touchAssets = true;
      if ("igStillUrl" in body) assetOpts.igStillUrl = body.igStillUrl ? String(body.igStillUrl) : null;
      if ("igStillCanvaId" in body)
        assetOpts.igStillCanvaId = body.igStillCanvaId ? String(body.igStillCanvaId) : null;
      if ("igStillCanvaUrl" in body)
        assetOpts.igStillCanvaUrl = body.igStillCanvaUrl ? String(body.igStillCanvaUrl) : null;
    }
    if (touchAssets) {
      await refreshUrShowFromMatch(matchDayId, session.id, assetOpts);
    }

    // Moment slots on root PATCH too
    for (const kind of ["open", "ht", "ft"] as const) {
      const assetKey = `${kind}Url`;
      const canvaIdKey = `${kind}CanvaId`;
      const canvaUrlKey = `${kind}CanvaUrl`;
      if (!(assetKey in body) && !(canvaIdKey in body) && !(canvaUrlKey in body)) {
        continue;
      }
      const row = (await findOwnedUrShow(matchDayId, session.id))?.creatives.find(
        (c) => c.kind === kind
      );
      if (!row) continue;
      await prisma.urCreative.update({
        where: { id: row.id },
        data: {
          ...(assetKey in body
            ? {
                assetUrl: body[assetKey] ? String(body[assetKey]) : null,
              }
            : {}),
          ...(canvaIdKey in body
            ? {
                canvaId: body[canvaIdKey] ? String(body[canvaIdKey]) : null,
              }
            : {}),
          ...(canvaUrlKey in body
            ? {
                canvaUrl: body[canvaUrlKey] ? String(body[canvaUrlKey]) : null,
              }
            : {}),
        },
      });
    }
  }

  await maybeAdvanceUrStatusFromCompleteness(matchDayId, session.id);
  const refreshed = await findOwnedUrShow(matchDayId, session.id);
  const board = toBoardJson(refreshed!);
  board.destinationsGate = destinationsGate(
    refreshed!.youtubeWatchUrl,
    refreshed!.restreamExternalUrl
  );
  return NextResponse.json({ claimed: true, board });
}
