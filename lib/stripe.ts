/**
 * Stripe helpers for CoComms Unlimited (£22/mo).
 * If keys are missing, callers should fall back to Pricing copy + TODO messaging.
 *
 * Env (Netlify / .env):
 *   STRIPE_SECRET_KEY          sk_test_… or sk_live_…
 *   STRIPE_PUBLISHABLE_KEY     pk_test_… or pk_live_… (optional for Checkout Session redirect)
 *   STRIPE_PRICE_UNLIMITED     price_… for £22/mo Unlimited (create in Stripe Dashboard)
 *   STRIPE_WEBHOOK_SECRET      whsec_… (optional until webhook live)
 *   NEXT_PUBLIC_APP_URL        https://www.cocomms.online (success/cancel URLs)
 */

export type StripePublicStatus = {
  configured: boolean;
  mode: "test" | "live" | "unset";
  priceUnlimitedConfigured: boolean;
  publishableKeyPresent: boolean;
};

export function isStripeConfigured(): boolean {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  const price = process.env.STRIPE_PRICE_UNLIMITED?.trim();
  return Boolean(secret && price);
}

export function stripePublicStatus(): StripePublicStatus {
  const secret = process.env.STRIPE_SECRET_KEY?.trim() || "";
  const price = process.env.STRIPE_PRICE_UNLIMITED?.trim() || "";
  const pk = process.env.STRIPE_PUBLISHABLE_KEY?.trim() || "";
  let mode: StripePublicStatus["mode"] = "unset";
  if (secret.startsWith("sk_live_")) mode = "live";
  else if (secret.startsWith("sk_test_") || secret) mode = "test";
  return {
    configured: Boolean(secret && price),
    mode: secret ? mode : "unset",
    priceUnlimitedConfigured: Boolean(price),
    publishableKeyPresent: Boolean(pk),
  };
}

export function getAppBaseUrl(req?: Request): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.URL?.trim() ||
    process.env.DEPLOY_PRIME_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (req) {
    try {
      const u = new URL(req.url);
      return `${u.protocol}//${u.host}`;
    } catch {
      /* fall through */
    }
  }
  return "http://localhost:3000";
}

type StripeClient = {
  checkout: {
    sessions: {
      create: (params: Record<string, unknown>) => Promise<{ id: string; url: string | null }>;
    };
  };
  billingPortal: {
    sessions: {
      create: (params: Record<string, unknown>) => Promise<{ url: string }>;
    };
  };
  customers: {
    list: (params: Record<string, unknown>) => Promise<{ data: { id: string }[] }>;
    create: (params: Record<string, unknown>) => Promise<{ id: string }>;
  };
};

let cached: StripeClient | null | undefined;

/** Lazy-load stripe SDK only when keys exist. Returns null if not configured / not installed. */
export async function getStripe(): Promise<StripeClient | null> {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) return null;
  if (cached !== undefined) return cached;
  try {
    // Dynamic import so builds without the package still typecheck if we add types loosely
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Stripe = require("stripe");
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      typescript: true,
    });
    cached = stripe as StripeClient;
    return cached;
  } catch (e) {
    console.warn(
      "[stripe] SDK unavailable — npm install stripe, or keys missing:",
      e instanceof Error ? e.message : e
    );
    cached = null;
    return null;
  }
}

export function unlimitedPriceId(): string | null {
  return process.env.STRIPE_PRICE_UNLIMITED?.trim() || null;
}
