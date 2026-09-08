/** Loose player-name matching for AF ↔ desk (e.g. "Lawrence Shankland" ↔ "L. Shankland"). */

export function normalizePlayerKey(name: string): string {
  return name
    .toLowerCase()
    // German ß is not NFD-decomposed; fold to ss before stripping non-ascii
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
