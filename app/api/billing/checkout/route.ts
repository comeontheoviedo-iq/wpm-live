import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  billingPublicStatus,
  getBillingProvider,
  isBillingConfigured,
  isMatchPassBillingConfigured,
} from "@/lib/billing";
import {
  getAppBaseUrl,
  getPolar,
  isMatchPassPolarConfigured,
  matchPassProductId,
  polarPublicStatus,
  unlimitedProductId,
} from "@/lib/polar";
import {
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
import {
  countryFromHeaders,
  currencyForCountry,
  FOUNDING_CODE,
  FOUNDING_DISCOUNT_ID,
  isFoundingOpen,
  normalizePromo,
} from "@/lib/region-pricing";

function promoFromRequest(req: Request, body: Record<string, unknown>): string | null {
  const fromBody = normalizePromo(body?.promo);
  if (fromBody) return fromBody;
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)cocomms_promo=([^;]+)/);
  return m ? normalizePromo(decodeURIComponent(m[1])) : null;
}

/**
 * POST /api/billing/checkout
 *
 * Choose-at-start:
 *   { plan: "unlimited" } — subscription + 14-day trial, card upfront
 *   { plan: "match_pass", credits: 1|5|10 } — one-time pack; webhook grants 14d/3-desk trial
 *
 * Provider: Polar when POLAR_ACCESS_TOKEN + product ids set; else Stripe; else 503.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const plan = String(body.plan || "").trim().toLowerCase();
  const base = getAppBaseUrl(req);
  const successUrl =
    String(body.successUrl || "").trim() || `${base}/settings?billing=success`;
  const cancelUrl =
    String(body.cancelUrl || "").trim() || `${base}/pricing?billing=cancel`;

  if (plan === "match_pass") {
    return createMatchPassCheckout({ session, body, successUrl, cancelUrl, req });
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

  const provider = getBillingProvider();
  if (provider === "polar") {
    return createPolarUnlimitedCheckout({
      session,
      successUrl,
      cancelUrl,
      req,
      promo: promoFromRequest(req, body),
    });
  }
  if (provider === "stripe") {
    return createStripeUnlimitedCheckout({ session, successUrl, cancelUrl });
  }

  return NextResponse.json(
    {
      error: "Billing not configured",
      todo: "Add POLAR_ACCESS_TOKEN + POLAR_PRODUCT_UNLIMITED (preferred) or STRIPE_SECRET_KEY + STRIPE_PRICE_UNLIMITED to Netlify env for pitchline-app. See docs/POLAR_BILLING.md.",
      status: billingPublicStatus(),
    },
    { status: 503 }
  );
}

async function createPolarUnlimitedCheckout(opts: {
  session: { id: string; email: string; name?: string };
  successUrl: string;
  cancelUrl: string;
  req: Request;
  promo?: string | null;
}) {
  const { session, successUrl, cancelUrl, req } = opts;
  const polar = await getPolar();
  const productId = unlimitedProductId();
  const currency = currencyForCountry(countryFromHeaders(req.headers));
  const foundingDiscountId =
    opts.promo === FOUNDING_CODE && isFoundingOpen() ? FOUNDING_DISCOUNT_ID : null;
  if (!polar || !productId) {
    return NextResponse.json(
      { error: "Polar SDK or Unlimited product missing", status: polarPublicStatus() },
      { status: 503 }
    );
  }

  const base = getAppBaseUrl(req);
  const success =
    successUrl.includes("{CHECKOUT_ID}") || successUrl.includes("checkout_id=")
      ? successUrl
      : `${successUrl}${successUrl.includes("?") ? "&" : "?"}checkout_id={CHECKOUT_ID}`;

  try {
    const userRow = await prisma.user.findUnique({
      where: { id: session.id },
      select: { polarCustomerId: true },
    });

    // Polar collects payment method on trial checkouts (card-upfront).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createBody: Record<string, any> = {
      products: [productId],
      successUrl: success,
      returnUrl: cancelUrl.startsWith("http") ? cancelUrl : `${base}/pricing?billing=cancel`,
      customerEmail: session.email,
      customerName: session.name || undefined,
      externalCustomerId: session.id,
      allowDiscountCodes: true,
      allowTrial: true,
      trialInterval: "day",
      trialIntervalCount: 14,
      metadata: {
        userId: session.id,
        plan: "unlimited",
        product: "cocomms-unlimited",
        trial: "14d-3desks",
      },
      customerMetadata: {
        userId: session.id,
        plan: "unlimited",
      },
      currency,
    };
    if (foundingDiscountId) {
      createBody.discountId = foundingDiscountId;
      createBody.metadata.promo = FOUNDING_CODE;
    }
    if (userRow?.polarCustomerId) {
      createBody.customerId = userRow.polarCustomerId;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let checkout: any;
    try {
      checkout = await polar.checkouts.create(createBody);
    } catch (e) {
      // Code exhausted / expired, or currency rejected: fall back to the plain GBP-default checkout.
      console.warn("[checkout] unlimited retry without promo/currency:", e instanceof Error ? e.message : e);
      delete createBody.discountId;
      delete createBody.currency;
      delete createBody.metadata.promo;
      checkout = await polar.checkouts.create(createBody);
    }
    if (!checkout?.url) {
      return NextResponse.json({ error: "Polar checkout missing URL" }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      provider: "polar",
      url: checkout.url,
      checkoutId: checkout.id,
      plan: "unlimited",
      price: "£22",
    });
  } catch (e) {
    console.error("[billing/checkout polar unlimited]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Checkout failed" },
      { status: 500 }
    );
  }
}

async function createStripeUnlimitedCheckout(opts: {
  session: { id: string; email: string; name?: string };
  successUrl: string;
  cancelUrl: string;
}) {
  const { session, successUrl, cancelUrl } = opts;
  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error: "Stripe not configured",
        todo: "Add STRIPE_SECRET_KEY and STRIPE_PRICE_UNLIMITED to Netlify env.",
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
      provider: "stripe",
      url: checkout.url,
      sessionId: checkout.id,
      plan: "unlimited",
      price: "£22",
    });
  } catch (e) {
    console.error("[billing/checkout stripe]", e);
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
  const { session, body, successUrl, cancelUrl, req } = opts;
  const credits = parseMatchPassCredits(body.credits);
  if (!credits) {
    return NextResponse.json({ error: "credits must be 1, 5, or 10" }, { status: 400 });
  }

  const provider = getBillingProvider();
  if (provider === "polar") {
    return createPolarMatchPassCheckout({ session, credits, successUrl, cancelUrl, req });
  }
  if (provider === "stripe") {
    return createStripeMatchPassCheckout({ session, credits, successUrl, cancelUrl, req });
  }

  return NextResponse.json(
    {
      error: "Match Desk Pass not configured",
      todo: `Add POLAR_PRODUCT_PASS_${credits} (preferred) or STRIPE_PRICE_PASS_${credits} to Netlify env. See docs/POLAR_BILLING.md.`,
      status: billingPublicStatus(),
    },
    { status: 503 }
  );
}

async function createPolarMatchPassCheckout(opts: {
  session: { id: string; email: string; name?: string };
  credits: MatchPassCredits;
  successUrl: string;
  cancelUrl: string;
  req: Request;
}) {
  const { session, credits, successUrl, cancelUrl, req } = opts;
  if (!isMatchPassPolarConfigured(credits)) {
    return NextResponse.json(
      {
        error: "Match Desk Pass not configured on Polar",
        todo: `Add POLAR_PRODUCT_PASS_${credits} to Netlify env.`,
        status: polarPublicStatus(),
      },
      { status: 503 }
    );
  }

  const polar = await getPolar();
  const productId = matchPassProductId(credits);
  if (!polar || !productId) {
    return NextResponse.json(
      { error: "Polar SDK or Match Pass product missing", status: polarPublicStatus() },
      { status: 503 }
    );
  }

  const settingsSuccess = successUrl.includes("/settings")
    ? successUrl
    : `${getAppBaseUrl(req)}/settings?billing=pass_success`;
  const success =
    settingsSuccess.includes("{CHECKOUT_ID}") || settingsSuccess.includes("checkout_id=")
      ? settingsSuccess
      : `${settingsSuccess}${settingsSuccess.includes("?") ? "&" : "?"}checkout_id={CHECKOUT_ID}`;

  try {
    const userRow = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        polarCustomerId: true,
        billingStatus: true,
        trialEndsAt: true,
        polarSubscriptionId: true,
        stripeSubscriptionId: true,
      },
    });

    const now = Date.now();
    const inTrialWindow =
      userRow?.trialEndsAt != null && userRow.trialEndsAt.getTime() > now;
    const status = userRow?.billingStatus || "none";
    const grantTrial =
      !inTrialWindow &&
      status !== "trial" &&
      status !== "active" &&
      !userRow?.polarSubscriptionId &&
      !userRow?.stripeSubscriptionId;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createBody: Record<string, any> = {
      products: [productId],
      successUrl: success,
      returnUrl: cancelUrl.includes("/settings")
        ? cancelUrl
        : `${getAppBaseUrl(req)}/settings?billing=pass_cancel`,
      customerEmail: session.email,
      customerName: session.name || undefined,
      externalCustomerId: session.id,
      allowDiscountCodes: true,
      allowTrial: false,
      metadata: {
        userId: session.id,
        plan: "match_pass",
        credits: String(credits),
        product: "cocomms-match-pass",
        trial: "14d-3desks",
        grantTrial: grantTrial ? "true" : "false",
      },
      customerMetadata: {
        userId: session.id,
        plan: "match_pass",
        credits: String(credits),
      },
    };
    if (userRow?.polarCustomerId) {
      createBody.customerId = userRow.polarCustomerId;
    }

    const checkout = await polar.checkouts.create(createBody);
    if (!checkout?.url) {
      return NextResponse.json({ error: "Polar checkout missing URL" }, { status: 500 });
    }
    const copy = MATCH_PASS_COPY[credits];
    return NextResponse.json({
      ok: true,
      provider: "polar",
      url: checkout.url,
      checkoutId: checkout.id,
      plan: "match_pass",
      credits,
      price: copy.price,
      grantTrial,
    });
  } catch (e) {
    console.error("[billing/checkout polar match_pass]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Checkout failed" },
      { status: 500 }
    );
  }
}

async function createStripeMatchPassCheckout(opts: {
  session: { id: string; email: string; name?: string };
  credits: MatchPassCredits;
  successUrl: string;
  cancelUrl: string;
  req: Request;
}) {
  const { session, credits, successUrl, cancelUrl, req } = opts;
  if (!process.env.STRIPE_SECRET_KEY?.trim() || !isMatchPassConfigured(credits)) {
    return NextResponse.json(
      {
        error: "Match Desk Pass not configured",
        todo: `Add STRIPE_SECRET_KEY and STRIPE_PRICE_PASS_${credits} to Netlify env.`,
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

  const settingsSuccess = successUrl.includes("/settings")
    ? successUrl
    : `${getAppBaseUrl(req)}/settings?billing=pass_success`;

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
        : `${getAppBaseUrl(req)}/settings?billing=pass_cancel`,
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

    const copy = MATCH_PASS_COPY[credits];
    return NextResponse.json({
      ok: true,
      provider: "stripe",
      url: checkout.url,
      sessionId: checkout.id,
      plan: "match_pass",
      credits,
      price: copy.price,
      grantTrial,
    });
  } catch (e) {
    console.error("[billing/checkout stripe match_pass]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Checkout failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const status = billingPublicStatus();
  return NextResponse.json({
    ...status,
    plan: "choose-at-start",
    unlimited: { plan: "unlimited", price: "£22" },
    matchPass: MATCH_PASS_COPY,
    message: isBillingConfigured()
      ? `Provider ${status.provider}: POST { plan: "unlimited" } → 14-day card-upfront trial then £22/mo. POST { plan: "match_pass", credits: 1|5|10 } → pay pack + same 14d/3-desk trial in-app.`
      : "Billing keys missing — Pricing UI still shows Unlimited + Match Desk Pass choose-at-start copy. Prefer Polar — see docs/POLAR_BILLING.md.",
    matchPassConfigured: isMatchPassBillingConfigured(),
  });
}
