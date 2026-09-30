/**
 * Client-safe SupportPing type constants (no email / prisma / Node imports).
 * Keep ask-report UI importing from here — never from support-ping-alert.
 */

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
  if (s === "xiwrong" || s === "xi_wrong") return "xi_wrong";
  return null;
}
