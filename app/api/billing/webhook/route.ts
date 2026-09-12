import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe, parseMatchPassCredits, stripePublicStatus } from "@/lib/stripe";
import { computeTrialWindow } from "@/lib/trial";

export const runtime = "nodejs";

/**
 * POST /api/billing/webhook
 * Verifies Stripe signature when STRIPE_WEBHOOK_SECRET is set.
 * Events: checkout.session.completed, customer.subscription.updated|deleted
 *
 * - Unlimited subscription: persist stripe ids; trialing → trial; active → active
 * - Match Desk Pass payment: increment matchPassCredits; when grantTrial,
 *   open the same 14d / 3-desk trial window in-app (no Unlimited conversion)
 *
 * Dashboard setup:
 *   Endpoint → https://www.cocomms.online/api/billing/webhook
 *   Events above · set STRIPE_WEBHOOK_SECRET in Netlify env
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    const raw = await req.text().catch(() => "");
    console.warn(
      "[billing/webhook] STRIPE_WEBHOOK_SECRET not set — payload length",
      raw.length,
      stripePublicStatus()
    );
    return NextResponse.json({
      received: true,
      processed: false,
      todo: "Set STRIPE_WEBHOOK_SECRET and redeploy.",
    });
  }

  const stripe = await getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe SDK unavailable" }, { status: 503 });
  }

  const rawBody = await req.text();
  const sig =
    req.headers.get("stripe-signature") ||
    req.headers.get("Stripe-Signature") ||
    "";

  let event: {
    id: string;
    type: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { object: any };
  };
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (e) {
    console.error(
      "[billing/webhook] signature verify failed",
      e instanceof Error ? e.message : e
    );
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(stripe, event.data.object);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionChange(event.type, event.data.object);
        break;
      default:
        break;
    }
    return NextResponse.json({ received: true, processed: true, type: event.type });
  } catch (e) {
    console.error("[billing/webhook] handler error", event.type, e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Webhook handler failed" },
      { status: 500 }
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleCheckoutCompleted(stripe: any, session: any) {
  const meta = (session.metadata || {}) as Record<string, string>;
  const userId =
    meta.userId ||
    (typeof session.client_reference_id === "string"
      ? session.client_reference_id
      : null);
  if (!userId) {
    console.warn("[billing/webhook] checkout.session.completed missing userId");
    return;
  }

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id || null;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id || null;

  const mode = String(session.mode || "");
  const plan = String(meta.plan || "");
  const credits = parseMatchPassCredits(meta.credits);
  const grantTrialMeta = meta.grantTrial === "true";

  if (mode === "payment" && (plan === "match_pass" || credits != null)) {
    const add = credits ?? 0;
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        billingStatus: true,
        trialEndsAt: true,
        trialStartedAt: true,
        stripeSubscriptionId: true,
      },
    });

    const now = Date.now();
    const inTrialWindow =
      existing?.trialEndsAt != null && existing.trialEndsAt.getTime() > now;
    const status = existing?.billingStatus || "none";
    // Prefer Checkout metadata; also grant trial when user is not already on Unlimited path
    const shouldGrantTrial =
      grantTrialMeta ||
      (!inTrialWindow &&
        status !== "trial" &&
        status !== "active" &&
        !existing?.stripeSubscriptionId);

    const data: {
      stripeCustomerId?: string;
      matchPassCredits?: { increment: number };
      billingStatus?: string;
      trialStartedAt?: Date;
      trialEndsAt?: Date;
      trialCancelledAt?: Date | null;
      cancelAtPeriodEnd?: boolean;
    } = {};

    if (customerId) data.stripeCustomerId = customerId;
    if (add > 0) data.matchPassCredits = { increment: add };

    if (shouldGrantTrial) {
      const w = computeTrialWindow();
      data.billingStatus = "trial";
      data.trialStartedAt = w.trialStartedAt;
      data.trialEndsAt = w.trialEndsAt;
      data.trialCancelledAt = null;
      data.cancelAtPeriodEnd = false;
    }

    if (Object.keys(data).length) {
      await prisma.user.update({ where: { id: userId }, data });
    }
    return;
  }

  // Subscription / Unlimited trial Checkout
  const data: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    billingStatus?: string;
    trialStartedAt?: Date;
    trialEndsAt?: Date;
    trialCancelledAt?: Date | null;
    cancelAtPeriodEnd?: boolean;
  } = {};

  if (customerId) data.stripeCustomerId = customerId;
  if (subscriptionId) data.stripeSubscriptionId = subscriptionId;

  if (subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      if (typeof sub.cancel_at_period_end === "boolean") {
        data.cancelAtPeriodEnd = sub.cancel_at_period_end;
      }
      if (sub.status === "trialing") {
        data.billingStatus = "trial";
        if (sub.trial_end) {
          data.trialStartedAt = new Date((sub.trial_start || Date.now() / 1000) * 1000);
          data.trialEndsAt = new Date(sub.trial_end * 1000);
        } else {
          const w = computeTrialWindow();
          data.trialStartedAt = w.trialStartedAt;
          data.trialEndsAt = w.trialEndsAt;
        }
        data.trialCancelledAt = null;
      } else if (sub.status === "active") {
        data.billingStatus = "active";
        data.trialCancelledAt = null;
        data.cancelAtPeriodEnd = Boolean(sub.cancel_at_period_end);
      } else if (sub.status === "canceled" || sub.status === "unpaid") {
        data.billingStatus = "cancelled";
      }
    } catch (e) {
      console.warn(
        "[billing/webhook] subscription retrieve failed",
        e instanceof Error ? e.message : e
      );
      data.billingStatus = "trial";
      const w = computeTrialWindow();
      data.trialStartedAt = w.trialStartedAt;
      data.trialEndsAt = w.trialEndsAt;
      data.trialCancelledAt = null;
      data.cancelAtPeriodEnd = false;
    }
  } else if (mode === "subscription") {
    data.billingStatus = "trial";
    const w = computeTrialWindow();
    data.trialStartedAt = w.trialStartedAt;
    data.trialEndsAt = w.trialEndsAt;
  }

  if (Object.keys(data).length) {
    await prisma.user.update({ where: { id: userId }, data });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionChange(type: string, sub: any) {
  const meta = (sub.metadata || {}) as Record<string, string>;
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id || null;

  let user =
    (meta.userId
      ? await prisma.user.findUnique({ where: { id: meta.userId } })
      : null) ||
    (customerId
      ? await prisma.user.findFirst({ where: { stripeCustomerId: customerId } })
      : null) ||
    (sub.id
      ? await prisma.user.findFirst({ where: { stripeSubscriptionId: sub.id } })
      : null);

  if (!user) {
    console.warn("[billing/webhook] subscription event — no user for", sub.id);
    return;
  }

  const cancelAtPeriodEnd = Boolean(sub.cancel_at_period_end);
  let billingStatus = user.billingStatus;

  if (type === "customer.subscription.deleted" || sub.status === "canceled") {
    billingStatus = "cancelled";
    if (user.trialEndsAt && user.trialEndsAt.getTime() <= Date.now()) {
      billingStatus = "expired";
    }
  } else if (sub.status === "trialing") {
    // Unlimited trialing → trial; cancelled-at-period-end stays cancelled
    billingStatus = cancelAtPeriodEnd ? "cancelled" : "trial";
  } else if (sub.status === "active") {
    // Unlimited trialing → active conversion
    billingStatus = cancelAtPeriodEnd ? "cancelled" : "active";
  } else if (
    sub.status === "unpaid" ||
    sub.status === "past_due" ||
    sub.status === "incomplete_expired"
  ) {
    billingStatus = "expired";
  }

  const data: {
    billingStatus: string;
    cancelAtPeriodEnd: boolean;
    stripeSubscriptionId: string | null;
    stripeCustomerId?: string;
    trialCancelledAt?: Date | null;
    trialEndsAt?: Date;
    trialStartedAt?: Date;
  } = {
    billingStatus,
    cancelAtPeriodEnd,
    stripeSubscriptionId:
      type === "customer.subscription.deleted" ? null : sub.id || user.stripeSubscriptionId,
  };

  if (customerId) data.stripeCustomerId = customerId;

  if (cancelAtPeriodEnd && !user.trialCancelledAt) {
    data.trialCancelledAt = new Date();
  }
  if (!cancelAtPeriodEnd && billingStatus === "trial") {
    data.trialCancelledAt = null;
  }

  if (sub.status === "trialing" && sub.trial_end) {
    data.trialEndsAt = new Date(sub.trial_end * 1000);
    if (sub.trial_start) data.trialStartedAt = new Date(sub.trial_start * 1000);
  }

  await prisma.user.update({ where: { id: user.id }, data });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    webhookSecretConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()),
    ...stripePublicStatus(),
  });
}
