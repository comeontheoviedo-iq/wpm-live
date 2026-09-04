import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  ApiFootballError,
  isApiFootballConfigured,
  searchLeagues,
} from "@/lib/api-football";
import { PRIORITY_COMPETITIONS } from "@/lib/competitions";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q") || "";

  if (!isApiFootballConfigured()) {
    const local = PRIORITY_COMPETITIONS.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q.toLowerCase()) ||
        c.country.toLowerCase().includes(q.toLowerCase())
    );
    return NextResponse.json({
      configured: false,
      leagues: local,
      message: "API_FOOTBALL_KEY missing — showing seeded priority competitions only",
    });
  }

  if (!q.trim()) {
    return NextResponse.json({
      configured: true,
      leagues: PRIORITY_COMPETITIONS,
    });
  }

  try {
    const leagues = await searchLeagues(q.trim());
    return NextResponse.json({ configured: true, leagues });
  } catch (e) {
    const err = e as ApiFootballError;
    return NextResponse.json(
      { configured: true, error: err.message, leagues: [] },
      { status: err.status || 502 }
    );
  }
}
