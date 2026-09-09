import { NextResponse } from "next/server";
import { runPreKickoffHardSync } from "@/lib/pre-kickoff-hard-sync";

/**
 * Secured cron entry for T-30 full match sync.
 * Auth: Authorization: Bearer <CRON_SECRET|AUTH_SECRET>
 * Also accepts ?secret= for manual ops checks.
 */
function authorize(req: Request): boolean {
  const expected =
    process.env.CRON_SECRET?.trim() || process.env.AUTH_SECRET?.trim() || "";
  if (!expected) return false;

  const header = req.headers.get("authorization") || "";
  const bearer = header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearer && bearer === expected) return true;

  const url = new URL(req.url);
  const q = url.searchParams.get("secret")?.trim();
  if (q && q === expected) return true;

  return false;
}

async function handle(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runPreKickoffHardSync();
    const status = result.ok ? 200 : result.reason ? 503 : 207;
    return NextResponse.json(
      {
        ...result,
        at: new Date().toISOString(),
        job: "pre-kickoff-hard-sync",
      },
      { status }
    );
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e || "cron failed");
    console.error("[cron/pre-kickoff-hard-sync]", raw);
    return NextResponse.json(
      { error: "Pre-kickoff hard sync failed", detail: raw.slice(0, 200) },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
