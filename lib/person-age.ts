/**
 * Single source of truth for player / coach ages.
 *
 * API-Football's integer `age` lags after birthdays (stored once, rarely
 * overwritten). Calendar age from DOB is authoritative.
 *
 * asOf defaults to **today, UTC calendar date** (viewing time) — not match
 * kickoff. Kickoff would disagree with research notes that compute "today"
 * and with the dossier header on any desk opened after a birthday.
 * Pass `asOf` only for tests or an explicit match-day snapshot.
 */

export function parseBirthDateParts(
  birthDate: string | null | undefined
): { y: number; m: number; d: number } | null {
  if (!birthDate) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(birthDate).trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

/** Whole years completed on `asOf`'s UTC calendar date. */
export function ageFromBirthDate(
  birthDate: string | null | undefined,
  asOf: Date = new Date()
): number | null {
  const b = parseBirthDateParts(birthDate);
  if (!b || !Number.isFinite(asOf.getTime())) return null;
  const y = asOf.getUTCFullYear();
  const mo = asOf.getUTCMonth() + 1;
  const d = asOf.getUTCDate();
  let age = y - b.y;
  if (mo < b.m || (mo === b.m && d < b.d)) age -= 1;
  if (age < 0 || age > 120) return null;
  return age;
}

export function resolvePersonAge(
  person: {
    birthDate?: string | null;
    age?: number | null;
    birth?: { date?: string | null } | null;
  } | null | undefined,
  asOf: Date = new Date()
): number | null {
  if (!person) return null;
  const fromDob = ageFromBirthDate(
    person.birthDate || person.birth?.date || null,
    asOf
  );
  if (fromDob != null) return fromDob;
  const stored = person.age;
  if (stored != null && Number.isFinite(stored) && stored > 0 && stored <= 120) {
    return Math.round(stored);
  }
  return null;
}

/**
 * Rewrite "N-year-old" / "N year old" mentions so a verdict cannot disagree
 * with the structured age. Leaves other numbers (apps, shirt) alone.
 */
export function alignAgeMentions(
  text: string | null | undefined,
  age: number | null
): string | null {
  if (text == null) return null;
  if (age == null || !Number.isFinite(age)) return text;
  return text.replace(
    /\b\d{1,2}(\s*[-–]?\s*years?-?\s*old)\b/gi,
    `${Math.round(age)}$1`
  );
}
