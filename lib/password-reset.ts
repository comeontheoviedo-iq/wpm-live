import { createHash, randomBytes } from "crypto";
import { prisma } from "./prisma";
import { emailReplyTo, sendEmail } from "./email";

const APP_URL = "https://www.cocomms.online";
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateResetToken(): string {
  return randomBytes(32).toString("hex");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildPasswordResetEmail(opts: {
  name: string;
  resetUrl: string;
}): { subject: string; html: string; text: string } {
  const first = (opts.name || "").trim().split(/\s+/)[0] || "there";
  const subject = "Reset your CoComms password";
  const text = [
    `Hi ${first},`,
    "",
    "We received a request to reset your CoComms password.",
    "",
    `Reset link (expires in 1 hour):`,
    opts.resetUrl,
    "",
    "If you did not request this, you can ignore this email — your password will stay the same.",
    "",
    "Questions? Reply to help@cocomms.online",
    "",
    "— The CoComms team",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f1419;color:#e8eef4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f1419;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#1a222c;border-radius:12px;padding:32px 28px;border:1px solid #2a3542;">
        <tr><td>
          <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#7dd3c0;">CoComms</p>
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#f4f7fa;">Reset your password</h1>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#c5d0db;">
            Hi ${escapeHtml(first)}, we received a request to reset your CoComms password.
          </p>
          <p style="margin:0 0 24px;">
            <a href="${escapeHtml(opts.resetUrl)}" style="display:inline-block;background:#2dd4bf;color:#0f1419;text-decoration:none;font-weight:600;font-size:14px;padding:12px 18px;border-radius:8px;">Choose a new password</a>
          </p>
          <p style="margin:0 0 12px;font-size:13px;line-height:1.55;color:#a8b6c4;">
            This link expires in <strong style="color:#e8eef4;">1 hour</strong>. If you did not request a reset, ignore this email — your password will stay the same.
          </p>
          <p style="margin:24px 0 0;font-size:12px;color:#7a8794;">
            Or paste: ${escapeHtml(opts.resetUrl)}
          </p>
          <p style="margin:16px 0 0;font-size:12px;color:#7a8794;">Questions? Reply to help@cocomms.online</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

/**
 * Create a reset token for an existing user and email the link.
 * Caller must have already verified the user exists.
 */
export async function issuePasswordResetForUser(user: {
  id: string;
  email: string;
  name: string;
}) {
  const token = generateResetToken();
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const resetUrl = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const mail = buildPasswordResetEmail({ name: user.name, resetUrl });
  const result = await sendEmail({
    to: user.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    replyTo: emailReplyTo(),
  });

  return { ...result, resetUrl };
}
