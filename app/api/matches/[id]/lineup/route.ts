import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { savePredictedLineup, snapshotPredictedSide } from "@/lib/sync-fixture";
import { upsertPitchPlacement } from "@/lib/pitch-placement";
import { planDirectSlotSwap } from "@/lib/pitch-swap";

/** Manual override / DnD predicted XI slot assignment. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  // Bulk predicted XI from desk DnD
  if (body.side && Array.isArray(body.slots)) {
    try {
      const match = await savePredictedLineup(
        id,
        body.side === "away" ? "away" : "home",
        body.slots.map((s: { playerId: string; formationSlot: string }) => ({
          playerId: String(s.playerId),
          formationSlot: String(s.formationSlot),
        })),
        body.formation ? String(body.formation) : undefined
      );
      return NextResponse.json({ match, lineupStatus: match.lineupStatus });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Save failed" },
        { status: 400 }
      );
    }
  }

  // Place / clear a single player on a slot (DnD drop)
  if (body.action === "place" || body.action === "clear" || body.action === "freePlace") {
    const match = await prisma.match.findUnique({
      where: { id },
      select: {
        id: true,
        homeClubId: true,
        awayClubId: true,
        lineupStatus: true,
        lineupSource: true,
        xiFeedFrozenReason: true,
      },
    });
    if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // Official boards stay editable for commentary; Sync restores AF XI.

    const playerId = String(body.playerId || "");
    if (!playerId) return NextResponse.json({ error: "playerId required" }, { status: 400 });

    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

    const side =
      player.clubId === match.homeClubId
        ? "home"
        : player.clubId === match.awayClubId
          ? "away"
          : null;
    if (!side) {
      return NextResponse.json({ error: "Player not in this match" }, { status: 400 });
    }

    if (body.action === "clear") {
      await prisma.player.update({
        where: { id: playerId },
        data: { isStarter: false, onPitch: false, formationSlot: null },
      });
      await upsertPitchPlacement({
        matchId: id,
        playerId,
        clearPlacement: true,
      });
    } else if (body.action === "freePlace") {
      const pitchX = body.pitchX;
      const pitchY = body.pitchY;
      const slot = body.formationSlot ? String(body.formationSlot) : player.formationSlot;
      await prisma.player.update({
        where: { id: playerId },
        data: {
          isStarter: true,
          onPitch: true,
          ...(slot ? { formationSlot: slot } : {}),
        },
      });
      await upsertPitchPlacement({
        matchId: id,
        playerId,
        formationSlot: slot || null,
        pitchX: pitchX ?? null,
        pitchY: pitchY ?? null,
      });
    } else {
      const slot = String(body.formationSlot || "");
      if (!slot) {
        return NextResponse.json({ error: "formationSlot required" }, { status: 400 });
      }
      // Strict 2-way Direct swap: placer ↔ sole occupant only (never rotate a third)
      const occupant = await prisma.player.findFirst({
        where: { clubId: player.clubId, formationSlot: slot, NOT: { id: playerId } },
      });
      const plan = planDirectSlotSwap({
        placerId: playerId,
        targetSlot: slot,
        placerPrevSlot: player.formationSlot,
        occupantId: occupant?.id ?? null,
      });

      if (plan.occupantId && plan.occupantToSlot) {
        await prisma.player.update({
          where: { id: plan.occupantId },
          data: {
            isStarter: true,
            onPitch: true,
            formationSlot: plan.occupantToSlot,
          },
        });
      } else if (plan.occupantId) {
        await prisma.player.update({
          where: { id: plan.occupantId },
          data: { isStarter: false, onPitch: false, formationSlot: null },
        });
      }
      await prisma.player.update({
        where: { id: playerId },
        data: { isStarter: true, onPitch: true, formationSlot: plan.targetSlot },
      });

      // Match-scoped overrides: clear free-place coords on both so reapply
      // cannot cascade via stale pitchX/Y + slot claims.
      await upsertPitchPlacement({
        matchId: id,
        playerId,
        formationSlot: plan.targetSlot,
        pitchX: null,
        pitchY: null,
      });
      if (plan.occupantId && plan.occupantToSlot) {
        await upsertPitchPlacement({
          matchId: id,
          playerId: plan.occupantId,
          formationSlot: plan.occupantToSlot,
          pitchX: null,
          pitchY: null,
        });
      } else if (plan.occupantId) {
        await upsertPitchPlacement({
          matchId: id,
          playerId: plan.occupantId,
          clearPlacement: true,
        });
      }

      // Drop any third-party override still claiming either swap slot — that
      // stale claim is what rotated CM→CD→LB on reapply after free-place.
      const claimed = [plan.targetSlot, plan.occupantToSlot].filter(
        (s): s is string => Boolean(s)
      );
      if (claimed.length) {
        const keep = new Set(
          [playerId, plan.occupantId].filter(Boolean) as string[]
        );
        const stale = await prisma.matchPlayerOverride.findMany({
          where: {
            matchId: id,
            formationSlot: { in: claimed },
            playerId: { notIn: [...keep] },
          },
          select: { playerId: true },
        });
        for (const row of stale) {
          await upsertPitchPlacement({
            matchId: id,
            playerId: row.playerId,
            formationSlot: null,
            pitchX: null,
            pitchY: null,
          });
        }
      }
    }

    const json = await snapshotPredictedSide(
      side === "home" ? match.homeClubId : match.awayClubId
    );
    // Keep Official badge when commentary-editing a confirmed board
    const keepOfficial = match.lineupStatus === "confirmed";
    const keepManual =
      match.lineupSource === "manual" ||
      match.xiFeedFrozenReason === "blank_canvas";
    const updated = await prisma.match.update({
      where: { id },
      data: {
        lineupStatus: keepOfficial
          ? "confirmed"
          : keepManual
            ? "expected"
            : "predicted",
        ...(keepManual
          ? { lineupSource: "manual" }
          : keepOfficial
            ? {}
            : { lineupSource: "predicted" }),
        ...(side === "home" ? { predictedHomeJson: json } : { predictedAwayJson: json }),
        ...(body.formation
          ? side === "home"
            ? { homeFormation: String(body.formation) }
            : { awayFormation: String(body.formation) }
          : {}),
      },
    });

    const refreshed = await prisma.player.findUnique({ where: { id: playerId } });
    return NextResponse.json({ player: refreshed, match: updated });
  }

  // Legacy single-field patch
  const playerId = String(body.playerId || "");
  if (!playerId) return NextResponse.json({ error: "playerId required" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if ("formationSlot" in body) data.formationSlot = body.formationSlot;
  if ("isStarter" in body) data.isStarter = Boolean(body.isStarter);
  if ("onPitch" in body) data.onPitch = Boolean(body.onPitch);
  if ("shirtNumber" in body) data.shirtNumber = Number(body.shirtNumber);

  const player = await prisma.player.update({ where: { id: playerId }, data });

  if (body.homeFormation || body.awayFormation || body.lineupStatus) {
    await prisma.match.update({
      where: { id },
      data: {
        ...(body.homeFormation ? { homeFormation: String(body.homeFormation) } : {}),
        ...(body.awayFormation ? { awayFormation: String(body.awayFormation) } : {}),
        ...(body.lineupStatus ? { lineupStatus: String(body.lineupStatus) } : {}),
      },
    });
  }

  return NextResponse.json({ player });
}
