import { NextResponse } from "next/server";
import {
  countryFromHeaders,
  currencyForCountry,
  CURRENCY_SYMBOL,
  FOUNDING_CODE,
  FOUNDING_PRICE,
  isFoundingOpen,
  UNLIMITED_PRICE,
} from "@/lib/region-pricing";

export const dynamic = "force-dynamic";

/** GET /api/billing/region — visitor's presentment currency + Unlimited/founding prices. */
export async function GET(req: Request) {
  const country = countryFromHeaders(req.headers);
  const currency = currencyForCountry(country);
  return NextResponse.json(
    {
      country,
      currency,
      symbol: CURRENCY_SYMBOL[currency],
      unlimited: UNLIMITED_PRICE[currency],
      founding: isFoundingOpen()
        ? { code: FOUNDING_CODE, price: FOUNDING_PRICE[currency], months: 12 }
        : null,
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
