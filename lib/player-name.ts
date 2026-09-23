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
 *
 * Applied to EVERY token (first / middle / last) so "Barış Alper Yılmaz"
 * and "Florian Ayé" fold the same as ASCII research / AF short names.
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

/** Role / availability junk that research headings append after the name. */
const ROLE_NOISE = new Set([
  "starting",
  "xi",
  "substitute",
  "squad",
  "member",
  "members",
  "forward",
  "winger",
  "striker",
  "goalkeeper",
  "defender",
  "midfielder",
  "midfield",
  "keeper",
  "utility",
  "injured",
  "suspended",
  "doubtful",
  "inactive",
  "questionable",
  "playmaker",
  "center",
  "centre",
  "right",
  "left",
  "central",
  "attacking",
  "defensive",
  "backup",
  "young",
  "out",
  "gk",
  "df",
  "mf",
  "fw",
  "st",
  "cam",
  "cdm",
  "rb",
  "lb",
  "cb",
  "rw",
  "lw",
]);

/**
 * Strip "(Forward / Winger - Starting XI)" / "— OUT: …" so last-token
 * matching sees the surname, not "xi" / "striker" / "substitute".
 */
export function stripPlayerRoleDecor(name: string): string {
  return name
    .replace(/^#+\s*/, "")
    .replace(/^\*\*|\*\*$/g, "")
    .replace(/^(?:[IVXLCDM]+)[.)]\s+/i, "")
    .replace(/^\d{1,3}[.)]?\s+/, "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(
      /\s*[—–-]\s*(INJURED|SUSPENDED|DOUBTFUL|OUT|Starting\s+XI|Substitute).*$/i,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function significantNameTokens(name: string): string[] {
  const raw = normalizePlayerKey(stripPlayerRoleDecor(name))
    .split(" ")
    .filter(Boolean);
  return raw.filter((t, i) => {
    if (ROLE_NOISE.has(t)) return false;
    if (t.length >= 2) return true;
    // Keep leading initial so "B. Yilmaz" ≠ "A. Yilmaz"
    return i === 0 && t.length === 1;
  });
}

export function lastToken(name: string): string {
  const parts = significantNameTokens(name);
  if (parts.length) return parts[parts.length - 1];
  const raw = normalizePlayerKey(stripPlayerRoleDecor(name)).split(" ").filter(Boolean);
  return raw[raw.length - 1] || "";
}

/**
 * True when names refer to the same player under common AF/desk variants:
 * exact, last-name-only, or initial + last ("L. Shankland" / "Lawrence Shankland").
 * Role suffixes on research headings are stripped first so
 * "Barış Alper Yılmaz (Forward / Winger - Starting XI)" still matches "B. Yilmaz".
 */
export function namesLooselyMatch(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const ca = stripPlayerRoleDecor(a);
  const cb = stripPlayerRoleDecor(b);
  const na = normalizePlayerKey(ca);
  const nb = normalizePlayerKey(cb);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) {
    // Avoid short false positives ("a" inside names)
    if (Math.min(na.length, nb.length) >= 4) return true;
  }
  const partsA = significantNameTokens(ca);
  const partsB = significantNameTokens(cb);
  const lastA = partsA[partsA.length - 1];
  const lastB = partsB[partsB.length - 1];
  if (!lastA || lastA !== lastB) return false;
  if (partsA.length === 1 || partsB.length === 1) return true;
  const initA = partsA[0][0];
  const initB = partsB[0][0];
  return Boolean(initA && initA === initB);
}

export type NamedSquadMember = { id: string; name: string };

/**
 * Pick the unique squad player for a research heading / first-line.
 * Prefers last significant surname + optional first-name/initial fold.
 * Shared surnames (Yılmaz ×3) require a first-initial hit; ambiguous → null.
 */
export function matchSquadPlayer<T extends NamedSquadMember>(
  heading: string,
  players: T[]
): T | null {
  const cleaned = stripPlayerRoleDecor(heading);
  if (!cleaned || cleaned.length < 2) return null;
  const hToks = significantNameTokens(cleaned);
  const hSur = hToks[hToks.length - 1] || "";
  const hInit = hToks[0]?.[0] || "";

  type Scored = { player: T; score: number };
  const hits: Scored[] = [];

  for (const p of players) {
    const pToks = significantNameTokens(p.name);
    const pSur = pToks[pToks.length - 1] || lastToken(p.name);
    const pInit = pToks[0]?.[0] || "";
    if (!pSur) continue;

    if (namesLooselyMatch(cleaned, p.name) || namesLooselyMatch(heading, p.name)) {
      hits.push({ player: p, score: 100 + normalizePlayerKey(p.name).length });
      continue;
    }

    if (hSur && pSur === hSur && pSur.length >= 3) {
      if (hToks.length >= 2 && hInit && pInit && hInit !== pInit) continue;
      const score =
        hToks.length >= 2 && hInit && pInit && hInit === pInit
          ? 40 + pSur.length
          : pSur.length;
      hits.push({ player: p, score });
    }
  }

  if (!hits.length) return null;
  hits.sort((a, b) => b.score - a.score);
  const best = hits[0];
  const tied = hits.filter((h) => h.score === best.score);
  if (tied.length > 1) {
    // Shared surname, no first-name fold — skip rather than attach to A. Yilmaz
    return null;
  }
  return best.player;
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

/** Desk Field Settings: how pitch tokens render a player's name. */
export type NameFormat = "surname" | "initial_last" | "first_last";

/**
 * Format a full name for pitch cards.
 * - surname: last token (current historic default)
 * - initial_last: "J. SILVA" from "João Silva" / "João Pedro Silva"
 * - first_last: first token + last token ("João Silva")
 */
export function formatNameByFormat(
  fullName: string,
  nameFormat: NameFormat = "surname"
): string {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  const first = parts[0];
  const last = parts[parts.length - 1].replace(/\.+$/g, "");
  if (!last) return first.replace(/\.+$/g, "") || first;

  if (nameFormat === "surname") return last;

  if (nameFormat === "initial_last") {
    const initialSrc = first.replace(/\.+$/g, "");
    const initial = initialSrc.charAt(0);
    if (!initial) return last;
    return `${initial.toUpperCase()}. ${last}`;
  }

  // first_last
  if (parts.length === 1) return first.replace(/\.+$/g, "") || first;
  return `${first} ${last}`;
}

/**
 * Pitch token name: manual Card name (displayName) always wins;
 * otherwise format `name` per desk nameFormat.
 */
export function formatPitchCardName(
  player: { name?: string | null; displayName?: string | null },
  nameFormat: NameFormat = "surname"
): string {
  const override = (player.displayName ?? "").trim();
  if (override) return override;
  return formatNameByFormat(player.name || "", nameFormat);
}
