/**
 * U&R Show board privacy allowlist.
 * Hard floor: chris@ronniedogmedia.com always allowed.
 * Env UR_SHOW_ALLOWLIST = comma-separated emails (case-insensitive).
 * Misconfig / empty env cannot open U&R to all — floor email remains the only default.
 * demo@pitchline.app / tester@cocomms.online are NEVER on the floor.
 */

export const UR_SHOW_FLOOR_EMAIL = "chris@ronniedogmedia.com";

function normalizeEmail(email: string | null | undefined): string {
  return String(email || "").trim().toLowerCase();
}

/** Parse allowlist from env; always unions the floor email. */
export function urShowAllowlist(): string[] {
  const raw = process.env.UR_SHOW_ALLOWLIST?.trim() ?? "";
  const fromEnv = raw
    ? raw
        .split(",")
        .map((e) => normalizeEmail(e))
        .filter(Boolean)
    : [];
  const set = new Set<string>([normalizeEmail(UR_SHOW_FLOOR_EMAIL), ...fromEnv]);
  return [...set];
}

type EmailLike =
  | string
  | null
  | undefined
  | { email?: string | null };

/**
 * True only when the signed-in user's email is on the U&R allowlist.
 * Accepts a raw email string or a session/user object with `.email`.
 */
export function canUseUrShow(emailOrUser: EmailLike): boolean {
  const email =
    typeof emailOrUser === "string" || emailOrUser == null
      ? normalizeEmail(emailOrUser)
      : normalizeEmail(emailOrUser.email);
  if (!email) return false;
  return urShowAllowlist().includes(email);
}
