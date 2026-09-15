import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  ApiFootballError,
  isApiFootballConfigured,
  rankTeamSearchHits,
  searchTeams,
} from "@/lib/api-football";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isApiFootballConfigured()) {
    return NextResponse.json({
      configured: false,
      teams: [],
      message: "API_FOOTBALL_KEY missing",
    });
  }
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const limitRaw = Number(searchParams.get("limit") || 12);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.floor(limitRaw), 1), 20)
    : 12;
  if (q.trim().length < 2) {
    return NextResponse.json({ configured: true, teams: [] });
  }
  try {
    const raw = await searchTeams(q.trim());
    const teams = rankTeamSearchHits(raw, q.trim(), limit);
    return NextResponse.json({ configured: true, teams });
  } catch (e) {
    const err = e as ApiFootballError;
    return NextResponse.json(
      { configured: true, error: err.message, teams: [] },
      { status: err.status || 502 }
    );
  }
}
