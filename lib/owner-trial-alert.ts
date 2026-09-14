/**
 * One-shot owner alert when Polar first unlocks a user trial.
 * Piggybacks the welcome-email idempotency gate (welcomeEmailSentAt).
 * Fail-soft: never throws.
 */

import { isEmailConfigured, sendEmail } from "./email";
import type { WelcomePlanHint } from "./welcome-email";

const DEFAULT_OWNER_ALERT = "chris@ronniedogmedia.com";

export function ownerAlertEmail(): string {
  return process.env.OWNER_ALERT_EMAIL?.trim() || DEFAULT_OWNER_ALERT;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatOwnerTrialPlanLine(opts: {
  plan?: WelcomePlanHint;
  matchPassCredits?: number | null;
}): string {
  const credits =
    opts.matchPassCredits != null && Number.isFinite(opts.matchPassCredits)
      ? opts.matchPassCredits
      : null;

  if (opts.plan === "unlimited") {
    return "Unlimited";
  }
  if (opts.plan === "match_pass") {
    if (credits != null) {
      return `Match Desk Pass (${credits} credit${credits === 1 ? "" : "s"})`;
    }
    return "Match Desk Pass";
  }
  if (credits != null && credits > 0) {
    return `Match Desk Pass (${credits} credit${credits === 1 ? "" : "s"})`;
  }
  return "Unknown / not set at unlock";
}

export function buildOwnerTrialAlertEmail(opts: {
  name: string;
  email: string;
  plan?: WelcomePlanHint;
  matchPassCredits?: number | null;
  unlockedAt?: Date | string;
}): { subject: string; html: string; text: string } {
  const name = (opts.name || "").trim() || "(no name)";
  const email = (opts.email || "").trim() || "(no email)";
  const planLine = formatOwnerTrialPlanLine({
    plan: opts.plan ?? null,
    matchPassCredits: opts.matchPassCredits,
  });
  const unlockedAt =
    opts.unlockedAt instanceof Date
      ? opts.unlockedAt.toISOString()
      : typeof opts.unlockedAt === "string" && opts.unlockedAt.trim()
        ? opts.unlockedAt.trim()
        : new Date().toISOString();

  const subject = `CoComms — new trial: ${email}`;

  const text = [
    "New CoComms trial unlocked",
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    `Plan: ${planLine}`,
    `Unlocked at (ISO): ${unlockedAt}`,
    "",
    "Reply to this email to contact the subscriber.",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111;line-height:1.5;">
  <p><strong>New CoComms trial unlocked</strong></p>
  <ul>
    <li><strong>Name:</strong> ${escapeHtml(name)}</li>
    <li><strong>Email:</strong> ${escapeHtml(email)}</li>
    <li><strong>Plan:</strong> ${escapeHtml(planLine)}</li>
    <li><strong>Unlocked at (ISO):</strong> ${escapeHtml(unlockedAt)}</li>
  </ul>
  <p style="color:#555;font-size:13px;">Reply to this email to contact the subscriber.</p>
</body>
</html>`;

  return { subject, html, text };
}

/**
 * Email the owner once about a new trial. Never throws.
 * Caller should invoke only from the first-unlock welcome claim path.
 */
export async function sendOwnerTrialAlert(opts: {
  name: string;
  email: string;
  plan?: WelcomePlanHint;
  matchPassCredits?: number | null;
  unlockedAt?: Date | string;
}): Promise<boolean> {
  try {
    if (!isEmailConfigured()) {
      console.warn("[owner-trial-alert] mail not configured — skip");
      return false;
    }
    const to = ownerAlertEmail();
    if (!to) {
      console.warn("[owner-trial-alert] empty OWNER_ALERT_EMAIL — skip");
      return false;
    }
    const content = buildOwnerTrialAlertEmail(opts);
    const replyTo = opts.email?.trim() || undefined;
    const result = await sendEmail({
      to,
      subject: content.subject,
      html: content.html,
      text: content.text,
      replyTo,
    });
    if (!result.ok) {
      console.warn(
        "[owner-trial-alert] send failed",
        result.provider,
        result.error
      );
      return false;
    }
    console.log(
      "[owner-trial-alert] sent via",
      result.provider,
      "to",
      to,
      "re subscriber",
      opts.email
    );
    return true;
  } catch (e) {
    console.warn(
      "[owner-trial-alert] unexpected error (swallowed)",
      e instanceof Error ? e.message : e
    );
    return false;
  }
}
