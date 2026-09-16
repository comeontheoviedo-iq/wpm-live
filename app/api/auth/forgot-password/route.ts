import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { issuePasswordResetForUser } from "@/lib/password-reset";

const GENERIC =
  "If an account exists for that email, we sent a password reset link. Check your inbox (and spam).";

/**
 * POST /api/auth/forgot-password — always returns a generic success message.
 * Body: { email }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Valid email required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    if (user) {
      const result = await issuePasswordResetForUser(user);
      if (!result.ok) {
        console.warn("[auth/forgot-password] email failed", result.error);
        // Still return generic success to avoid leaking existence vs mail failure edge cases
        // to attackers; log for ops.
      }
    }

    return NextResponse.json({ ok: true, message: GENERIC });
  } catch (err) {
    console.error("[auth/forgot-password]", err);
    // Generic response even on unexpected errors (after logging)
    return NextResponse.json({ ok: true, message: GENERIC });
  }
}
