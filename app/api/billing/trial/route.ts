import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  buildTrialSnapshot,
  cancelAppTrial,
  resumeAppTrial,
} from "@/lib/trial";
import { isStripeConfigured, stripePublicStatus } from "@/lib/stripe";

/**
 * POST { action: "cancel" | "resume" }
 * App-side cancel when Stripe missing; when Stripe configured, prefer Customer Portal.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "").trim();

  if (action === "cancel") {
    if (isStripeConfigured()) {
      return NextResponse.json(
        {
          error: "Use billing portal to cancel",
          hint: "POST /api/billing/portal — cancel before trial ends to avoid the £22/mo charge.",
          usePortal: true,
          stripe: stripePublicStatus(),
        },
        { status: 409 }
      );
    }
    await cancelAppTrial(session.id);
    const trial = await buildTrialSnapshot(session.id);
    return NextResponse.json({
      ok: true,
      trial,
      message:
        "Trial cancelled. You keep access until the trial end date and will not convert to £22/mo. When billing keys exist, cancel via Manage billing instead.",
    });
  }

  if (action === "resume") {
    if (isStripeConfigured()) {
      return NextResponse.json(
        {
          error: "Use billing portal to manage subscription",
          usePortal: true,
          stripe: stripePublicStatus(),
        },
        { status: 409 }
      );
    }
    try {
      await resumeAppTrial(session.id);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Could not resume trial" },
        { status: 400 }
      );
    }
    const trial = await buildTrialSnapshot(session.id);
    return NextResponse.json({
      ok: true,
      trial,
      message: "Trial resumed — will convert to Unlimited £22/mo at end unless cancelled again.",
    });
  }

  return NextResponse.json(
    { error: 'Provide action: "cancel" | "resume"' },
    { status: 400 }
  );
}
