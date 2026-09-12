import { NextResponse } from "next/server";
import { stripePublicStatus } from "@/lib/stripe";

/**
 * POST /api/billing/webhook
 * Scaffold only — verify signature with STRIPE_WEBHOOK_SECRET when wired.
 * TODO (Chris / Stripe Dashboard):
 *   1. Create webhook endpoint → https://www.cocomms.online/api/billing/webhook
 *   2. Events: checkout.session.completed, customer.subscription.updated|deleted
 *   3. Set STRIPE_WEBHOOK_SECRET in Netlify env
 *   4. Persist on User: billingStatus=active|cancelled, stripeCustomerId, stripeSubscriptionId
 *   5. Trial desk cap remains enforced in lib/trial until status is active
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    // Acknowledge missing secret without claiming processed
    const raw = await req.text().catch(() => "");
    console.warn(
      "[billing/webhook] STRIPE_WEBHOOK_SECRET not set — payload length",
      raw.length,
      stripePublicStatus()
    );
    return NextResponse.json({
      received: true,
      processed: false,
      todo: "Set STRIPE_WEBHOOK_SECRET and implement signature verify + User entitlement write.",
    });
  }

  // TODO: const stripe = await getStripe(); stripe.webhooks.constructEvent(...)
  return NextResponse.json({
    received: true,
    processed: false,
    todo: "Implement constructEvent + subscription entitlement persistence.",
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    webhookSecretConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()),
    ...stripePublicStatus(),
  });
}
