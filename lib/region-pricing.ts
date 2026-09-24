/**
 * Regional presentment for CoComms Unlimited (Polar product carries GBP/USD/EUR prices).
 * UK and Crown Dependencies see GBP, eurozone sees EUR, everyone else USD.
 * FOUNDING50 (Polar discount, fixed per currency, 12 months, first 50, ends 31 Oct 2026).
 */

export type BillingCurrency = "gbp" | "usd" | "eur";

const GBP_COUNTRIES = new Set(["GB", "UK", "IM", "JE", "GG"]);
const EUR_COUNTRIES = new Set([
  "AT", "BE", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT", "LV", "LT",
  "LU", "MT", "NL", "PT", "SK", "SI", "ES", "AD", "MC", "SM", "VA", "ME", "XK",
]);

export const UNLIMITED_PRICE: Record<BillingCurrency, number> = { gbp: 22, usd: 29, eur: 25 };
export const FOUNDING_PRICE: Record<BillingCurrency, number> = { gbp: 15, usd: 19, eur: 17 };
export const CURRENCY_SYMBOL: Record<BillingCurrency, string> = { gbp: "£", usd: "$", eur: "€" };

export const FOUNDING_CODE = "FOUNDING50";
/** Polar discount id for FOUNDING50 (not a secret). Override via env if recreated. */
export const FOUNDING_DISCOUNT_ID =
  process.env.POLAR_DISCOUNT_FOUNDING50?.trim() || "b97feb0a-c49a-4c7a-a77f-8744981027c8";
/** Last moment the code is redeemable (Polar ends_at). */
export const FOUNDING_ENDS_AT = new Date("2026-10-31T23:59:59Z");

export function currencyForCountry(country: string | null | undefined): BillingCurrency {
  const cc = String(country || "").trim().toUpperCase();
  if (!cc) return "gbp";
  if (GBP_COUNTRIES.has(cc)) return "gbp";
  if (EUR_COUNTRIES.has(cc)) return "eur";
  return "usd";
}

/** Netlify sets x-country and x-nf-geo (base64 JSON) on function requests. */
export function countryFromHeaders(h: Headers): string | null {
  const direct = h.get("x-country") || h.get("x-vercel-ip-country") || h.get("cf-ipcountry");
  if (direct) return direct.trim().toUpperCase();
  const geo = h.get("x-nf-geo");
  if (geo) {
    try {
      const j = JSON.parse(Buffer.from(geo, "base64").toString("utf8"));
      const code = j?.country?.code;
      if (typeof code === "string" && code) return code.toUpperCase();
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function normalizePromo(raw: unknown): string | null {
  const s = String(raw ?? "").trim().toUpperCase();
  return /^[A-Z0-9]{3,64}$/.test(s) ? s : null;
}

export function isFoundingOpen(now: Date = new Date()): boolean {
  return now.getTime() <= FOUNDING_ENDS_AT.getTime();
}

export function formatMoney(currency: BillingCurrency, amount: number): string {
  return `${CURRENCY_SYMBOL[currency]}${amount}`;
}
