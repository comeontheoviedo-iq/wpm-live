import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getAppBaseUrl,
  getStripe,
  isMatchPassConfigured,
  isStripeConfigured,
  MATCH_PASS_COPY,
  matchPassPriceId,
  parseMatchPassCredits,
  stripePublicStatus,
  unlimitedPriceId,
  type MatchPassCredits,
} from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/billing/checkout
 *
 * Default (no plan / plan=unlimited): subscription Checkout — 14-day card-upfront
 * trial → Unlimited £22/mo unless cancelled.
 *
 * { plan: "match_pass", credits: 1|5|10 }: one-time Match Desk Pass pack.
 * { plan: "switch_to_pass", credits: 1|5|10 }: mid-trial switch — one-time pack with
 *   metadata switchFromTrial=true so webhook cancels Unlimited trial after pay.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const plan = String(body.plan || "unlimited").trim().toLowerCase();
  const base = getAppBaseUrl(req);
  const successUrl =
    String(body.successUrl || "").trim() ||
    `${base}/settings?billing=success`;
  const cancelUrl =
    String(body.cancelUrl || "").trim() || `${base}/pricing?billing=cancel`;

  if (plan === "match_pass" || plan === "switch_to_pass") {
    return createMatchPassCheckout({
      session,
      body,
      plan: plan as "match_pass" | "switch_to_pass",
      successUrl,
      cancelUrl,
      req,
    });
  }

  // Default: Unlimited trial subscription
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

  try {
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: session.email,
      client_reference_id: session.id,
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_collection: "always",
      success_url: successUrl.includes("{CHECKOUT_SESSION_ID}")
        ? successUrl
        : `${successUrl}${successUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        userId: session.id,
        plan: "unlimited",
        product: "cocomms-unlimited",
        trial: "14d-3desks",
      },
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          userId: session.id,
          plan: "unlimited",
          trialDeskLimit: "3",
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

async function createMatchPassCheckout(opts: {
  session: { id: string; email: string; name?: string };
  body: Record<string, unknown>;
  plan: "match_pass" | "switch_to_pass";
  successUrl: string;
  cancelUrl: string;
  req: Request;
}) {
  const { session, body, plan, successUrl, cancelUrl } = opts;
  const credits = parseMatchPassCredits(body.credits);
  if (!credits) {
    return NextResponse.json(
      { error: "credits must be 1, 5, or 10" },
      { status: 400 }
    );
  }

  if (!process.env.STRIPE_SECRET_KEY?.trim() || !isMatchPassConfigured(credits)) {
    return NextResponse.json(
      {
        error: "Match Desk Pass not configured",
        todo: `Add STRIPE_SECRET_KEY and STRIPE_PRICE_PASS_${credits} to Netlify env for pitchline-app.`,
        status: stripePublicStatus(),
      },
      { status: 503 }
    );
  }

  const stripe = await getStripe();
  const priceId = matchPassPriceId(credits);
  if (!stripe || !priceId) {
    return NextResponse.json(
      { error: "Stripe SDK or Match Pass price missing", status: stripePublicStatus() },
      { status: 503 }
    );
  }

  const switchFromTrial = plan === "switch_to_pass";
  if (switchFromTrial) {
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        billingStatus: true,
        trialEndsAt: true,
        stripeSubscriptionId: true,
        stripeCustomerId: true,
      },
    });
    const now = Date.now();
    const inTrialWindow =
      user?.trialEndsAt != null && user.trialEndsAt.getTime() > now;
    const status = user?.billingStatus || "none";
    if (!inTrialWindow && status !== "trial") {
      // Still allow purchase as plain match_pass if they are mid-cancel window
      if (!(status === "cancelled" && inTrialWindow)) {
        // Soft warn but still sell the pack — webhook only cancels sub when switchFromTrial
      }
    }
    void user; // used for future customer reuse
  }

  const settingsSuccess =
    successUrl.includes("/settings")
      ? successUrl
      : `${getAppBaseUrl(opts.req)}/settings?billing=pass_success`;

  try {
    const userRow = await prisma.user.findUnique({
      where: { id: session.id },
      select: { stripeCustomerId: true },
    });

    const checkoutParams: Record<string, unknown> = {
      mode: "payment",
      client_reference_id: session.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: settingsSuccess.includes("{CHECKOUT_SESSION_ID}")
        ? settingsSuccess
        : `${settingsSuccess}${settingsSuccess.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl.includes("/settings")
        ? cancelUrl
        : `${getAppBaseUrl(opts.req)}/settings?billing=pass_cancel`,
      metadata: {
        userId: session.id,
        plan: "match_pass",
        credits: String(credits),
        product: "cocomms-match-pass",
        switchFromTrial: switchFromTrial ? "true" : "false",
      },
      payment_intent_data: {
        metadata: {
          userId: session.id,
          plan: "match_pass",
          credits: String(credits),
          switchFromTrial: switchFromTrial ? "true" : "false",
        },
      },
      allow_promotion_codes: true,
    };

    if (userRow?.stripeCustomerId) {
      checkoutParams.customer = userRow.stripeCustomerId;
    } else {
      checkoutParams.customer_email = session.email;
    }

    const checkout = await stripe.checkout.sessions.create(checkoutParams);

    if (!checkout.url) {
      return NextResponse.json({ error: "Checkout session missing URL" }, { status: 500 });
    }

    const copy = MATCH_PASS_COPY[credits as MatchPassCredits];
    return NextResponse.json({
      ok: true,
      url: checkout.url,
      sessionId: checkout.id,
      plan: switchFromTrial ? "switch_to_pass" : "match_pass",
      credits,
      price: copy.price,
      switchFromTrial,
    });
  } catch (e) {
    console.error("[billing/checkout match_pass]", e);
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
    matchPass: MATCH_PASS_COPY,
    message: isStripeConfigured()
      ? "POST default → Unlimited 14-day trial. POST { plan: match_pass|switch_to_pass, credits: 1|5|10 } → one-time Match Desk Pass."
      : "Stripe keys missing — Pricing UI still shows £22 Unlimited + Match Desk Pass copy.",
  });
}
