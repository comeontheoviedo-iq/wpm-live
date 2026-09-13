/** Loose player-name matching for AF ↔ desk (e.g. "Lawrence Shankland" ↔ "L. Shankland"). */

/**
 * Fold both sides the same way before compare:
 * NFKD + strip combining marks + Turkish İ/I/ı/i + ß + casefold.
 *
 * Critical: Turkish dotless ı (U+0131) does NOT NFD-decompose. The old path
 * lowercased then stripped non-[a-z], turning "Çakır"/"Yılmaz" into
 * "cak r"/"y lmaz" so they missed ASCII research headings like "Cakir"/"Yilmaz".
 * Other accents (é, ü, ö, ç, ş, ğ, …) already decomposed — which is why
 * "some accented names worked" while ı-names did not.
 */
export function normalizePlayerKey(name: string): string {
  return (
    name
      // German ß/ẞ are not usefully NFD-decomposed for matching
      .replace(/ß/g, "ss")
      .replace(/ẞ/g, "ss")
      // Turkish I-family BEFORE casefold — JS default toLowerCase leaves ı as
      // non-a-z (→ space) and maps İ → i+combining-dot (ok after strip, but
      // fold explicitly so both sides always meet on ASCII "i").
      .replace(/İ/g, "i")
      .replace(/I/g, "i")
      .replace(/ı/g, "i")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

export function lastToken(name: string): string {
  const parts = normalizePlayerKey(name).split(" ").filter(Boolean);
  return parts[parts.length - 1] || "";
}

/**
 * True when names refer to the same player under common AF/desk variants:
 * exact, last-name-only, or initial + last ("L. Shankland" / "Lawrence Shankland").
 */
export function namesLooselyMatch(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const na = normalizePlayerKey(a);
  const nb = normalizePlayerKey(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) {
    // Avoid short false positives ("a" inside names)
    if (Math.min(na.length, nb.length) >= 4) return true;
  }
  const partsA = na.split(" ").filter(Boolean);
  const partsB = nb.split(" ").filter(Boolean);
  const lastA = partsA[partsA.length - 1];
  const lastB = partsB[partsB.length - 1];
  if (!lastA || lastA !== lastB) return false;
  if (partsA.length === 1 || partsB.length === 1) return true;
  const initA = partsA[0][0];
  const initB = partsB[0][0];
  return Boolean(initA && initA === initB);
}

/** Parse AF-style sub description: "Substitution 1 — Out Name (In Name)". */
export function parseSubDescription(description: string): {
  outName: string | null;
  inName: string | null;
} {
  const outM = description.match(/—\s*([^(\n]+)/);
  const inM = description.match(/\(([^)]+)\)\s*$/);
  return {
    outName: outM?.[1]?.trim() || null,
    inName: inM?.[1]?.trim() || null,
  };
}
