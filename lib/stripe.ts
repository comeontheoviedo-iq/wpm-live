/**
 * Stripe helpers for CoComms Unlimited (£22/mo) + Match Desk Pass packs.
 * Choose-at-start: Unlimited OR Match Desk Pass (1/5/10) before Checkout.
 * If keys are missing, callers should fall back to Pricing copy + TODO messaging.
 *
 * Env (Netlify / .env):
 *   STRIPE_SECRET_KEY          sk_test_… or sk_live_… (from Stripe Dashboard — never commit)
 *   STRIPE_PUBLISHABLE_KEY     pk_test_… or pk_live_… (optional for Checkout Session redirect)
 *   STRIPE_PRICE_UNLIMITED     price_1UEqHNDxFzIII5bI65Xe2X2k  (Unlimited £22/mo livemode)
 *   STRIPE_PRICE_PASS_1        price_1UEqHxDxFzIII5bIREWbhi3G  (£8 · 1 credit)
 *   STRIPE_PRICE_PASS_5        price_1UEqHyDxFzIII5bI10zezbCw  (£25 · 5 credits)
 *   STRIPE_PRICE_PASS_10       price_1UEqHzDxFzIII5bIOotem2LF (£30 · 10 credits)
 *   STRIPE_WEBHOOK_SECRET      whsec_… (optional until webhook live)
 *   NEXT_PUBLIC_APP_URL        https://www.cocomms.online (success/cancel URLs)
 */

export type MatchPassCredits = 1 | 5 | 10;

export const MATCH_PASS_CREDIT_OPTIONS: MatchPassCredits[] = [1, 5, 10];

export const MATCH_PASS_COPY: Record<
  MatchPassCredits,
  { label: string; price: string; blurb: string }
> = {
  1: { label: "1 Match Desk Pass", price: "£8", blurb: "One match desk credit." },
  5: { label: "5 Match Desk Pass", price: "£25", blurb: "Five match desk credits." },
  10: { label: "10 Match Desk Pass", price: "£30", blurb: "Ten match desk credits." },
};

/** Checkout body: choose Unlimited or a Match Desk Pass pack at trial start. */
export type CheckoutPlanBody =
  | { plan: "unlimited" }
  | { plan: "match_pass"; credits: MatchPassCredits };

export type StripePublicStatus = {
  configured: boolean;
  mode: "test" | "live" | "unset";
  priceUnlimitedConfigured: boolean;
  matchPassPricesConfigured: boolean;
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
  const passOk =
    Boolean(process.env.STRIPE_PRICE_PASS_1?.trim()) &&
    Boolean(process.env.STRIPE_PRICE_PASS_5?.trim()) &&
    Boolean(process.env.STRIPE_PRICE_PASS_10?.trim());
  let mode: StripePublicStatus["mode"] = "unset";
  if (secret.startsWith("sk_live_")) mode = "live";
  else if (secret.startsWith("sk_test_") || secret) mode = "test";
  return {
    configured: Boolean(secret && price),
    mode: secret ? mode : "unset",
    priceUnlimitedConfigured: Boolean(price),
    matchPassPricesConfigured: passOk,
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

/** Loose Stripe surface used by billing routes (SDK loaded dynamically). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type StripeClient = any;

let cached: StripeClient | null | undefined;

/** Lazy-load stripe SDK only when keys exist. Returns null if not configured / not installed. */
export async function getStripe(): Promise<StripeClient | null> {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) return null;
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Stripe = require("stripe");
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      typescript: true,
    });
    cached = stripe;
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

export function parseMatchPassCredits(raw: unknown): MatchPassCredits | null {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
  if (n === 1 || n === 5 || n === 10) return n;
  return null;
}

/** Resolve Match Desk Pass one-time price id for 1 | 5 | 10 credits. */
export function matchPassPriceId(credits: MatchPassCredits): string | null {
  const map: Record<MatchPassCredits, string | undefined> = {
    1: process.env.STRIPE_PRICE_PASS_1?.trim(),
    5: process.env.STRIPE_PRICE_PASS_5?.trim(),
    10: process.env.STRIPE_PRICE_PASS_10?.trim(),
  };
  return map[credits] || null;
}

export function isMatchPassConfigured(credits?: MatchPassCredits): boolean {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) return false;
  if (credits != null) return Boolean(matchPassPriceId(credits));
  return (
    Boolean(matchPassPriceId(1)) &&
    Boolean(matchPassPriceId(5)) &&
    Boolean(matchPassPriceId(10))
  );
}

/** True when secret + Unlimited price + all three pass prices are set. */
export function isBillingFullyConfigured(): boolean {
  return isStripeConfigured() && isMatchPassConfigured();
}
