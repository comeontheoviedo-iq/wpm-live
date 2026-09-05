import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isApiFootballConfigured } from "@/lib/api-football";
import { syncMatchFromApiFootball } from "@/lib/sync-fixture";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isApiFootballConfigured()) {
    return NextResponse.json(
      {
        error:
          "API_FOOTBALL_KEY is not set. Add it to .env to sync lineups and live events.",
      },
      { status: 503 }
    );
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    const result = await syncMatchFromApiFootball(id, {
      resetPlacements: Boolean(body?.resetPlacements),
    });
    return NextResponse.json(result);
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e || "Sync failed");
    console.error("[POST /api/matches/:id/sync]", raw);
    // Never leak Prisma / Turbopack dumps to the desk poll chip.
    let error = "Sync failed";
    if (/Unknown argument [`']?minuteExtra[`']?/i.test(raw)) {
      error = "Schema drift — run prisma db push && generate, then restart";
    } else if (/Unauthorized|session/i.test(raw)) {
      error = "Unauthorized";
    } else if (/not linked|fixture/i.test(raw) && raw.length < 120) {
      error = raw;
    } else if (
      !/TURBOPACK|__TURBOPACK__|prisma\.|Invalid `prisma|at\s+\S+\s+\(/i.test(
        raw
      ) &&
      raw.length <= 120
    ) {
      error = raw;
    }
    return NextResponse.json({ error }, { status: 400 });
  }
}
