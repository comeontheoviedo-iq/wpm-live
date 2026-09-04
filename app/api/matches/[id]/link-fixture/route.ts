import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { linkFixtureToMatch } from "@/lib/sync-fixture";
import { isApiFootballConfigured } from "@/lib/api-football";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const fixtureId = Number(body.apiFootballFixtureId || body.fixtureId);
  if (!fixtureId) {
    return NextResponse.json({ error: "fixtureId required" }, { status: 400 });
  }
  const match = await linkFixtureToMatch(id, fixtureId);
  return NextResponse.json({
    match,
    configured: isApiFootballConfigured(),
  });
}
