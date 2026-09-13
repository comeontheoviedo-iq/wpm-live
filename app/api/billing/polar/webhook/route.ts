import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseMatchPassCredits, polarPublicStatus } from "@/lib/polar";
import { computeTrialWindow } from "@/lib/trial";

export const runtime = "nodejs";

/**
 * POST /api/billing/polar/webhook
 *
 * Polar MoR webhooks → unlock trial / Unlimited / Match Desk Pass on User.
 * Dashboard: https://www.cocomms.online/api/billing/polar/webhook
 * Events: order.paid, subscription.created|active|updated|canceled|revoked, checkout.updated
 *
 * Uses @polar-sh/nextjs Webhooks when POLAR_WEBHOOK_SECRET is set.
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

  if (Object.keys(data).length) {
    await prisma.user.update({ where: { id: userId }, data });
  }
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
    if (Object.keys(data).length) {
      await prisma.user.update({ where: { id: userId }, data });
    }
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

  if (Object.keys(data).length) {
    await prisma.user.update({ where: { id: userId }, data });
  }
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

  if (Object.keys(data).length) {
    await prisma.user.update({ where: { id: userId }, data });
  }
}

function buildWebhookHandler() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Webhooks } = require("@polar-sh/nextjs");
  const secret = process.env.POLAR_WEBHOOK_SECRET!.trim();

  return Webhooks({
    webhookSecret: secret,
    onPayload: async (payload: { type?: string }) => {
      console.log("[polar/webhook]", payload?.type || "unknown");
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onOrderPaid: async (payload: any) => {
      const order = payload?.data ?? payload;
      await applyOrderPaid({ order });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onCheckoutUpdated: async (payload: any) => {
      const checkout = payload?.data ?? payload;
      await applyCheckoutUpdated({ checkout });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSubscriptionCreated: async (payload: any) => {
      await applySubscription({
        subscription: payload?.data ?? payload,
        eventType: "subscription.created",
      });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSubscriptionActive: async (payload: any) => {
      await applySubscription({
        subscription: payload?.data ?? payload,
        eventType: "subscription.active",
      });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSubscriptionUpdated: async (payload: any) => {
      await applySubscription({
        subscription: payload?.data ?? payload,
        eventType: "subscription.updated",
      });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSubscriptionCanceled: async (payload: any) => {
      await applySubscription({
        subscription: payload?.data ?? payload,
        eventType: "subscription.canceled",
      });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSubscriptionRevoked: async (payload: any) => {
      await applySubscription({
        subscription: payload?.data ?? payload,
        eventType: "subscription.revoked",
      });
    },
  });
}

let handler: ((req: Request) => Promise<Response>) | null = null;

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

  try {
    if (!handler) handler = buildWebhookHandler();
    const h = handler;
    if (!h) {
      return NextResponse.json({ error: "Webhook handler unavailable" }, { status: 503 });
    }
    return await h(req);
  } catch (e) {
    console.error("[polar/webhook] handler error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Webhook handler failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const status = polarPublicStatus();
  return NextResponse.json({
    ok: true,
    endpoint: "/api/billing/polar/webhook",
    ...status,
  });
}
