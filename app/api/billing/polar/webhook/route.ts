import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseMatchPassCredits, polarPublicStatus } from "@/lib/polar";
import { computeTrialWindow } from "@/lib/trial";
import {
  isAlreadyOnLiveTrial,
  maybeSendTrialWelcomeEmail,
  type WelcomePlanHint,
} from "@/lib/welcome-email";

export const runtime = "nodejs";

/**
 * POST /api/billing/polar/webhook
 *
 * Polar MoR webhooks → unlock trial / Unlimited / Match Desk Pass on User.
 * Dashboard: https://www.cocomms.online/api/billing/polar/webhook
 * Events: order.paid, subscription.created|active|updated|canceled|revoked, checkout.updated
 *
 * Verifies with Standard Webhooks (whsec_) + legacy Polar encoding fallback.
 */

type Meta = Record<string, string | number | boolean | undefined | null>;

function metaString(meta: Meta | undefined | null, key: string): string {
  const v = meta?.[key];
  if (v == null) return "";
  return String(v);
}

function asMeta(raw: unknown): Meta {
  if (raw && typeof raw === "object") return raw as Meta;
  return {};
}


/** Persist User billing update, then send welcome once on first trial unlock. */
async function updateUserBillingAndMaybeWelcome(opts: {
  userId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
  plan?: WelcomePlanHint;
}) {
  if (!Object.keys(opts.data).length) return;

  const existing = await prisma.user.findUnique({
    where: { id: opts.userId },
    select: {
      billingStatus: true,
      trialEndsAt: true,
      welcomeEmailSentAt: true,
    },
  });
  if (!existing) return;

  const alreadyLive = isAlreadyOnLiveTrial(existing);
  const unlockingTrial =
    opts.data.billingStatus === "trial" && !alreadyLive;

  await prisma.user.update({ where: { id: opts.userId }, data: opts.data });

  if (unlockingTrial) {
    await maybeSendTrialWelcomeEmail({
      userId: opts.userId,
      unlockingTrial: true,
      plan: opts.plan ?? null,
    });
  }
}


async function resolveUserId(opts: {
  metadata?: Meta | null;
  externalCustomerId?: string | null;
  customerId?: string | null;
  customerExternalId?: string | null;
}): Promise<string | null> {
  const fromMeta = metaString(opts.metadata, "userId");
  if (fromMeta) return fromMeta;
  const external =
    opts.externalCustomerId ||
    opts.customerExternalId ||
    metaString(opts.metadata, "external_customer_id");
  if (external) return external;

  if (opts.customerId) {
    const byPolar = await prisma.user.findFirst({
      where: { polarCustomerId: opts.customerId },
      select: { id: true },
    });
    if (byPolar) return byPolar.id;
  }
  return null;
}

async function applySubscription(opts: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subscription: any;
  eventType: string;
}) {
  const sub = opts.subscription;
  const meta = asMeta(sub.metadata);
  const customerId =
    typeof sub.customerId === "string"
      ? sub.customerId
      : typeof sub.customer_id === "string"
        ? sub.customer_id
        : typeof sub.customer === "string"
          ? sub.customer
          : sub.customer?.id || null;
  const externalCustomerId =
    sub.customer?.externalId ||
    sub.customer?.external_id ||
    sub.externalCustomerId ||
    sub.external_customer_id ||
    null;

  const userId = await resolveUserId({
    metadata: meta,
    customerId,
    externalCustomerId,
  });
  if (!userId) {
    console.warn("[polar/webhook] subscription — no user for", sub.id);
    return;
  }

  const status = String(sub.status || "");
  const cancelAtPeriodEnd = Boolean(
    sub.cancelAtPeriodEnd ?? sub.cancel_at_period_end ?? false
  );

  let billingStatus: string | undefined;
  if (
    opts.eventType.includes("revoked") ||
    status === "canceled" ||
    status === "unpaid"
  ) {
    billingStatus = "cancelled";
  } else if (status === "trialing") {
    billingStatus = cancelAtPeriodEnd ? "cancelled" : "trial";
  } else if (status === "active") {
    billingStatus = cancelAtPeriodEnd ? "cancelled" : "active";
  } else if (status === "past_due") {
    billingStatus = "expired";
  } else if (opts.eventType.includes("canceled")) {
    billingStatus = "cancelled";
  }

  const data: {
    polarCustomerId?: string;
    polarSubscriptionId?: string | null;
    billingStatus?: string;
    trialStartedAt?: Date;
    trialEndsAt?: Date;
    trialCancelledAt?: Date | null;
    cancelAtPeriodEnd?: boolean;
  } = {};

  if (customerId) data.polarCustomerId = customerId;
  if (opts.eventType.includes("revoked")) {
    data.polarSubscriptionId = null;
  } else if (sub.id) {
    data.polarSubscriptionId = sub.id;
  }

  if (typeof cancelAtPeriodEnd === "boolean") {
    data.cancelAtPeriodEnd = cancelAtPeriodEnd;
  }
  if (billingStatus) data.billingStatus = billingStatus;

  const trialEnd = sub.trialEnd || sub.trial_end;
  const trialStart = sub.trialStart || sub.trial_start;
  if (status === "trialing" || (trialEnd && billingStatus === "trial")) {
    if (!data.billingStatus) data.billingStatus = "trial";
    if (trialEnd) {
      data.trialEndsAt = new Date(trialEnd);
      data.trialStartedAt = trialStart
        ? new Date(trialStart)
        : computeTrialWindow().trialStartedAt;
    } else {
      const w = computeTrialWindow();
      data.trialStartedAt = w.trialStartedAt;
      data.trialEndsAt = w.trialEndsAt;
    }
    if (!cancelAtPeriodEnd) data.trialCancelledAt = null;
  }

  if (cancelAtPeriodEnd && billingStatus === "cancelled") {
    data.trialCancelledAt = new Date();
  }

  await updateUserBillingAndMaybeWelcome({
    userId,
    data,
    plan: "unlimited",
  });
}

async function applyOrderPaid(opts: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  order: any;
}) {
  const order = opts.order;
  const meta = asMeta(order.metadata);
  const customerId =
    typeof order.customerId === "string"
      ? order.customerId
      : typeof order.customer_id === "string"
        ? order.customer_id
        : order.customer?.id || null;
  const externalCustomerId =
    order.customer?.externalId ||
    order.customer?.external_id ||
    order.externalCustomerId ||
    null;

  const userId = await resolveUserId({
    metadata: meta,
    customerId,
    externalCustomerId,
  });
  if (!userId) {
    console.warn("[polar/webhook] order.paid — no userId");
    return;
  }

  const plan = metaString(meta, "plan");
  const credits = parseMatchPassCredits(meta.credits);
  const grantTrialMeta = metaString(meta, "grantTrial") === "true";
  const subscriptionId =
    typeof order.subscriptionId === "string"
      ? order.subscriptionId
      : typeof order.subscription_id === "string"
        ? order.subscription_id
        : order.subscription?.id || null;

  // One-time Match Desk Pass
  if (plan === "match_pass" || (credits != null && !subscriptionId)) {
    const add = credits ?? 0;
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        billingStatus: true,
        trialEndsAt: true,
        polarSubscriptionId: true,
        stripeSubscriptionId: true,
      },
    });
    const now = Date.now();
    const inTrialWindow =
      existing?.trialEndsAt != null && existing.trialEndsAt.getTime() > now;
    const status = existing?.billingStatus || "none";
    const shouldGrantTrial =
      grantTrialMeta ||
      (!inTrialWindow &&
        status !== "trial" &&
        status !== "active" &&
        !existing?.polarSubscriptionId &&
        !existing?.stripeSubscriptionId);

    const data: {
      polarCustomerId?: string;
      matchPassCredits?: { increment: number };
      billingStatus?: string;
      trialStartedAt?: Date;
      trialEndsAt?: Date;
      trialCancelledAt?: Date | null;
      cancelAtPeriodEnd?: boolean;
    } = {};

    if (customerId) data.polarCustomerId = customerId;
    if (add > 0) data.matchPassCredits = { increment: add };
    if (shouldGrantTrial) {
      const w = computeTrialWindow();
      data.billingStatus = "trial";
      data.trialStartedAt = w.trialStartedAt;
      data.trialEndsAt = w.trialEndsAt;
      data.trialCancelledAt = null;
      data.cancelAtPeriodEnd = false;
    }
    await updateUserBillingAndMaybeWelcome({
      userId,
      data,
      plan: "match_pass",
    });
    return;
  }

  // Subscription-related order (Unlimited trial start / renewal)
  const data: {
    polarCustomerId?: string;
    polarSubscriptionId?: string;
    billingStatus?: string;
    trialStartedAt?: Date;
    trialEndsAt?: Date;
    trialCancelledAt?: Date | null;
    cancelAtPeriodEnd?: boolean;
  } = {};
  if (customerId) data.polarCustomerId = customerId;
  if (subscriptionId) data.polarSubscriptionId = subscriptionId;

  if (plan === "unlimited" || subscriptionId) {
    // Prefer trial window until subscription.active webhook confirms conversion
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { billingStatus: true },
    });
    if (existing?.billingStatus !== "active") {
      data.billingStatus = "trial";
      const w = computeTrialWindow();
      data.trialStartedAt = w.trialStartedAt;
      data.trialEndsAt = w.trialEndsAt;
      data.trialCancelledAt = null;
      data.cancelAtPeriodEnd = false;
    }
  }

  await updateUserBillingAndMaybeWelcome({
    userId,
    data,
    plan: "unlimited",
  });
}

async function applyCheckoutUpdated(opts: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  checkout: any;
}) {
  const checkout = opts.checkout;
  if (String(checkout.status || "") !== "succeeded") return;

  const meta = asMeta(checkout.metadata);
  const customerId =
    typeof checkout.customerId === "string"
      ? checkout.customerId
      : typeof checkout.customer_id === "string"
        ? checkout.customer_id
        : checkout.customer?.id || null;
  const externalCustomerId =
    checkout.externalCustomerId ||
    checkout.external_customer_id ||
    checkout.customer?.externalId ||
    null;
  const userId = await resolveUserId({
    metadata: meta,
    customerId,
    externalCustomerId,
  });
  if (!userId) return;

  const data: {
    polarCustomerId?: string;
    polarSubscriptionId?: string;
    billingStatus?: string;
    trialStartedAt?: Date;
    trialEndsAt?: Date;
    trialCancelledAt?: Date | null;
    cancelAtPeriodEnd?: boolean;
    matchPassCredits?: { increment: number };
  } = {};

  if (customerId) data.polarCustomerId = customerId;
  const subscriptionId =
    checkout.subscriptionId || checkout.subscription_id || checkout.subscription?.id;
  if (subscriptionId) data.polarSubscriptionId = subscriptionId;

  const plan = metaString(meta, "plan");
  const credits = parseMatchPassCredits(meta.credits);
  const grantTrial = metaString(meta, "grantTrial") === "true";

  if (plan === "match_pass" || (credits != null && !subscriptionId)) {
    if (credits) data.matchPassCredits = { increment: credits };
    if (grantTrial) {
      const w = computeTrialWindow();
      data.billingStatus = "trial";
      data.trialStartedAt = w.trialStartedAt;
      data.trialEndsAt = w.trialEndsAt;
      data.trialCancelledAt = null;
      data.cancelAtPeriodEnd = false;
    }
  } else if (plan === "unlimited" || subscriptionId) {
    data.billingStatus = "trial";
    const w = computeTrialWindow();
    data.trialStartedAt = w.trialStartedAt;
    data.trialEndsAt = w.trialEndsAt;
    data.trialCancelledAt = null;
    data.cancelAtPeriodEnd = false;
  }

  const planHint: WelcomePlanHint =
    plan === "match_pass" || (credits != null && !subscriptionId)
      ? "match_pass"
      : plan === "unlimited" || subscriptionId
        ? "unlimited"
        : null;

  await updateUserBillingAndMaybeWelcome({
    userId,
    data,
    plan: planHint,
  });
}

/**
 * Verify Polar webhook signatures.
 *
 * Polar endpoints created after 2026-09-08 sign with Standard Webhooks
 * (`whsec_…` key derivation). Older endpoints / @polar-sh/sdk validateEvent
 * instead HMAC with UTF-8 bytes of the full secret string (via base64 round-trip).
 * Try Standard Webhooks first, then the legacy Polar encoding so both work.
 */
function verifyPolarWebhook(
  body: string,
  headers: {
    "webhook-id": string;
    "webhook-timestamp": string;
    "webhook-signature": string;
  },
  secret: string
): { type?: string; data?: unknown } {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Webhook } = require("standardwebhooks") as {
    Webhook: new (secret: string) => {
      verify: (
        payload: string,
        headers: Record<string, string>
      ) => { type?: string; data?: unknown };
    };
  };

  const hdrs = {
    "webhook-id": headers["webhook-id"],
    "webhook-timestamp": headers["webhook-timestamp"],
    "webhook-signature": headers["webhook-signature"],
  };

  // 1) Spec-compliant Standard Webhooks (current Polar signing for new secrets)
  try {
    return new Webhook(secret).verify(body, hdrs) as {
      type?: string;
      data?: unknown;
    };
  } catch (stdErr) {
    // 2) Legacy Polar SDK encoding: base64(utf8(secret))
    try {
      const legacyKey = Buffer.from(secret, "utf-8").toString("base64");
      return new Webhook(legacyKey).verify(body, hdrs) as {
        type?: string;
        data?: unknown;
      };
    } catch {
      throw stdErr;
    }
  }
}

async function dispatchPolarEvent(payload: {
  type?: string;
  data?: unknown;
}): Promise<void> {
  const type = String(payload?.type || "");
  console.log("[polar/webhook]", type || "unknown");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = payload?.data ?? payload;

  switch (type) {
    case "order.paid":
      await applyOrderPaid({ order: data });
      return;
    case "checkout.updated":
      await applyCheckoutUpdated({ checkout: data });
      return;
    case "subscription.created":
    case "subscription.active":
    case "subscription.updated":
    case "subscription.canceled":
    case "subscription.revoked":
      await applySubscription({ subscription: data, eventType: type });
      return;
    default:
      // Acknowledge unhandled types so Polar does not retry-disable the endpoint.
      console.log("[polar/webhook] ignored event type", type || "(empty)");
  }
}

export async function POST(req: Request) {
  const secret = process.env.POLAR_WEBHOOK_SECRET?.trim();
  if (!secret) {
    const raw = await req.text().catch(() => "");
    console.warn(
      "[polar/webhook] POLAR_WEBHOOK_SECRET not set — payload length",
      raw.length,
      polarPublicStatus()
    );
    return NextResponse.json({
      received: true,
      processed: false,
      todo: "Set POLAR_WEBHOOK_SECRET and redeploy. See docs/POLAR_BILLING.md.",
    });
  }

  const body = await req.text();
  const webhookHeaders = {
    "webhook-id": req.headers.get("webhook-id") ?? "",
    "webhook-timestamp": req.headers.get("webhook-timestamp") ?? "",
    "webhook-signature": req.headers.get("webhook-signature") ?? "",
  };

  let payload: { type?: string; data?: unknown };
  try {
    payload = verifyPolarWebhook(body, webhookHeaders, secret);
  } catch (e) {
    console.warn(
      "[polar/webhook] signature verification failed",
      e instanceof Error ? e.message : e
    );
    return NextResponse.json({ received: false }, { status: 403 });
  }

  // Prefer 2xx after durable work. Never 500-loop on poison/handler errors —
  // Polar auto-disables after consecutive non-2xx.
  try {
    await dispatchPolarEvent(payload);
  } catch (e) {
    console.error(
      "[polar/webhook] handler error (ack 200 to avoid disable loop)",
      payload?.type,
      e
    );
  }

  return NextResponse.json({ received: true });
}

export async function GET() {
  const status = polarPublicStatus();
  return NextResponse.json({
    ok: true,
    endpoint: "/api/billing/polar/webhook",
    ...status,
  });
}
