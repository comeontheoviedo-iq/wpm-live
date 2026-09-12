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
 * Choose-at-start:
 *   { plan: "unlimited" } — subscription Checkout, trial_period_days=14,
 *     payment_method_collection=always → converts to £22/mo unless cancelled.
 *   { plan: "match_pass", credits: 1|5|10 } — one-time payment for the pack;
 *     webhook grants the same 14d / 3-desk trial in-app + credits.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const plan = String(body.plan || "").trim().toLowerCase();
  const base = getAppBaseUrl(req);
  const successUrl =
    String(body.successUrl || "").trim() ||
    `${base}/settings?billing=success`;
  const cancelUrl =
    String(body.cancelUrl || "").trim() || `${base}/pricing?billing=cancel`;

  if (plan === "match_pass") {
    return createMatchPassCheckout({
      session,
      body,
      successUrl,
      cancelUrl,
      req,
    });
  }

  if (plan && plan !== "unlimited") {
    return NextResponse.json(
      {
        error: 'plan must be "unlimited" or "match_pass"',
        hint: 'Body: { plan: "unlimited" } or { plan: "match_pass", credits: 1|5|10 }',
      },
      { status: 400 }
    );
  }

  // Default / unlimited: Unlimited trial subscription
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
    const userRow = await prisma.user.findUnique({
      where: { id: session.id },
      select: { stripeCustomerId: true },
    });

    const checkoutParams: Record<string, unknown> = {
      mode: "subscription",
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
  successUrl: string;
  cancelUrl: string;
  req: Request;
}) {
  const { session, body, successUrl, cancelUrl } = opts;
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

  const settingsSuccess =
    successUrl.includes("/settings")
      ? successUrl
      : `${getAppBaseUrl(opts.req)}/settings?billing=pass_success`;

  try {
    const userRow = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        stripeCustomerId: true,
        billingStatus: true,
        trialEndsAt: true,
        stripeSubscriptionId: true,
      },
    });

    // Grant in-app 14d/3-desk trial on first Pass purchase (choose-at-start).
    // Top-ups while already trialing / active still add credits only.
    const now = Date.now();
    const inTrialWindow =
      userRow?.trialEndsAt != null && userRow.trialEndsAt.getTime() > now;
    const status = userRow?.billingStatus || "none";
    const grantTrial =
      !inTrialWindow && status !== "trial" && status !== "active";

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
        trial: "14d-3desks",
        grantTrial: grantTrial ? "true" : "false",
      },
      payment_intent_data: {
        metadata: {
          userId: session.id,
          plan: "match_pass",
          credits: String(credits),
          grantTrial: grantTrial ? "true" : "false",
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
      plan: "match_pass",
      credits,
      price: copy.price,
      grantTrial,
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
    plan: "choose-at-start",
    unlimited: { plan: "unlimited", price: "£22" },
    matchPass: MATCH_PASS_COPY,
    message: isStripeConfigured()
      ? 'POST { plan: "unlimited" } → 14-day card-upfront trial then £22/mo. POST { plan: "match_pass", credits: 1|5|10 } → pay pack + same 14d/3-desk trial in-app.'
      : "Stripe keys missing — Pricing UI still shows Unlimited + Match Desk Pass choose-at-start copy.",
  });
}
