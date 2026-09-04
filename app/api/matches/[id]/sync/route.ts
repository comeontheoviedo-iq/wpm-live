import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isApiFootballConfigured } from "@/lib/api-football";
import { syncMatchFromApiFootball } from "@/lib/sync-fixture";

export async function POST(
  _req: Request,
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
  try {
    const result = await syncMatchFromApiFootball(id);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 400 }
    );
  }
}
