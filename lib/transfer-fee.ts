/**
 * API-Football /transfers exposes fee/deal info in `type`:
 * money ("€ 45M", "9M €"), labels ("Free", "Loan", "Transfer", "N/A"), etc.
 * Never invent amounts — only normalise / surface what AF gave us.
 */

export type TransferFeeKind =
  | "money"
  | "free"
  | "loan"
  | "loan_return"
  | "undisclosed"
  | "unknown";

const UNKNOWN_RE = /^(n\/?a|null|undefined|-|–|—|\.)$/i;

function strip(raw: string | null | undefined): string {
  return String(raw ?? "")
    .replace(/\u00a0/g, " ")
    .trim();
}

/** Detect money-ish AF type strings (digits + currency/magnitude). */
export function isMoneyTransferFee(type: string | null | undefined): boolean {
  const t = strip(type);
  if (!t || UNKNOWN_RE.test(t)) return false;
  if (!/\d/.test(t)) return false;
  // €45M, € 45 M, 45M €, £12.5m, $10m, 12.5 million, 500K
  if (/[€£$]/.test(t)) return true;
  if (/\d([\d.,]*)\s*(million|millions|thousand|thousands)\b/i.test(t)) return true;
  if (/\d([\d.,]*)\s*[KkMm]\b/.test(t)) return true;
  if (/\b[KkMm]\s*\d/.test(t)) return true;
  return false;
}

export function transferFeeKind(type: string | null | undefined): TransferFeeKind {
  const t = strip(type);
  if (!t || UNKNOWN_RE.test(t)) return "unknown";
  if (isMoneyTransferFee(t)) return "money";

  const lower = t.toLowerCase();
  if (
    /^(free(\s+transfer|\s+agent)?|bosman|released|contract\s+expired|end\s+of\s+contract)$/i.test(
      t
    ) ||
    lower === "free agent"
  ) {
    return "free";
  }
  if (/return(ed)?\s+from\s+loan|back\s+from\s+loan|loan\s+return|end\s+of\s+loan/i.test(t)) {
    return "loan_return";
  }
  if (/^loan\b|loan\s+deal|temporary/i.test(t)) return "loan";
  // AF often uses bare "Transfer" / "Swap" when the fee is not published
  if (/^(transfer|permanent|swap|undisclosed|unknown)$/i.test(t)) return "undisclosed";
  return "undisclosed";
}

/**
 * Parse AF money strings into a clean commentator label (€70m, €500k).
 * Returns null when the string is not a usable amount.
 */
export function parseTransferFeeAmount(
  type: string | null | undefined
): { currency: "€" | "£" | "$"; amount: number; unit: "m" | "k" | "" } | null {
  const t = strip(type);
  if (!isMoneyTransferFee(t)) return null;

  let currency: "€" | "£" | "$" = "€";
  if (/£/.test(t)) currency = "£";
  else if (/\$/.test(t)) currency = "$";

  const millionWord = t.match(/([\d]+(?:[.,][\d]+)?)\s*(million|millions)\b/i);
  if (millionWord) {
    const amount = Number(millionWord[1].replace(",", "."));
    if (!Number.isFinite(amount)) return null;
    return { currency, amount, unit: "m" };
  }
  const thousandWord = t.match(/([\d]+(?:[.,][\d]+)?)\s*(thousand|thousands)\b/i);
  if (thousandWord) {
    const amount = Number(thousandWord[1].replace(",", "."));
    if (!Number.isFinite(amount)) return null;
    return { currency, amount, unit: "k" };
  }

  // € 45.6M / 45,6M € / €45M / 9M € / € 500K
  const m =
    t.match(/[€£$]\s*([\d]+(?:[.,][\d]+)?)\s*([KkMm])\b/) ||
    t.match(/\b([\d]+(?:[.,][\d]+)?)\s*([KkMm])\s*[€£$]/) ||
    t.match(/\b([\d]+(?:[.,][\d]+)?)\s*([KkMm])\b/) ||
    t.match(/[€£$]\s*([\d]+(?:[.,][\d]+)?)\b/);

  if (!m) return null;
  const amount = Number(m[1].replace(",", "."));
  if (!Number.isFinite(amount)) return null;
  const mag = (m[2] || "").toLowerCase();
  if (mag === "m") return { currency, amount, unit: "m" };
  if (mag === "k") return { currency, amount, unit: "k" };
  // bare number with currency — treat large values as euros, format as-is in millions if >= 1000
  if (amount >= 1_000_000) return { currency, amount: amount / 1_000_000, unit: "m" };
  if (amount >= 1000) return { currency, amount: amount / 1000, unit: "k" };
  return { currency, amount, unit: "" };
}

function formatParsedAmount(
  parsed: NonNullable<ReturnType<typeof parseTransferFeeAmount>>
): string {
  const n = parsed.amount;
  const rounded =
    parsed.unit === "m" || parsed.unit === "k"
      ? Number.isInteger(n) || Math.abs(n - Math.round(n)) < 1e-9
        ? String(Math.round(n))
        : String(Math.round(n * 10) / 10)
      : String(n);
  if (parsed.unit === "m") return `${parsed.currency}${rounded}m`;
  if (parsed.unit === "k") return `${parsed.currency}${rounded}k`;
  return `${parsed.currency}${rounded}`;
}

/**
 * Commentator-facing fee label. Empty / N/A → em dash.
 * Money amounts normalised; Free / Loan / Undisclosed kept clear.
 */
export function formatTransferFee(type: string | null | undefined): string {
  const t = strip(type);
  if (!t || UNKNOWN_RE.test(t)) return "—";

  const kind = transferFeeKind(t);
  if (kind === "money") {
    const parsed = parseTransferFeeAmount(t);
    if (parsed) return formatParsedAmount(parsed);
    // Fall through: keep AF string if we couldn't parse cleanly
    return t.replace(/\s+/g, " ");
  }
  if (kind === "free") return "Free";
  if (kind === "loan") return "Loan";
  if (kind === "loan_return") return "Loan return";
  if (kind === "undisclosed") return "Undisclosed";
  return "—";
}

export type TransferFeeFields = {
  type?: string | null;
  fee?: string | null;
  transferFee?: string | null;
  amount?: string | number | null;
};

/** Pull the best raw fee string from an AF transfer object (or our mapped row). */
export function rawTransferFeeFrom(fields: TransferFeeFields | null | undefined): string | null {
  if (!fields) return null;
  const candidates = [fields.type, fields.fee, fields.transferFee, fields.amount];
  for (const c of candidates) {
    if (c == null) continue;
    const s = strip(String(c));
    if (s && !UNKNOWN_RE.test(s)) return s;
  }
  return null;
}

export type TransferMoveLike = {
  date?: string | null;
  type?: string | null;
  fee?: string | null;
  transferFee?: string | null;
  from?: string | { name?: string | null } | null;
  to?: string | { name?: string | null } | null;
  player?: string | null;
};

function clubName(side: TransferMoveLike["from"]): string {
  if (!side) return "";
  if (typeof side === "string") return side.trim().toLowerCase();
  return String(side.name || "").trim().toLowerCase();
}

/**
 * Prefer an explicit money fee on this row; else reuse a money fee from another
 * row with the same player + from→to (AF sometimes stores amount on one duplicate
 * and "Transfer" on another).
 */
export function resolveTransferFeeRaw(
  row: TransferMoveLike,
  siblings: TransferMoveLike[] = []
): string | null {
  const own = rawTransferFeeFrom(row);
  if (own && isMoneyTransferFee(own)) return own;
  if (own && transferFeeKind(own) !== "undisclosed" && transferFeeKind(own) !== "unknown") {
    return own;
  }

  const from = clubName(row.from);
  const to = clubName(row.to);
  const player = String(row.player || "").trim().toLowerCase();
  if (!from || !to) return own;

  for (const s of siblings) {
    if (player && String(s.player || "").trim().toLowerCase() !== player) continue;
    if (clubName(s.from) !== from || clubName(s.to) !== to) continue;
    const raw = rawTransferFeeFrom(s);
    if (raw && isMoneyTransferFee(raw)) return raw;
  }
  return own;
}

/**
 * Club transfer history: keep recent activity AND ensure money-fee rows from the
 * lookback window are not drowned out by Loan / Free-agent / "Transfer" noise.
 */
export function selectClubTransferHistory<
  T extends {
    date: string;
    type: string | null;
    player: string;
    from: string;
    to: string;
  },
>(
  rows: T[],
  opts?: { limit?: number; moneyLookbackYears?: number; recentWindow?: number }
): T[] {
  const limit = opts?.limit ?? 60;
  const moneyLookbackYears = opts?.moneyLookbackYears ?? 6;
  const recentWindow = opts?.recentWindow ?? 50;

  const deduped: T[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (!r.date) continue;
    const key = `${r.date}|${r.player.toLowerCase()}|${r.from.toLowerCase()}|${r.to.toLowerCase()}|${(r.type || "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }

  // Resolve fees across siblings before ranking / display
  const withResolved = deduped.map((r) => {
    const resolved = resolveTransferFeeRaw(r, deduped);
    return resolved && resolved !== r.type ? { ...r, type: resolved } : r;
  });

  const byDate = [...withResolved].sort((a, b) => b.date.localeCompare(a.date));
  const recent = byDate.slice(0, recentWindow);

  const cutoffYear = new Date().getUTCFullYear() - moneyLookbackYears;
  const cutoff = `${cutoffYear}-01-01`;
  const moneyRows = byDate.filter(
    (r) => r.date >= cutoff && isMoneyTransferFee(r.type)
  );

  const merged: T[] = [];
  const mSeen = new Set<string>();
  const push = (r: T) => {
    const key = `${r.date}|${r.player.toLowerCase()}|${r.from.toLowerCase()}|${r.to.toLowerCase()}`;
    if (mSeen.has(key)) {
      // Prefer money over label when same move appears twice
      const idx = merged.findIndex(
        (x) =>
          `${x.date}|${x.player.toLowerCase()}|${x.from.toLowerCase()}|${x.to.toLowerCase()}` ===
          key
      );
      if (idx >= 0 && isMoneyTransferFee(r.type) && !isMoneyTransferFee(merged[idx].type)) {
        merged[idx] = r;
      }
      return;
    }
    mSeen.add(key);
    merged.push(r);
  };

  for (const r of moneyRows) push(r);
  for (const r of recent) push(r);

  // Always retain money-fee rows; fill remaining slots with recent activity.
  // A plain date-slice would drop older fees again under Loan/"Transfer" noise.
  const moneyKept = merged.filter((r) => isMoneyTransferFee(r.type));
  const rest = merged
    .filter((r) => !isMoneyTransferFee(r.type))
    .sort((a, b) => b.date.localeCompare(a.date));
  const moneyCap = Math.min(moneyKept.length, Math.max(20, Math.floor(limit * 0.45)));
  const keptMoney = [...moneyKept]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, moneyCap);
  const restSlots = Math.max(0, limit - keptMoney.length);
  const keptRest = rest.slice(0, restSlots);
  return [...keptMoney, ...keptRest].sort((a, b) => b.date.localeCompare(a.date));
}

/** Apply sibling fee backfill then format — used by player career lists. */
export function formatTransferFeeForRow(
  row: TransferMoveLike,
  siblings: TransferMoveLike[] = []
): string {
  return formatTransferFee(resolveTransferFeeRaw(row, siblings));
}
