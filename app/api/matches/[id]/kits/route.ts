import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertMatchOwned } from "@/lib/tenancy";
import {
  emptyKit,
  normalizeHex,
  parseStoredKit,
  serializeManualKit,
  type KitSwatch,
  type MatchKitColors,
  isManualKitOverride,
} from "@/lib/kit-colors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanSwatch(raw: unknown): KitSwatch {
  if (!raw || typeof raw !== "object") {
    return { primary: null, number: null, border: null };
  }
  const o = raw as Record<string, unknown>;
  return {
    primary: normalizeHex(o.primary),
    number: normalizeHex(o.number),
    border: normalizeHex(o.border),
  };
}

function cleanKit(raw: unknown): MatchKitColors | null {
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const kit: MatchKitColors = {
    player: cleanSwatch(o.player),
    goalkeeper: cleanSwatch(o.goalkeeper ?? o.goalKeeper),
  };
  if (!kit.player.primary && !kit.goalkeeper.primary) {
    // Allow partial — at least keep structure for GK-only tweaks
    return { ...emptyKit(), ...kit };
  }
  return kit;
}

/**
 * PATCH desk kit colours (manual override).
 * Body: { home?: MatchKitColors | null, away?: MatchKitColors | null,
 *         reset?: "home" | "away" | "both" }
 * Overrides beat feed until reset (nulls JSON so next sync rehydrates).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: matchId } = await params;
  const owned = await assertMatchOwned(matchId, session);
  if (!owned.ok) {
    return NextResponse.json({ error: owned.error }, { status: owned.status });
  }

  const body = await req.json().catch(() => ({}));
  const reset = body.reset as string | undefined;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { homeKitJson: true, awayKitJson: true },
  });
  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let homeKitJson: string | null = match.homeKitJson;
  let awayKitJson: string | null = match.awayKitJson;

  if (reset === "home" || reset === "both") homeKitJson = null;
  if (reset === "away" || reset === "both") awayKitJson = null;

  if ("home" in body && reset !== "home" && reset !== "both") {
    const kit = cleanKit(body.home);
    homeKitJson = kit ? serializeManualKit(kit) : null;
  }
  if ("away" in body && reset !== "away" && reset !== "both") {
    const kit = cleanKit(body.away);
    awayKitJson = kit ? serializeManualKit(kit) : null;
  }

  const updated = await prisma.match.update({
    where: { id: matchId },
    data: { homeKitJson, awayKitJson },
    select: { homeKitJson: true, awayKitJson: true },
  });

  return NextResponse.json({
    homeKit: parseStoredKit(updated.homeKitJson),
    awayKit: parseStoredKit(updated.awayKitJson),
    homeManual: isManualKitOverride(updated.homeKitJson),
    awayManual: isManualKitOverride(updated.awayKitJson),
    homeKitJson: updated.homeKitJson,
    awayKitJson: updated.awayKitJson,
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: matchId } = await params;
  const owned = await assertMatchOwned(matchId, session);
  if (!owned.ok) {
    return NextResponse.json({ error: owned.error }, { status: owned.status });
  }
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { homeKitJson: true, awayKitJson: true },
  });
  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    homeKit: parseStoredKit(match.homeKitJson),
    awayKit: parseStoredKit(match.awayKitJson),
    homeManual: isManualKitOverride(match.homeKitJson),
    awayManual: isManualKitOverride(match.awayKitJson),
  });
}
