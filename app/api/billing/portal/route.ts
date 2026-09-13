import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { billingPublicStatus, getBillingProvider } from "@/lib/billing";
import { getAppBaseUrl, getPolar, isPolarConfigured, polarPublicStatus } from "@/lib/polar";
import { getStripe, isStripeConfigured, stripePublicStatus } from "@/lib/stripe";

/**
 * POST /api/billing/portal — Polar Customer Portal when Polar configured;
 * else Stripe Customer Portal. Settings → Manage billing.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const base = getAppBaseUrl(req);
  const returnUrl = String(body.returnUrl || "").trim() || `${base}/settings`;
  const provider = getBillingProvider();

  if (provider === "polar") {
    return openPolarPortal({ session, returnUrl });
  }
  if (provider === "stripe") {
    return openStripePortal({ session, returnUrl });
  }

  return NextResponse.json(
    {
      error: "Billing not configured",
      todo: "Add POLAR_ACCESS_TOKEN + product ids (preferred) or Stripe keys. See docs/POLAR_BILLING.md.",
      status: billingPublicStatus(),
    },
    { status: 503 }
  );
}

async function openPolarPortal(opts: {
  session: { id: string; email: string; name?: string };
  returnUrl: string;
}) {
  const { session, returnUrl } = opts;
  if (!isPolarConfigured()) {
    return NextResponse.json(
      {
        error: "Polar not configured",
        todo: "Add POLAR_ACCESS_TOKEN + POLAR_PRODUCT_UNLIMITED in Netlify env.",
        status: polarPublicStatus(),
      },
      { status: 503 }
    );
  }

  const polar = await getPolar();
  if (!polar) {
    return NextResponse.json({ error: "Polar SDK unavailable" }, { status: 503 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { polarCustomerId: true },
    });

    // Prefer Polar customer id when we have it; else externalCustomerId = our User.id
    // (set on Checkout via externalCustomerId).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createBody: Record<string, any> = { returnUrl };
    if (user?.polarCustomerId) {
      createBody.customerId = user.polarCustomerId;
    } else {
      createBody.externalCustomerId = session.id;
    }

    let portalSession;
    try {
      portalSession = await polar.customerSessions.create(createBody);
    } catch (firstErr) {
      // No Polar customer yet — create one, then open portal
      const created = await polar.customers.create({
        email: session.email,
        name: session.name || undefined,
        externalId: session.id,
        metadata: { userId: session.id },
      });
      if (created?.id) {
        await prisma.user.update({
          where: { id: session.id },
          data: { polarCustomerId: created.id },
        });
        portalSession = await polar.customerSessions.create({
          customerId: created.id,
          returnUrl,
        });
      } else {
        throw firstErr;
      }
    }

    const url = portalSession?.customerPortalUrl || null;
    const customerId = portalSession?.customerId || user?.polarCustomerId || null;
    if (customerId && user && !user.polarCustomerId) {
      await prisma.user.update({
        where: { id: session.id },
        data: { polarCustomerId: customerId },
      });
    }
    if (!url) {
      return NextResponse.json(
        { error: "Polar portal session missing URL", returnUrl },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, provider: "polar", url });
  } catch (e) {
    console.error("[billing/portal polar]", e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Portal failed",
        hint: "Complete a Polar checkout first, or ensure the org token has customers + customer_sessions scopes. See docs/POLAR_BILLING.md.",
      },
      { status: 500 }
    );
  }
}

async function openStripePortal(opts: {
  session: { id: string; email: string; name?: string };
  returnUrl: string;
}) {
  const { session, returnUrl } = opts;
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

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { stripeCustomerId: true },
    });
    let customerId = user?.stripeCustomerId || null;
    if (!customerId) {
      const existing = await stripe.customers.list({
        email: session.email,
        limit: 1,
      });
      customerId = existing.data[0]?.id || null;
    }
    if (!customerId) {
      const created = await stripe.customers.create({
        email: session.email,
        name: session.name,
        metadata: { userId: session.id },
      });
      customerId = created.id;
    }
    if (customerId && user && !user.stripeCustomerId) {
      await prisma.user.update({
        where: { id: session.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return NextResponse.json({ ok: true, provider: "stripe", url: portal.url });
  } catch (e) {
    console.error("[billing/portal stripe]", e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Portal failed",
        hint: "Enable Customer Portal in Stripe Dashboard → Settings → Billing.",
      },
      { status: 500 }
    );
  }
}
