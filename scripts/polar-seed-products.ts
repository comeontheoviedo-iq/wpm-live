/**
 * Create CoComms Polar products when POLAR_ACCESS_TOKEN is present.
 * Usage: npx tsx scripts/polar-seed-products.ts
 * Prints product UUIDs for Netlify env. Does not invent secrets.
 */
import { Polar } from "@polar-sh/sdk";
import { POLAR_PRODUCT_SPECS } from "../lib/polar";

async function main() {
  const token = process.env.POLAR_ACCESS_TOKEN?.trim();
  if (!token) {
    console.error(
      "POLAR_ACCESS_TOKEN missing.\nChris must create an org access token at polar.sh, then:\n  POLAR_ACCESS_TOKEN=polar_oat_… npx tsx scripts/polar-seed-products.ts\nSee docs/POLAR_BILLING.md."
    );
    process.exit(1);
  }

  const server =
    process.env.POLAR_SERVER?.trim().toLowerCase() === "sandbox"
      ? "sandbox"
      : "production";

  const polar = new Polar({ accessToken: token, server });

  const created: Record<string, string> = {};

  // Unlimited subscription
  {
    const spec = POLAR_PRODUCT_SPECS.unlimited;
    const product = await polar.products.create({
      name: spec.name,
      description: spec.description,
      recurringInterval: "month",
      recurringIntervalCount: 1,
      trialInterval: "day",
      trialIntervalCount: spec.trialDays,
      prices: [
        {
          amountType: "fixed",
          priceAmount: spec.pricePence,
          priceCurrency: "gbp",
        },
      ],
      metadata: { ...spec.metadata },
    });
    created.POLAR_PRODUCT_UNLIMITED = product.id;
    console.log("Unlimited:", product.id, `(£${(spec.pricePence / 100).toFixed(2)}/mo · ${spec.trialDays}d trial)`);
  }

  for (const key of ["pass_1", "pass_5", "pass_10"] as const) {
    const spec = POLAR_PRODUCT_SPECS[key];
    const product = await polar.products.create({
      name: spec.name,
      description: spec.description,
      prices: [
        {
          amountType: "fixed",
          priceAmount: spec.pricePence,
          priceCurrency: "gbp",
        },
      ],
      metadata: { ...spec.metadata },
    });
    const envKey =
      key === "pass_1"
        ? "POLAR_PRODUCT_PASS_1"
        : key === "pass_5"
          ? "POLAR_PRODUCT_PASS_5"
          : "POLAR_PRODUCT_PASS_10";
    created[envKey] = product.id;
    console.log(`${spec.name}:`, product.id, `(£${(spec.pricePence / 100).toFixed(2)})`);
  }

  console.log("\nPaste into Netlify pitchline-app env:\n");
  for (const [k, v] of Object.entries(created)) {
    console.log(`${k}=${v}`);
  }
  console.log("\nAlso set POLAR_ACCESS_TOKEN, POLAR_WEBHOOK_SECRET, POLAR_SERVER, NEXT_PUBLIC_APP_URL.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
