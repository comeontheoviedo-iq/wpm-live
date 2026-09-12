import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getAppBaseUrl,
  getStripe,
  isStripeConfigured,
  stripePublicStatus,
  unlimitedPriceId,
} from "@/lib/stripe";

/**
 * POST /api/billing/checkout
 * Creates a Stripe Checkout Session for Unlimited £22/mo when keys exist.
 * Body optional: { successUrl?, cancelUrl? }
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error: "Stripe not configured",
        todo: "Add STRIPE_SECRET_KEY and STRIPE_PRICE_UNLIMITED (Dashboard product £22/mo) to Netlify env for pitchline-app, then redeploy.",
        status: stripePublicStatus(),
      },
      { status: 503 }
    );
  }

  const stripe = await getStripe();
  const priceId = unlimitedPriceId();
  if (!stripe || !priceId) {
    return NextResponse.json(
      { error: "Stripe SDK or price missing", status: stripePublicStatus() },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const base = getAppBaseUrl(req);
  const successUrl =
    String(body.successUrl || "").trim() ||
    `${base}/settings?billing=success`;
  const cancelUrl =
    String(body.cancelUrl || "").trim() || `${base}/pricing?billing=cancel`;

  try {
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: session.email,
      client_reference_id: session.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl.includes("{CHECKOUT_SESSION_ID}")
        ? successUrl
        : `${successUrl}${successUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        userId: session.id,
        plan: "unlimited",
        product: "cocomms-unlimited",
      },
      subscription_data: {
        metadata: {
          userId: session.id,
          plan: "unlimited",
        },
      },
      allow_promotion_codes: true,
    });

    if (!checkout.url) {
      return NextResponse.json({ error: "Checkout session missing URL" }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      url: checkout.url,
      sessionId: checkout.id,
      plan: "unlimited",
      price: "£22",
    });
  } catch (e) {
    console.error("[billing/checkout]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Checkout failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ...stripePublicStatus(),
    plan: "unlimited",
    price: "£22",
    message: isStripeConfigured()
      ? "POST to create Checkout Session for Unlimited."
      : "Stripe keys missing — Pricing UI still shows £22 Unlimited.",
  });
}
