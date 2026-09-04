import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  ApiFootballError,
  isApiFootballConfigured,
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
  const q = new URL(req.url).searchParams.get("q") || "";
  if (q.trim().length < 2) {
    return NextResponse.json({ configured: true, teams: [] });
  }
  try {
    const teams = await searchTeams(q.trim());
    return NextResponse.json({ configured: true, teams });
  } catch (e) {
    const err = e as ApiFootballError;
    return NextResponse.json(
      { configured: true, error: err.message, teams: [] },
      { status: err.status || 502 }
    );
  }
}
