import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  ApiFootballError,
  getApiStatus,
  isApiFootballConfigured,
} from "@/lib/api-football";
import { checkAfUsageAlert, evaluateAfUsage } from "@/lib/af-usage";

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
        usage: null,
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
    const usage = evaluateAfUsage(status);
    if (usage.level === "warn" || usage.level === "high") {
      console.warn("[af-usage]", usage.level, usage.message);
    }
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
      usage,
    });
  } catch (e) {
    const err = e as ApiFootballError;
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        message: err.message || "Connection failed",
        code: err.code,
        usage: await checkAfUsageAlert({ log: false }).catch(() => null),
      },
      { status: err.status && err.status < 500 ? err.status : 200 }
    );
  }
}
