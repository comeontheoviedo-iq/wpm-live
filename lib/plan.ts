/**
 * Pitchline plan entitlements.
 * Base (Matchday): BYO research, RSS news, AF sync, heuristics, OBS, dossiers, Stats.
 * Intel add-on: Gemini web brief, Auto Gen packs, player note-draft, optional re-rank.
 *
 * Resolution: Settings/API override file → PITCHLINE_PLAN env → default "base".
 * Stripe billing comes later; override is for Chris testing only.
 */

import { isGeminiConfigured } from "./gemini";

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


export type PitchlinePlan = "base" | "intel";

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
      "Local Settings toggle for testing. Stripe billing not wired yet.",
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
        note: "Override cleared — using PITCHLINE_PLAN env / default base.",
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
}

/** Effective plan: Settings override wins over env. */
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

/** Gemini key present AND Intel plan — required for paid AI features. */
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
  "Intel add-on required. Base includes BYO Notebook / RSS only — enable Intel in Settings (testing) or set PITCHLINE_PLAN=intel. Stripe billing comes later.";

export const PLAN_COPY = {
  base: {
    name: "Base (Matchday)",
    price: "£15",
    introPrice: "£12",
    blurb: "Matchday desk with your own research. No Gemini.",
    includes: [
      "BYO Notebook / Research paste (local organise — no Gemini)",
      "News RSS only",
      "Diet AF live sync",
      "Notes buckets + relevance heuristics (no Gemini re-rank)",
      "OBS overlay, dossiers, Stats, Speaks, Print",
    ],
  },
  intel: {
    name: "Intel",
    price: "+£7",
    absolutePrice: "£22",
    blurb: "Gemini-powered briefs, Auto Gen packs, and note drafts.",
    includes: [
      "Everything in Base",
      "News Gemini web brief",
      "Auto Gen pack (pack-generate)",
      "Player note-draft",
      "Optional Gemini relevant re-rank",
    ],
    softCaps:
      "Soft caps (metering later): ~20 web briefs / mo · ~10 pack gens / mo.",
  },
  rivalCompare: "Compare to ~£35/mo rival desks — Pitchline Base is the affordable matchday core.",
} as const;

export function planStatus() {
  const envPlan = getEnvPlan();
  const override = readPlanOverride();
  const plan = getEffectivePlan();
  const geminiKey = isGeminiConfigured();
  return {
    plan,
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
    stripe: "Scaffold only — Stripe not live yet.",
  };
}
