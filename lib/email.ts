/**
 * Transactional email helper for CoComms.
 *
 * Prefer Resend when RESEND_API_KEY is set; else SMTP when SMTP_HOST +
 * SMTP_USER + SMTP_PASS are set. Never throws — callers (Polar webhook)
 * must stay resilient when mail is misconfigured.
 *
 * Env:
 *   RESEND_API_KEY
 *   SMTP_HOST, SMTP_USER, SMTP_PASS [, SMTP_PORT, SMTP_SECURE]
 *   EMAIL_FROM  (default: CoComms <help@cocomms.online>)
 */

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export type SendEmailResult = {
  ok: boolean;
  provider: "resend" | "smtp" | "none";
  error?: string;
};

const DEFAULT_FROM = "CoComms <help@cocomms.online>";
const DEFAULT_REPLY_TO = "help@cocomms.online";

export function emailFrom(): string {
  return process.env.EMAIL_FROM?.trim() || DEFAULT_FROM;
}

export function emailReplyTo(): string {
  return process.env.EMAIL_REPLY_TO?.trim() || DEFAULT_REPLY_TO;
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim()
  );
}

export function isEmailConfigured(): boolean {
  return isResendConfigured() || isSmtpConfigured();
}

export function emailPublicStatus() {
  return {
    configured: isEmailConfigured(),
    provider: isResendConfigured()
      ? ("resend" as const)
      : isSmtpConfigured()
        ? ("smtp" as const)
        : ("none" as const),
    from: emailFrom(),
  };
}

async function sendViaResend(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY!.trim();
  const replyTo = input.replyTo || emailReplyTo();
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom(),
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: replyTo,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(
        "[email] Resend failed",
        res.status,
        body.slice(0, 400)
      );
      return {
        ok: false,
        provider: "resend",
        error: `Resend HTTP ${res.status}`,
      };
    }
    return { ok: true, provider: "resend" };
  } catch (e) {
    console.warn(
      "[email] Resend error",
      e instanceof Error ? e.message : e
    );
    return {
      ok: false,
      provider: "resend",
      error: e instanceof Error ? e.message : "Resend failed",
    };
  }
}

async function sendViaSmtp(input: SendEmailInput): Promise<SendEmailResult> {
  const host = process.env.SMTP_HOST!.trim();
  const user = process.env.SMTP_USER!.trim();
  const pass = process.env.SMTP_PASS!.trim();
  const portRaw = process.env.SMTP_PORT?.trim();
  const port = portRaw ? Number(portRaw) : 587;
  const secureEnv = process.env.SMTP_SECURE?.trim().toLowerCase();
  const secure =
    secureEnv === "true" ||
    secureEnv === "1" ||
    (!secureEnv && port === 465);
  const replyTo = input.replyTo || emailReplyTo();

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodemailer = require("nodemailer") as {
      createTransport: (opts: Record<string, unknown>) => {
        sendMail: (opts: Record<string, unknown>) => Promise<unknown>;
      };
    };
    const transport = nodemailer.createTransport({
      host,
      port: Number.isFinite(port) ? port : 587,
      secure,
      auth: { user, pass },
    });
    await transport.sendMail({
      from: emailFrom(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo,
    });
    return { ok: true, provider: "smtp" };
  } catch (e) {
    console.warn("[email] SMTP error", e instanceof Error ? e.message : e);
    return {
      ok: false,
      provider: "smtp",
      error: e instanceof Error ? e.message : "SMTP failed",
    };
  }
}

/**
 * Send a transactional email. Never throws.
 * Returns false (ok: false) when mail is not configured or the provider fails.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  try {
    if (!input.to?.trim()) {
      console.warn("[email] missing to — skip");
      return { ok: false, provider: "none", error: "missing to" };
    }
    if (isResendConfigured()) return await sendViaResend(input);
    if (isSmtpConfigured()) return await sendViaSmtp(input);
    console.warn(
      "[email] no mail config (set RESEND_API_KEY or SMTP_HOST/USER/PASS) — skip send to",
      input.to
    );
    return { ok: false, provider: "none", error: "not configured" };
  } catch (e) {
    console.warn(
      "[email] unexpected error (swallowed)",
      e instanceof Error ? e.message : e
    );
    return {
      ok: false,
      provider: "none",
      error: e instanceof Error ? e.message : "unexpected",
    };
  }
}
