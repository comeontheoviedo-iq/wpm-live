/**
 * Polar helpers for CoComms Unlimited (£22/mo) + Match Desk Pass packs.
 * Temporary MoR billing while Stripe is parked.
 *
 * Env (Netlify / .env) — never commit secrets:
 *   POLAR_ACCESS_TOKEN           org access token (polar_oat_…)
 *   POLAR_WEBHOOK_SECRET         webhook signing secret
 *   POLAR_SERVER                 production | sandbox (default production)
 *   POLAR_PRODUCT_UNLIMITED      product UUID — Unlimited £22/mo + 14d trial
 *   POLAR_PRODUCT_PASS_1         product UUID — Match Desk Pass 1 · £8
 *   POLAR_PRODUCT_PASS_5         product UUID — Match Desk Pass 5 · £25
 *   POLAR_PRODUCT_PASS_10        product UUID — Match Desk Pass 10 · £30
 *   NEXT_PUBLIC_APP_URL          https://www.cocomms.online
 *
 * See docs/POLAR_BILLING.md for Chris setup steps.
 */

import type { MatchPassCredits } from "./stripe";
import { MATCH_PASS_COPY, getAppBaseUrl, parseMatchPassCredits } from "./stripe";

export type { MatchPassCredits };
export { MATCH_PASS_COPY, getAppBaseUrl, parseMatchPassCredits };

export type PolarPublicStatus = {
  configured: boolean;
  server: "production" | "sandbox" | "unset";
  productUnlimitedConfigured: boolean;
  matchPassProductsConfigured: boolean;
  webhookSecretConfigured: boolean;
};

export function polarAccessToken(): string | null {
  return process.env.POLAR_ACCESS_TOKEN?.trim() || null;
}

export function polarServer(): "production" | "sandbox" {
  const raw = process.env.POLAR_SERVER?.trim().toLowerCase();
  return raw === "sandbox" ? "sandbox" : "production";
}

export function isPolarConfigured(): boolean {
  const token = polarAccessToken();
  const product = process.env.POLAR_PRODUCT_UNLIMITED?.trim();
  return Boolean(token && product);
}

export function polarPublicStatus(): PolarPublicStatus {
  const token = polarAccessToken();
  const product = process.env.POLAR_PRODUCT_UNLIMITED?.trim() || "";
  const passOk =
    Boolean(process.env.POLAR_PRODUCT_PASS_1?.trim()) &&
    Boolean(process.env.POLAR_PRODUCT_PASS_5?.trim()) &&
    Boolean(process.env.POLAR_PRODUCT_PASS_10?.trim());
  return {
    configured: Boolean(token && product),
    server: token ? polarServer() : "unset",
    productUnlimitedConfigured: Boolean(product),
    matchPassProductsConfigured: passOk,
    webhookSecretConfigured: Boolean(process.env.POLAR_WEBHOOK_SECRET?.trim()),
  };
}

export function unlimitedProductId(): string | null {
  return process.env.POLAR_PRODUCT_UNLIMITED?.trim() || null;
}

export function matchPassProductId(credits: MatchPassCredits): string | null {
  const map: Record<MatchPassCredits, string | undefined> = {
    1: process.env.POLAR_PRODUCT_PASS_1?.trim(),
    5: process.env.POLAR_PRODUCT_PASS_5?.trim(),
    10: process.env.POLAR_PRODUCT_PASS_10?.trim(),
  };
  return map[credits] || null;
}

export function isMatchPassPolarConfigured(credits?: MatchPassCredits): boolean {
  if (!polarAccessToken()) return false;
  if (credits != null) return Boolean(matchPassProductId(credits));
  return (
    Boolean(matchPassProductId(1)) &&
    Boolean(matchPassProductId(5)) &&
    Boolean(matchPassProductId(10))
  );
}

export function isPolarBillingFullyConfigured(): boolean {
  return isPolarConfigured() && isMatchPassPolarConfigured();
}

/** Loose Polar SDK surface (loaded dynamically). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PolarClient = any;

let cached: PolarClient | null | undefined;

/** Lazy-load @polar-sh/sdk only when token exists. */
export async function getPolar(): Promise<PolarClient | null> {
  const token = polarAccessToken();
  if (!token) return null;
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Polar } = require("@polar-sh/sdk");
    cached = new Polar({
      accessToken: token,
      server: polarServer(),
    });
    return cached;
  } catch (e) {
    console.warn(
      "[polar] SDK unavailable — npm install @polar-sh/sdk, or token missing:",
      e instanceof Error ? e.message : e
    );
    cached = null;
    return null;
  }
}

/** GBP amounts in minor units (pence) — mirrors Stripe livemode products. */
export const POLAR_PRODUCT_SPECS = {
  unlimited: {
    name: "CoComms Unlimited",
    description:
      "Full matchday desk — 14-day trial (card upfront), then £22/mo. Cancel anytime in the customer portal.",
    pricePence: 2200,
    recurring: true as const,
    trialDays: 14,
    metadata: { sku: "cocomms-unlimited", plan: "unlimited" },
  },
  pass_1: {
    name: "CoComms Match Desk Pass 1",
    description: "One match desk credit. Same 14-day / 3-desk trial granted in-app on first purchase.",
    pricePence: 800,
    recurring: false as const,
    credits: 1 as MatchPassCredits,
    metadata: { sku: "cocomms-match-pass", plan: "match_pass", credits: "1" },
  },
  pass_5: {
    name: "CoComms Match Desk Pass 5",
    description: "Five match desk credits. Same 14-day / 3-desk trial granted in-app on first purchase.",
    pricePence: 2500,
    recurring: false as const,
    credits: 5 as MatchPassCredits,
    metadata: { sku: "cocomms-match-pass", plan: "match_pass", credits: "5" },
  },
  pass_10: {
    name: "CoComms Match Desk Pass 10",
    description:
      "Ten match desk credits (floor pack — does not undercut Unlimited). Same 14-day / 3-desk trial in-app on first purchase.",
    pricePence: 3000,
    recurring: false as const,
    credits: 10 as MatchPassCredits,
    metadata: { sku: "cocomms-match-pass", plan: "match_pass", credits: "10" },
  },
} as const;
