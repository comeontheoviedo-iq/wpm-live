/**
 * Owner email allowlist for CoComms operator APIs (support pings, etc.).
 * Floor: chris@ronniedogmedia.com + comeontheoviedo@gmail.com.
 * Optional env OWNER_EMAIL_ALLOWLIST = comma-separated extras (case-insensitive).
 */

export const OWNER_FLOOR_EMAILS = [
  "chris@ronniedogmedia.com",
  "comeontheoviedo@gmail.com",
] as const;

function normalizeEmail(email: string | null | undefined): string {
  return String(email || "").trim().toLowerCase();
}

/** Parse allowlist from env; always unions the floor emails. */
export function ownerEmailAllowlist(): string[] {
  const raw = process.env.OWNER_EMAIL_ALLOWLIST?.trim() ?? "";
  const fromEnv = raw
    ? raw
        .split(",")
        .map((e) => normalizeEmail(e))
        .filter(Boolean)
    : [];
  const set = new Set<string>([
    ...OWNER_FLOOR_EMAILS.map((e) => normalizeEmail(e)),
    ...fromEnv,
  ]);
  return [...set];
}

type EmailLike =
  | string
  | null
  | undefined
  | { email?: string | null };

/**
 * True when the signed-in user's email is on the owner allowlist.
 */
export function isOwnerEmail(emailOrUser: EmailLike): boolean {
  const email =
    typeof emailOrUser === "string" || emailOrUser == null
      ? normalizeEmail(emailOrUser)
      : normalizeEmail(emailOrUser.email);
  if (!email) return false;
  return ownerEmailAllowlist().includes(email);
}
