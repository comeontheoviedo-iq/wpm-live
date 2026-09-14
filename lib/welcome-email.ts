/**
 * CoComms trial welcome email — sent once when Polar checkout unlocks trial.
 * Copy rules: no Gemini / OBS / BYO Notebook / Speaks / "generic SaaS shell".
 * Use Scripts not Speaks. Vibe: "Bring your notes. We file them where you need them."
 */

import { prisma } from "./prisma";
import { emailReplyTo, isEmailConfigured, sendEmail } from "./email";
import { sendOwnerTrialAlert } from "./owner-trial-alert";

export type WelcomePlanHint = "unlimited" | "match_pass" | null;

const APP_URL = "https://www.cocomms.online";
const TRAINING_URL = "https://www.cocomms.online/training";

function planLine(plan: WelcomePlanHint): string {
  if (plan === "unlimited") {
    return "You're on Unlimited — full desk access during your trial, then £22/mo unless you cancel.";
  }
  if (plan === "match_pass") {
    return "You're on a Match Desk Pass — same 14-day trial window, then your purchased desk credits remain.";
  }
  return "Your trial is open — choose Unlimited or a Match Desk Pass path is already set from checkout.";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildWelcomeEmail(opts: {
  name: string;
  plan?: WelcomePlanHint;
}): { subject: string; html: string; text: string } {
  const first =
    (opts.name || "").trim().split(/\s+/)[0] || "there";
  const plan = opts.plan ?? null;
  const softPlan = planLine(plan);

  const subject = "Welcome to CoComms — your trial is ready";

  const text = [
    `Hi ${first},`,
    "",
    "Welcome to CoComms — your commentary co-pilot.",
    "",
    softPlan,
    "",
    "Trial basics: 14 days · up to 3 desks · cancel anytime.",
    "",
    'Bring your notes. We file them where you need them.',
    "",
    "Quick start:",
    "  1. Open a desk",
    "  2. Paste your research notes",
    "  3. Confirm the Official XI",
    "  4. Work from Scripts and Notes",
    "",
    `App: ${APP_URL}`,
    `Training (account only): ${TRAINING_URL}`,
    "",
    "Questions? Just reply — help@cocomms.online",
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
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#f4f7fa;">Welcome, ${escapeHtml(first)}</h1>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#c5d0db;">
            You're in. CoComms is your commentary co-pilot for matchday — built around your prep, not the other way around.
          </p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#a8b6c4;">
            ${escapeHtml(softPlan)}
          </p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#a8b6c4;">
            <strong style="color:#e8eef4;">Trial:</strong> 14 days · up to 3 desks · cancel anytime.
          </p>
          <p style="margin:0 0 8px;font-size:15px;line-height:1.55;color:#c5d0db;font-style:italic;">
            Bring your notes. We file them where you need them.
          </p>
          <p style="margin:20px 0 8px;font-size:14px;font-weight:600;color:#f4f7fa;">Quick start</p>
          <ol style="margin:0 0 24px;padding-left:20px;color:#a8b6c4;font-size:15px;line-height:1.7;">
            <li>Open a desk</li>
            <li>Paste your research notes</li>
            <li>Confirm the Official XI</li>
            <li>Work from Scripts and Notes</li>
          </ol>
          <p style="margin:0 0 24px;">
            <a href="${APP_URL}" style="display:inline-block;background:#2dd4bf;color:#0f1419;text-decoration:none;font-weight:600;font-size:14px;padding:12px 18px;border-radius:8px;">Open CoComms</a>
          </p>
          <p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#8a9aab;">
            <a href="${APP_URL}" style="color:#7dd3c0;">${APP_URL}</a><br>
            Training (signed-in): <a href="${TRAINING_URL}" style="color:#7dd3c0;">${TRAINING_URL}</a>
          </p>
          <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#6b7c8c;">
            Questions? Reply to this email — ${escapeHtml(emailReplyTo())}
br>
            — The CoComms team
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

/**
 * Send the welcome email at most once per user when trial first unlocks.
 * Idempotent via User.welcomeEmailSentAt. Never throws.
 *
 * @returns true if a send was attempted and succeeded
 */
export async function maybeSendTrialWelcomeEmail(opts: {
  userId: string;
  /** True only when this webhook path is unlocking trial (not already on a live trial). */
  unlockingTrial: boolean;
  plan?: WelcomePlanHint;
}): Promise<boolean> {
  try {
    if (!opts.unlockingTrial) return false;
    if (!opts.userId) return false;

    if (!isEmailConfigured()) {
      console.warn(
        "[welcome-email] mail not configured — skip for user",
        opts.userId
      );
      return false;
    }

    const user = await prisma.user.findUnique({
      where: { id: opts.userId },
      select: {
        id: true,
        email: true,
        name: true,
        welcomeEmailSentAt: true,
        matchPassCredits: true,
      },
    });
    if (!user?.email) {
      console.warn("[welcome-email] no user/email for", opts.userId);
      return false;
    }
    if (user.welcomeEmailSentAt) return false;

    // Atomic claim so concurrent Polar events only send once.
    const claimed = await prisma.user.updateMany({
      where: { id: user.id, welcomeEmailSentAt: null },
      data: { welcomeEmailSentAt: new Date() },
    });
    if (claimed.count === 0) return false;

    const content = buildWelcomeEmail({
      name: user.name,
      plan: opts.plan ?? null,
    });
    const result = await sendEmail({
      to: user.email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      replyTo: emailReplyTo(),
    });

    if (!result.ok) {
      // Allow a later unlock-path event to retry if the provider failed.
      await prisma.user
        .updateMany({
          where: { id: user.id },
          data: { welcomeEmailSentAt: null },
        })
        .catch(() => {});
      console.warn(
        "[welcome-email] send failed — flag cleared for retry",
        user.id,
        result.error
      );
      return false;
    }

    console.log(
      "[welcome-email] sent via",
      result.provider,
      "to",
      user.email
    );

    // Same first-unlock claim — owner alert once; fail-soft, never blocks welcome.
    await sendOwnerTrialAlert({
      name: user.name,
      email: user.email,
      plan: opts.plan ?? null,
      matchPassCredits: user.matchPassCredits,
      unlockedAt: new Date(),
    });

    return true;
  } catch (e) {
    console.warn(
      "[welcome-email] unexpected error (swallowed)",
      e instanceof Error ? e.message : e
    );
    return false;
  }
}

/**
 * Whether the user is already on a live (non-expired) trial.
 */
export function isAlreadyOnLiveTrial(user: {
  billingStatus: string | null | undefined;
  trialEndsAt: Date | null | undefined;
}): boolean {
  if (user.billingStatus !== "trial") return false;
  if (!user.trialEndsAt) return false;
  return user.trialEndsAt.getTime() > Date.now();
}
