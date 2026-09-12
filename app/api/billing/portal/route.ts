import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getAppBaseUrl,
  getStripe,
  isStripeConfigured,
  stripePublicStatus,
} from "@/lib/stripe";

/**
 * POST /api/billing/portal — Stripe Customer Portal when configured.
 * Looks up customer by email; TODO: persist stripeCustomerId on User after first checkout.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error: "Stripe not configured",
        todo: "Add STRIPE_SECRET_KEY + STRIPE_PRICE_UNLIMITED in Netlify env.",
        status: stripePublicStatus(),
      },
      { status: 503 }
    );
  }

  const stripe = await getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe SDK unavailable" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const base = getAppBaseUrl(req);
  const returnUrl = String(body.returnUrl || "").trim() || `${base}/settings`;

  try {
    const existing = await stripe.customers.list({
      email: session.email,
      limit: 1,
    });
    let customerId = existing.data[0]?.id;
    if (!customerId) {
      const created = await stripe.customers.create({
        email: session.email,
        name: session.name,
        metadata: { userId: session.id },
      });
      customerId = created.id;
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return NextResponse.json({ ok: true, url: portal.url });
  } catch (e) {
    console.error("[billing/portal]", e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Portal failed",
        hint: "Enable Customer Portal in Stripe Dashboard → Settings → Billing.",
      },
      { status: 500 }
    );
  }
}
