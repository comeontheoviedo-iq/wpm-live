/**
 * Owner alert when a user submits Ask / Report from the desk.
 * Reuses Resend / SMTP via lib/email + OWNER_ALERT_EMAIL path.
 * Fail-soft: never throws.
 */

import { isEmailConfigured, sendEmail } from "./email";
import { ownerAlertEmail } from "./owner-trial-alert";

export const SUPPORT_PING_TYPES = [
  "ask",
  "bug",
  "xi_wrong",
  "billing",
  "other",
] as const;

export type SupportPingType = (typeof SUPPORT_PING_TYPES)[number];

export const SUPPORT_PING_TYPE_LABELS: Record<SupportPingType, string> = {
  ask: "Ask",
  bug: "Bug",
  xi_wrong: "XI wrong",
  billing: "Billing",
  other: "Other",
};

export function parseSupportPingType(raw: unknown): SupportPingType | null {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
  if ((SUPPORT_PING_TYPES as readonly string[]).includes(s)) {
    return s as SupportPingType;
  }
  // UI may send "XI wrong"
  if (s === "xiwrong" || s === "xi_wrong") return "xi_wrong";
  return null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type SupportPingContext = {
  matchTitle?: string | null;
  afFixtureId?: number | string | null;
  lineupSource?: string | null;
  url?: string | null;
  matchId?: string | null;
  competition?: string | null;
  status?: string | null;
  [key: string]: unknown;
};

export function buildSupportPingAlertEmail(opts: {
  pingId: string;
  type: SupportPingType;
  message: string;
  userName: string;
  userEmail: string;
  context?: SupportPingContext | null;
  createdAt?: Date | string;
}): { subject: string; html: string; text: string } {
  const typeLabel = SUPPORT_PING_TYPE_LABELS[opts.type] || opts.type;
  const name = (opts.userName || "").trim() || "(no name)";
  const email = (opts.userEmail || "").trim() || "(no email)";
  const createdAt =
    opts.createdAt instanceof Date
      ? opts.createdAt.toISOString()
      : typeof opts.createdAt === "string" && opts.createdAt.trim()
        ? opts.createdAt.trim()
        : new Date().toISOString();

  const ctx = opts.context || {};
  const matchTitle = ctx.matchTitle != null ? String(ctx.matchTitle) : "";
  const subjectBits = [`[CoComms Ask/Report] ${typeLabel}`];
  if (matchTitle) subjectBits.push(matchTitle.slice(0, 60));
  const subject = subjectBits.join(" · ");

  const contextLines: string[] = [];
  if (ctx.matchTitle) contextLines.push(`Match: ${ctx.matchTitle}`);
  if (ctx.matchId) contextLines.push(`Match id: ${ctx.matchId}`);
  if (ctx.afFixtureId != null && ctx.afFixtureId !== "")
    contextLines.push(`AF fixture id: ${ctx.afFixtureId}`);
  if (ctx.lineupSource) contextLines.push(`Lineup source: ${ctx.lineupSource}`);
  if (ctx.competition) contextLines.push(`Competition: ${ctx.competition}`);
  if (ctx.status) contextLines.push(`Desk status: ${ctx.status}`);
  if (ctx.url) contextLines.push(`URL: ${ctx.url}`);

  const text = [
    "CoComms Ask / Report",
    "",
    `Ping id: ${opts.pingId}`,
    `Type: ${typeLabel}`,
    `From: ${name} <${email}>`,
    `Created: ${createdAt}`,
    `Status: open`,
    "",
    "Message:",
    opts.message,
    "",
    ...(contextLines.length
      ? ["Context:", ...contextLines, ""]
      : ["Context: (none)", ""]),
    "Agent: poll GET /api/owner/support-pings?status=open then investigate / reply / PATCH resolved.",
    "See docs/ASK_REPORT_ROUTINE.md",
  ].join("\n");

  const contextHtml = contextLines.length
    ? `<ul>${contextLines
        .map((l) => `<li>${escapeHtml(l)}</li>`)
        .join("")}</ul>`
    : `<p style="color:#555;">(none)</p>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111;line-height:1.5;">
  <p><strong style="color:#d97706;">CoComms Ask / Report</strong></p>
  <ul>
    <li><strong>Ping id:</strong> ${escapeHtml(opts.pingId)}</li>
    <li><strong>Type:</strong> ${escapeHtml(typeLabel)}</li>
    <li><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</li>
    <li><strong>Created:</strong> ${escapeHtml(createdAt)}</li>
  </ul>
  <p><strong>Message</strong></p>
  <pre style="white-space:pre-wrap;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:12px;font-size:14px;">${escapeHtml(opts.message)}</pre>
  <p><strong>Context</strong></p>
  ${contextHtml}
  <p style="color:#555;font-size:13px;">Reply to contact the reporter. Dev agent: <code>GET /api/owner/support-pings?status=open</code> · <code>docs/ASK_REPORT_ROUTINE.md</code></p>
</body>
</html>`;

  return { subject, html, text };
}

/** Email the owner about a new support ping. Never throws. */
export async function sendSupportPingAlert(opts: {
  pingId: string;
  type: SupportPingType;
  message: string;
  userName: string;
  userEmail: string;
  context?: SupportPingContext | null;
  createdAt?: Date | string;
}): Promise<boolean> {
  try {
    if (!isEmailConfigured()) {
      console.warn("[support-ping-alert] mail not configured — skip");
      return false;
    }
    const to = ownerAlertEmail();
    if (!to) {
      console.warn("[support-ping-alert] empty OWNER_ALERT_EMAIL — skip");
      return false;
    }
    const content = buildSupportPingAlertEmail(opts);
    const replyTo = opts.userEmail?.trim() || undefined;
    const result = await sendEmail({
      to,
      subject: content.subject,
      html: content.html,
      text: content.text,
      replyTo,
    });
    if (!result.ok) {
      console.warn(
        "[support-ping-alert] send failed",
        result.provider,
        result.error
      );
      return false;
    }
    console.log(
      "[support-ping-alert] sent via",
      result.provider,
      "to",
      to,
      "ping",
      opts.pingId
    );
    return true;
  } catch (e) {
    console.warn(
      "[support-ping-alert] unexpected error (swallowed)",
      e instanceof Error ? e.message : e
    );
    return false;
  }
}
