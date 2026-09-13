/**
 * Billing provider switch: Polar (primary when configured) → Stripe (parked) → none.
 * Keep Stripe code intact; Polar takes checkout/portal/webhook when POLAR_ACCESS_TOKEN + product ids set.
 */

import {
  isMatchPassConfigured as isStripeMatchPassConfigured,
  isStripeConfigured,
  stripePublicStatus,
  type MatchPassCredits,
  type StripePublicStatus,
} from "./stripe";
import {
  isMatchPassPolarConfigured,
  isPolarConfigured,
  polarPublicStatus,
  type PolarPublicStatus,
} from "./polar";

export type BillingProvider = "polar" | "stripe" | "none";

export function getBillingProvider(): BillingProvider {
  if (isPolarConfigured()) return "polar";
  if (isStripeConfigured()) return "stripe";
  return "none";
}

export function isBillingConfigured(): boolean {
  return getBillingProvider() !== "none";
}

export function isMatchPassBillingConfigured(credits?: MatchPassCredits): boolean {
  const provider = getBillingProvider();
  if (provider === "polar") return isMatchPassPolarConfigured(credits);
  if (provider === "stripe") return isStripeMatchPassConfigured(credits);
  return false;
}

export type BillingPublicStatus = {
  provider: BillingProvider;
  configured: boolean;
  polar: PolarPublicStatus;
  stripe: StripePublicStatus;
};

export function billingPublicStatus(): BillingPublicStatus {
  const provider = getBillingProvider();
  return {
    provider,
    configured: provider !== "none",
    polar: polarPublicStatus(),
    stripe: stripePublicStatus(),
  };
}
