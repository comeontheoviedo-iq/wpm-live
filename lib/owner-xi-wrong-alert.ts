/**
 * Owner alert when a commentator reports "XI looks wrong" on a desk.
 * Reuses ownerAlertEmail(); fail-soft.
 */

import { isEmailConfigured, sendEmail } from "./email";
import { ownerAlertEmail } from "./owner-trial-alert";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildOwnerXiWrongAlertEmail(opts: {
  reporterName: string;
  reporterEmail: string;
  matchId: string;
  matchTitle: string;
  competition?: string | null;
  afFixtureId?: number | null;
  note?: string | null;
  frozenAt?: Date | string;
}): { subject: string; html: string; text: string } {
  const name = (opts.reporterName || "").trim() || "(no name)";
  const email = (opts.reporterEmail || "").trim() || "(no email)";
  const title = (opts.matchTitle || "").trim() || opts.matchId;
  const competition = (opts.competition || "").trim() || "(unknown)";
  const afId =
    opts.afFixtureId != null && Number.isFinite(opts.afFixtureId)
      ? String(opts.afFixtureId)
      : "(unlinked)";
  const note = (opts.note || "").trim() || "(none)";
  const frozenAt =
    opts.frozenAt instanceof Date
      ? opts.frozenAt.toISOString()
      : typeof opts.frozenAt === "string" && opts.frozenAt.trim()
        ? opts.frozenAt.trim()
        : new Date().toISOString();

  const subject = `CoComms — XI looks wrong: ${title}`;

  const text = [
    "Commentator reported XI looks wrong — Official feed sync frozen on desk",
    "",
    `Match: ${title}`,
    `Match id: ${opts.matchId}`,
    `Competition: ${competition}`,
    `AF fixture id: ${afId}`,
    `Reporter: ${name} <${email}>`,
    `Note: ${note}`,
    `Frozen at (ISO): ${frozenAt}`,
    "",
    "Does NOT refresh XI. Desk owner: Unlock feed or Re-pull Official XI from lineup controls.",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111;line-height:1.5;">
  <p><strong>XI looks wrong — feed sync frozen</strong></p>
  <ul>
    <li><strong>Match:</strong> ${escapeHtml(title)}</li>
    <li><strong>Match id:</strong> ${escapeHtml(opts.matchId)}</li>
    <li><strong>Competition:</strong> ${escapeHtml(competition)}</li>
    <li><strong>AF fixture id:</strong> ${escapeHtml(afId)}</li>
    <li><strong>Reporter:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</li>
    <li><strong>Note:</strong> ${escapeHtml(note)}</li>
    <li><strong>Frozen at (ISO):</strong> ${escapeHtml(frozenAt)}</li>
  </ul>
  <p style="color:#555;font-size:13px;">Does NOT refresh XI. Desk owner: Unlock feed or Re-pull Official XI from lineup controls.</p>
</body>
</html>`;

  return { subject, html, text };
}

export async function sendOwnerXiWrongAlert(opts: {
  reporterName: string;
  reporterEmail: string;
  matchId: string;
  matchTitle: string;
  competition?: string | null;
  afFixtureId?: number | null;
  note?: string | null;
  frozenAt?: Date | string;
}): Promise<boolean> {
  try {
    if (!isEmailConfigured()) {
      console.warn("[owner-xi-wrong-alert] mail not configured — skip");
      return false;
    }
    const to = ownerAlertEmail();
    if (!to) {
      console.warn("[owner-xi-wrong-alert] empty OWNER_ALERT_EMAIL — skip");
      return false;
    }
    const content = buildOwnerXiWrongAlertEmail(opts);
    const result = await sendEmail({
      to,
      subject: content.subject,
      html: content.html,
      text: content.text,
      replyTo: opts.reporterEmail?.trim() || undefined,
    });
    if (!result.ok) {
      console.warn(
        "[owner-xi-wrong-alert] send failed",
        result.provider,
        result.error
      );
      return false;
    }
    console.log(
      "[owner-xi-wrong-alert] sent via",
      result.provider,
      "to",
      to,
      "match",
      opts.matchId
    );
    return true;
  } catch (e) {
    console.warn(
      "[owner-xi-wrong-alert] unexpected error (swallowed)",
      e instanceof Error ? e.message : e
    );
    return false;
  }
}
