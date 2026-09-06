import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  clearPlanOverride,
  getEffectivePlan,
  planStatus,
  writePlanOverride,
  type PitchlinePlan,
} from "@/lib/plan";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(planStatus());
}

/**
 * Chris testing toggle: enable/disable Intel without Stripe.
 * Body: { plan: "base" | "intel" } or { enableIntel: boolean } or { clearOverride: true }
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (body.clearOverride === true) {
    clearPlanOverride();
    return NextResponse.json({
      ok: true,
      cleared: true,
      ...planStatus(),
    });
  }

  let plan: PitchlinePlan | null = null;
  if (body.plan === "base" || body.plan === "intel") {
    plan = body.plan;
  } else if (typeof body.enableIntel === "boolean") {
    plan = body.enableIntel ? "intel" : "base";
  }

  if (!plan) {
    return NextResponse.json(
      { error: 'Provide plan: "base"|"intel" or enableIntel: boolean' },
      { status: 400 }
    );
  }

  writePlanOverride(plan);
  return NextResponse.json({
    ok: true,
    ...planStatus(),
    message:
      plan === "intel"
        ? `Intel enabled for testing (was env=${planStatus().envPlan}). Stripe later.`
        : `Back on Base (Matchday). Gemini features gated.`,
  });
}

export async function PUT(req: Request) {
  return POST(req);
}
