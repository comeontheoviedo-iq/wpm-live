import { NextResponse } from "next/server";
import { createSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeTrialWindow, TRIAL_DAYS, TRIAL_DESK_LIMIT } from "@/lib/trial";
import { isStripeConfigured } from "@/lib/stripe";

/**
 * POST /api/auth/register — create account + start 14-day / 3-desk trial (app-side).
 * When Stripe is configured, client should still register then hit Checkout for card-upfront.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const name = String(body.name || "").trim() || email.split("@")[0] || "Commentator";

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Account already exists — sign in instead" }, { status: 409 });
    }

    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || "")
      .join("") || "CC";

    const { trialStartedAt, trialEndsAt } = computeTrialWindow();
    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: "commentator",
        avatarInitials: initials.slice(0, 3),
        theme: "system",
        billingStatus: "trial",
        trialStartedAt,
        trialEndsAt,
        cancelAtPeriodEnd: false,
      },
    });

    const sessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarInitials: user.avatarInitials,
      theme: user.theme,
    };
    await createSession(sessionUser);

    return NextResponse.json({
      ok: true,
      user: sessionUser,
      trial: {
        days: TRIAL_DAYS,
        deskLimit: TRIAL_DESK_LIMIT,
        endsAt: trialEndsAt.toISOString(),
        convertsTo: "Unlimited £22/mo",
        stripeConfigured: isStripeConfigured(),
        nextStep: isStripeConfigured()
          ? "Add a card via Checkout to keep the trial (converts to £22/mo unless cancelled)."
          : "App-side trial active. Cancel anytime in Settings → Plan before it converts.",
      },
    });
  } catch (err) {
    console.error("[auth/register]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Registration failed" },
      { status: 500 }
    );
  }
}
