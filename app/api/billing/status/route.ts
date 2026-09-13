import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildTrialSnapshot, startAppTrial } from "@/lib/trial";
import { billingPublicStatus, isBillingConfigured } from "@/lib/billing";

/** GET — trial + billing snapshot for Settings / dashboard. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const trial = await buildTrialSnapshot(session.id);
  return NextResponse.json({
    ok: true,
    trial,
    billing: billingPublicStatus(),
    /** @deprecated use billing — kept for older Settings clients */
    stripe: billingPublicStatus().stripe,
  });
}

/**
 * POST — start app-side trial when billing keys are missing.
 * When Polar/Stripe configured, clients should use /api/billing/checkout.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (body.action && body.action !== "start") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  if (isBillingConfigured()) {
    return NextResponse.json(
      {
        error: "Use Checkout for card-upfront trial",
        hint: 'POST /api/billing/checkout { plan: "unlimited" } or { plan: "match_pass", credits: 1|5|10 } — choose at start.',
        billing: billingPublicStatus(),
      },
      { status: 409 }
    );
  }

  const existing = await buildTrialSnapshot(session.id);
  if (existing?.billingStatus === "active") {
    return NextResponse.json({ ok: true, trial: existing, message: "Already on Unlimited." });
  }
  if (existing?.trialActive) {
    return NextResponse.json({ ok: true, trial: existing, message: "Trial already active." });
  }

  await startAppTrial(session.id);
  const trial = await buildTrialSnapshot(session.id);
  return NextResponse.json({
    ok: true,
    trial,
    message:
      "14-day trial started (3 match desks). Converts to Unlimited £22/mo unless you cancel in Settings. Billing portal wires when Polar keys are set — see docs/POLAR_BILLING.md.",
  });
}
