/**
 * CoComms trial model — card-upfront preference, app-side fallback.
 *
 * Commercial: Unlimited £22/mo after trial unless cancelled.
 * Trial: 14 days · max 3 match desks (not a 48h-only flash trial).
 * Mid-trial: cancel (portal) OR switch to Match Desk Pass (1/5/10 credits).
 * Match Desk Pass: one-time packs; each credit = one match desk after/without Unlimited.
 *
 * When Stripe keys exist: Checkout uses trial_period_days + card collection;
 * cancel via Customer Portal in Settings; pass packs via checkout plan=match_pass|switch_to_pass.
 * When keys missing: app-side billingStatus / trialEndsAt / cancelAtPeriodEnd
 * with the same UX copy; portal wires when keys appear.
 */

import { prisma } from "./prisma";
import { isStripeConfigured } from "./stripe";
import { PLAN_COPY } from "./plan";

export const TRIAL_DAYS = 14;
export const TRIAL_DESK_LIMIT = 3;

export type BillingStatus =
  | "none"
  | "trial"
  | "active"
  | "cancelled"
  | "expired";

export type TrialSnapshot = {
  billingStatus: BillingStatus;
  trialActive: boolean;
  trialDays: number;
  trialDeskLimit: number;
  desksUsed: number;
  desksRemaining: number | null;
  canCreateDesk: boolean;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  trialCancelledAt: string | null;
  cancelAtPeriodEnd: boolean;
  daysRemaining: number | null;
  matchPassCredits: number;
  convertsTo: string;
  convertPrice: string;
  stripeConfigured: boolean;
  message: string;
  cancelPath: string;
};

function asBillingStatus(raw: string | null | undefined): BillingStatus {
  if (
    raw === "trial" ||
    raw === "active" ||
    raw === "cancelled" ||
    raw === "expired" ||
    raw === "none"
  ) {
    return raw;
  }
  return "none";
}

/** Demo / operator accounts skip trial desk caps. */
export function isUnlimitedAccount(email: string): boolean {
  const e = email.trim().toLowerCase();
  return e === "demo@pitchline.app" || e.endsWith("@pitchline.app");
}

export function computeTrialWindow(from = new Date()): {
  trialStartedAt: Date;
  trialEndsAt: Date;
} {
  const trialStartedAt = from;
  const trialEndsAt = new Date(from.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  return { trialStartedAt, trialEndsAt };
}

export function daysRemaining(endsAt: Date | null | undefined, now = new Date()): number | null {
  if (!endsAt) return null;
  const ms = endsAt.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

type UserBillingRow = {
  email: string;
  billingStatus: string;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  trialCancelledAt: Date | null;
  cancelAtPeriodEnd: boolean;
  matchPassCredits: number;
};

export async function getUserBilling(userId: string): Promise<UserBillingRow | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      billingStatus: true,
      trialStartedAt: true,
      trialEndsAt: true,
      trialCancelledAt: true,
      cancelAtPeriodEnd: true,
      matchPassCredits: true,
    },
  });
  return user;
}

/**
 * Expire trial in DB when wall-clock passed and not converted / not already expired.
 * Cancelled-during-trial still keeps access until trialEndsAt, then → expired.
 */
export async function refreshTrialExpiry(userId: string): Promise<UserBillingRow | null> {
  const user = await getUserBilling(userId);
  if (!user) return null;
  if (isUnlimitedAccount(user.email)) return user;

  const now = new Date();
  const status = asBillingStatus(user.billingStatus);
  if (
    (status === "trial" || (status === "cancelled" && user.trialEndsAt)) &&
    user.trialEndsAt &&
    user.trialEndsAt.getTime() <= now.getTime()
  ) {
    // If they cancelled, stay cancelled semantics but mark expired for entitlements
    const next: BillingStatus =
      status === "cancelled" || user.cancelAtPeriodEnd ? "expired" : "expired";
    await prisma.user.update({
      where: { id: userId },
      data: { billingStatus: next },
    });
    return getUserBilling(userId);
  }
  return user;
}

export async function startAppTrial(userId: string): Promise<UserBillingRow> {
  const { trialStartedAt, trialEndsAt } = computeTrialWindow();
  await prisma.user.update({
    where: { id: userId },
    data: {
      billingStatus: "trial",
      trialStartedAt,
      trialEndsAt,
      trialCancelledAt: null,
      cancelAtPeriodEnd: false,
    },
  });
  const row = await getUserBilling(userId);
  if (!row) throw new Error("User missing after startAppTrial");
  return row;
}

/** App-side cancel — do not convert to £22; access until trialEndsAt. */
export async function cancelAppTrial(userId: string): Promise<UserBillingRow> {
  const now = new Date();
  await prisma.user.update({
    where: { id: userId },
    data: {
      cancelAtPeriodEnd: true,
      trialCancelledAt: now,
      billingStatus: "cancelled",
    },
  });
  const row = await getUserBilling(userId);
  if (!row) throw new Error("User missing after cancelAppTrial");
  return row;
}

/** Undo app-side cancel while still inside the trial window. */
export async function resumeAppTrial(userId: string): Promise<UserBillingRow> {
  const user = await getUserBilling(userId);
  if (!user?.trialEndsAt || user.trialEndsAt.getTime() <= Date.now()) {
    throw new Error("Trial window has ended — start Unlimited or a new trial.");
  }
  await prisma.user.update({
    where: { id: userId },
    data: {
      cancelAtPeriodEnd: false,
      trialCancelledAt: null,
      billingStatus: "trial",
    },
  });
  const row = await getUserBilling(userId);
  if (!row) throw new Error("User missing after resumeAppTrial");
  return row;
}

export async function buildTrialSnapshot(userId: string): Promise<TrialSnapshot | null> {
  const user = await refreshTrialExpiry(userId);
  if (!user) return null;

  const desksUsed = await prisma.matchDay.count({ where: { userId } });
  const stripeConfigured = isStripeConfigured();
  const status = asBillingStatus(user.billingStatus);
  const now = new Date();
  const ends = user.trialEndsAt;
  const withinWindow = Boolean(ends && ends.getTime() > now.getTime());

  const matchPassCredits = user.matchPassCredits ?? 0;

  // Active paid or demo → unlimited desks
  if (isUnlimitedAccount(user.email) || status === "active") {
    return {
      billingStatus: isUnlimitedAccount(user.email) ? "active" : status,
      trialActive: false,
      trialDays: TRIAL_DAYS,
      trialDeskLimit: TRIAL_DESK_LIMIT,
      desksUsed,
      desksRemaining: null,
      canCreateDesk: true,
      trialStartedAt: user.trialStartedAt?.toISOString() ?? null,
      trialEndsAt: user.trialEndsAt?.toISOString() ?? null,
      trialCancelledAt: user.trialCancelledAt?.toISOString() ?? null,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd,
      daysRemaining: null,
      matchPassCredits,
      convertsTo: PLAN_COPY.unlimited.name,
      convertPrice: PLAN_COPY.unlimited.price,
      stripeConfigured,
      message: isUnlimitedAccount(user.email)
        ? "Operator / demo account — Unlimited desk access."
        : "Unlimited plan active — create as many match desks as you need.",
      cancelPath: stripeConfigured
        ? "Settings → Plan → Manage billing (Customer Portal)"
        : "Settings → Plan → Cancel trial / manage",
    };
  }

  const trialActive =
    (status === "trial" || (status === "cancelled" && withinWindow)) && withinWindow;

  const desksRemaining = trialActive
    ? Math.max(0, TRIAL_DESK_LIMIT - desksUsed)
    : status === "none"
      ? null
      : matchPassCredits > 0
        ? matchPassCredits
        : 0;

  // Legacy accounts (billingStatus none) stay uncapped until they start a trial/signup path.
  // (active / demo already returned above)
  // Match Desk Pass credits unlock desks after/without Unlimited.
  const canCreateDesk = trialActive
    ? desksUsed < TRIAL_DESK_LIMIT
    : status === "none" || matchPassCredits > 0;

  let message: string;
  if (trialActive && user.cancelAtPeriodEnd) {
    message = `Trial cancelled — access until ${ends?.toLocaleDateString("en-GB") || "end"}. Will not convert to ${PLAN_COPY.unlimited.price}/mo.${
      matchPassCredits > 0 ? ` Match Desk Pass credits: ${matchPassCredits}.` : ""
    }`;
  } else if (trialActive) {
    message = `Trial: ${TRIAL_DESK_LIMIT} match desks · ${daysRemaining(ends) ?? "?"} days left. Converts to Unlimited ${PLAN_COPY.unlimited.price}/mo unless cancelled. Mid-trial: cancel, stay on Unlimited, or switch to a Match Desk Pass.`;
  } else if (matchPassCredits > 0) {
    message = `Match Desk Pass: ${matchPassCredits} desk credit${matchPassCredits === 1 ? "" : "s"} remaining. Or subscribe Unlimited ${PLAN_COPY.unlimited.price}/mo.`;
  } else if (status === "expired" || (status === "cancelled" && !withinWindow)) {
    message = `Trial ended. Subscribe to Unlimited ${PLAN_COPY.unlimited.price}/mo, or buy a Match Desk Pass (1 / 5 / 10).`;
  } else if (status === "none") {
    message = `No trial on this account yet. New signups get ${TRIAL_DAYS} days / ${TRIAL_DESK_LIMIT} desks. Start a trial from Settings, or subscribe Unlimited ${PLAN_COPY.unlimited.price}/mo.`;
  } else {
    message = `Billing status: ${status}.`;
  }

  return {
    billingStatus: status,
    trialActive,
    trialDays: TRIAL_DAYS,
    trialDeskLimit: TRIAL_DESK_LIMIT,
    desksUsed,
    desksRemaining,
    canCreateDesk: Boolean(canCreateDesk),
    trialStartedAt: user.trialStartedAt?.toISOString() ?? null,
    trialEndsAt: user.trialEndsAt?.toISOString() ?? null,
    trialCancelledAt: user.trialCancelledAt?.toISOString() ?? null,
    cancelAtPeriodEnd: user.cancelAtPeriodEnd,
    daysRemaining: daysRemaining(ends),
    matchPassCredits,
    convertsTo: PLAN_COPY.unlimited.name,
    convertPrice: PLAN_COPY.unlimited.price,
    stripeConfigured,
    message,
    cancelPath: stripeConfigured
      ? "Settings → Plan → Manage billing (opens Customer Portal — cancel before trial ends to avoid £22 charge)"
      : "Settings → Plan → Cancel trial (app-side until billing keys are set)",
  };
}

export async function assertCanCreateDesk(userId: string): Promise<
  | { ok: true; snapshot: TrialSnapshot }
  | { ok: false; status: number; error: string; snapshot: TrialSnapshot | null }
> {
  const snapshot = await buildTrialSnapshot(userId);
  if (!snapshot) {
    return { ok: false, status: 401, error: "User not found", snapshot: null };
  }
  if (snapshot.canCreateDesk) return { ok: true, snapshot };
  if (snapshot.trialActive && snapshot.desksUsed >= TRIAL_DESK_LIMIT) {
    return {
      ok: false,
      status: 403,
      error: `Trial includes ${TRIAL_DESK_LIMIT} match desks. Upgrade to Unlimited ${PLAN_COPY.unlimited.price}/mo, buy a Match Desk Pass, or delete an existing desk.`,
      snapshot,
    };
  }
  return {
    ok: false,
    status: 402,
    error: `Trial ended. Subscribe to Unlimited ${PLAN_COPY.unlimited.price}/mo or buy a Match Desk Pass (1 / 5 / 10) to create match desks.`,
    snapshot,
  };
}

/**
 * After a successful desk create: spend one Match Desk Pass credit when the user
 * is not on Unlimited / demo / active trial window (trial uses the 3-desk cap instead).
 */
export async function maybeConsumeMatchPassCredit(userId: string): Promise<void> {
  const user = await getUserBilling(userId);
  if (!user) return;
  if (isUnlimitedAccount(user.email)) return;
  const status = asBillingStatus(user.billingStatus);
  if (status === "active") return;
  const now = Date.now();
  const trialActive =
    (status === "trial" || (status === "cancelled" && user.trialEndsAt)) &&
    Boolean(user.trialEndsAt && user.trialEndsAt.getTime() > now);
  if (trialActive) return;
  if ((user.matchPassCredits ?? 0) <= 0) return;
  await prisma.user.update({
    where: { id: userId },
    data: { matchPassCredits: { decrement: 1 } },
  });
}
