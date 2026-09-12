/**
 * CoComms / Pitchline plan entitlements.
 *
 * Commercial (launch): one paid plan — Unlimited (Basic) at £22/mo.
 * BYO Notebook is core. Intel is NOT a separate paid tier at launch.
 *
 * Internal Gemini gate (unchanged env): PITCHLINE_PLAN=base|intel + Settings
 * override — for Chris testing / soft AI features, not sold as Intel+.
 *
 * Stripe: Checkout/portal when STRIPE_* keys exist; otherwise app-side model only.
 */

import { isGeminiConfigured } from "./gemini";
import { isStripeConfigured, stripePublicStatus } from "./stripe";

type FsApi = {
  existsSync: (p: string) => boolean;
  mkdirSync: (p: string, o?: { recursive?: boolean }) => void;
  readFileSync: (p: string, e: string) => string;
  writeFileSync: (p: string, d: string, e: string) => void;
};
type PathApi = {
  dirname: (p: string) => string;
  join: (...p: string[]) => string;
};

function loadFs(): FsApi | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("fs") as FsApi;
  } catch {
    return null;
  }
}

function loadPath(): PathApi {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("path") as PathApi;
}


/** Internal feature gate for Gemini AI (not a commercial SKU). */
export type PitchlinePlan = "base" | "intel";

/** Commercial SKU shown on Pricing / Checkout. */
export type CommercialPlan = "unlimited";

const OVERRIDE_REL_PARTS = ["data", "plan-override.json"] as const;

function overridePath(): string {
  const path = loadPath();
  return path.join(process.cwd(), ...OVERRIDE_REL_PARTS);
}

export type PlanOverrideFile = {
  plan: PitchlinePlan;
  /** ISO timestamp when Chris flipped the Settings toggle */
  updatedAt?: string;
  note?: string;
};

export function getEnvPlan(): PitchlinePlan {
  const v = process.env.PITCHLINE_PLAN?.trim().toLowerCase();
  if (v === "intel") return "intel";
  return "base";
}

export function readPlanOverride(): PlanOverrideFile | null {
  try {
    const f = loadFs();
    if (!f) return null;
    const path = overridePath();
    if (!f.existsSync(path)) return null;
    const raw = f.readFileSync(path, "utf8");
    const json = JSON.parse(raw) as { plan?: string; updatedAt?: string; note?: string };
    if (json.plan === "intel" || json.plan === "base") {
      return {
        plan: json.plan,
        updatedAt: json.updatedAt,
        note: json.note,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function writePlanOverride(plan: PitchlinePlan, note?: string): PlanOverrideFile {
  const f = loadFs();
  const pathApi = loadPath();
  if (!f) {
    throw new Error("Plan override requires a Node.js filesystem (server only).");
  }
  const path = overridePath();
  f.mkdirSync(pathApi.dirname(path), { recursive: true });
  const payload: PlanOverrideFile = {
    plan,
    updatedAt: new Date().toISOString(),
    note:
      note ||
      "Local Settings toggle for AI lab features. Commercial plan is Unlimited £22 — Intel is not a paid tier.",
  };
  f.writeFileSync(path, JSON.stringify(payload, null, 2) + "\n", "utf8");
  return payload;
}

export function clearPlanOverride(): void {
  const f = loadFs();
  if (!f) return;
  const path = overridePath();
  if (!f.existsSync(path)) return;
  f.writeFileSync(
    path,
    JSON.stringify(
      {
        plan: null,
        clearedAt: new Date().toISOString(),
        note: "Override cleared — using plan env / default base.",
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
}

/** Effective Gemini gate: Settings override wins over env. */
export function getEffectivePlan(): PitchlinePlan {
  const override = readPlanOverride();
  if (override?.plan === "intel" || override?.plan === "base") {
    return override.plan;
  }
  return getEnvPlan();
}

export function hasIntel(): boolean {
  return getEffectivePlan() === "intel";
}

export function isBasePlan(): boolean {
  return getEffectivePlan() === "base";
}

/** Gemini key present AND Intel lab gate — required for paid AI features. */
export function canUseGeminiFeatures(): boolean {
  return hasIntel() && isGeminiConfigured();
}

export function canUseGeminiBrief(): boolean {
  return canUseGeminiFeatures();
}

export function canAutoGenPack(): boolean {
  return canUseGeminiFeatures();
}

export function canPlayerNoteDraft(): boolean {
  return canUseGeminiFeatures();
}

export function canGeminiRelevantRerank(): boolean {
  return canUseGeminiFeatures();
}

export const INTEL_REQUIRED_MESSAGE =
  "AI lab features require the Intel lab gate (Settings testing toggle or PITCHLINE_PLAN=intel) plus GEMINI_API_KEY. Commercial plan is Unlimited £22/mo — Intel is not sold separately.";

/** Launch commercial copy — single Unlimited / Basic at £22. */
export const PLAN_COPY = {
  unlimited: {
    name: "Unlimited",
    aka: "Basic",
    price: "£22",
    pricePence: 2200,
    interval: "month" as const,
    blurb: "Full matchday desk with BYO Notebook at the core. One simple plan.",
    includes: [
      "BYO Notebook / Research paste (core — no Gemini required)",
      "News RSS",
      "Live-feed sync",
      "Notes buckets + relevance heuristics",
      "OBS overlay, dossiers, Stats, Speaks, Print",
      "Unlimited match desks on your account",
    ],
  },
  /** @deprecated Not a paid tier at launch — kept for Settings lab copy only. */
  base: {
    name: "Unlimited",
    price: "£22",
    introPrice: "£22",
    blurb: "Matchday desk with your own research. BYO Notebook is core.",
    includes: [
      "BYO Notebook / Research paste (local organise — no Gemini)",
      "News RSS",
      "Live-feed sync",
      "Notes buckets + relevance heuristics",
      "OBS overlay, dossiers, Stats, Speaks, Print",
    ],
  },
  /** Lab-only — not shown as a Pricing tier. */
  intel: {
    name: "AI lab (not a paid tier)",
    price: "included later",
    absolutePrice: "£22",
    blurb: "Gemini brief / Auto Gen — gated for testing, not sold separately at launch.",
    includes: [
      "News Gemini web brief",
      "Auto Gen pack (pack-generate)",
      "Player note-draft",
      "Optional Gemini relevant re-rank",
    ],
    softCaps:
      "Soft caps (metering later): ~20 web briefs / mo · ~10 pack gens / mo.",
  },
  rivalCompare:
    "One plan: Unlimited (Basic) £22/mo. Compare to ~£35/mo rival desks — BYO Notebook is core; no separate Intel upsell at launch.",
} as const;

export function planStatus() {
  const envPlan = getEnvPlan();
  const override = readPlanOverride();
  const plan = getEffectivePlan();
  const geminiKey = isGeminiConfigured();
  const stripe = stripePublicStatus();
  return {
    plan,
    commercialPlan: "unlimited" as CommercialPlan,
    commercialName: PLAN_COPY.unlimited.name,
    commercialPrice: PLAN_COPY.unlimited.price,
    envPlan,
    override: override?.plan ?? null,
    overrideUpdatedAt: override?.updatedAt ?? null,
    hasIntel: plan === "intel",
    geminiKeyConfigured: geminiKey,
    canUseGeminiBrief: canUseGeminiBrief(),
    canAutoGenPack: canAutoGenPack(),
    canPlayerNoteDraft: canPlayerNoteDraft(),
    canGeminiRelevantRerank: canGeminiRelevantRerank(),
    copy: PLAN_COPY,
    stripe: stripe.configured
      ? `Stripe ${stripe.mode} — Checkout ready for Unlimited £22.`
      : "Stripe keys missing — app-side Unlimited £22 model live; TODO: add STRIPE_SECRET_KEY + price id in Netlify env.",
    stripeConfigured: stripe.configured,
    stripeMode: stripe.mode,
  };
}

export { isStripeConfigured };
