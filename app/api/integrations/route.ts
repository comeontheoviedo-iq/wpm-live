import { NextResponse } from "next/server";
import { integrationStatus } from "@/lib/env";
import { planStatus } from "@/lib/plan";

export async function GET() {
  const status = integrationStatus();
  const plan = planStatus();
  return NextResponse.json({
    ...status,
    plan: plan.plan,
    hasIntel: plan.hasIntel,
    canUseGeminiBrief: plan.canUseGeminiBrief,
    canAutoGenPack: plan.canAutoGenPack,
    hint: "After editing .env / .env.local, restart Next.js. Plan env = base|intel (default base). Settings override for testing; Stripe later.",
  });
}
