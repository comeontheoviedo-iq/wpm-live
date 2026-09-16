import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashResetToken } from "@/lib/password-reset";

/**
 * POST /api/auth/reset-password — set a new password with a reset token.
 * Body: { token, newPassword }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body.token || "").trim();
    const newPassword = String(body.newPassword || "");

    if (!token) {
      return NextResponse.json({ error: "Reset token required" }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const tokenHash = hashResetToken(token);
    const row = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!row) {
      return NextResponse.json(
        { error: "Reset link is invalid or has expired" },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: row.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[auth/reset-password]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not reset password" },
      { status: 500 }
    );
  }
}
