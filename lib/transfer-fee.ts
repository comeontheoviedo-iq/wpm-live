/**
 * AF /transfers `type` is the fee string ("€45M", "Free", "Loan", "N/A").
 * Never invent — unknown/empty → em dash.
 */
export function formatTransferFee(
  type: string | null | undefined
): string {
  const t = String(type || "").trim();
  if (!t) return "—";
  if (/^n\/?a$/i.test(t) || t === "-" || t === "–" || t === "—") return "—";
  return t;
}
