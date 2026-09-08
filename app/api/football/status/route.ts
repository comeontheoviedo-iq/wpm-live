import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  ApiFootballError,
  getApiStatus,
  isApiFootballConfigured,
} from "@/lib/api-football";

/** Test API-Football connectivity without exposing the key. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isApiFootballConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        message:
          "Live-feed key is not set. Add it to .env / .env.local and restart the Next.js server.",
      },
      { status: 200 }
    );
  }

  try {
    const status = await getApiStatus();
    const plan = status?.subscription?.plan || "unknown";
    const active = status?.subscription?.active;
    const current = status?.requests?.current;
    const limit = status?.requests?.limit_day;
    const planLower = String(plan).toLowerCase();
    const isFree = planLower.includes("free") || planLower === "unknown";
    const seasonHint = isFree
      ? " Free plans usually cannot query league+season for 2025+ (often capped ~2022–2024). Use date-only search (CoComms filters by league client/server-side) or upgrade the live-feed plan."
      : "";
    return NextResponse.json({
      ok: true,
      configured: true,
      message: `OK · plan ${plan}${active === false ? " (inactive)" : ""}${
        current != null && limit != null ? ` · ${current}/${limit} requests today` : ""
      }${seasonHint}`,
      plan,
      active: active ?? null,
      requests: status?.requests ?? null,
      freePlanSeasonLimit: isFree,
    });
  } catch (e) {
    const err = e as ApiFootballError;
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        message: err.message || "Connection failed",
        code: err.code,
      },
      { status: err.status && err.status < 500 ? err.status : 200 }
    );
  }
}
