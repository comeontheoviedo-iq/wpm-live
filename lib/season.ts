/**
 * API-Football season = starting year of the campaign.
 * European leagues: Aug–May → season 2026 covers Aug 2026–May 2027.
 * Calendar-year leagues (MLS, etc.) still use the calendar year; we use the
 * European rule as the default for our priority competitions.
 */

/** YYYY-MM-DD or Date → European football season starting year. */
export function europeanSeasonYear(dateInput: string | Date): number {
  const d =
    typeof dateInput === "string"
      ? parseDateOnly(dateInput)
      : new Date(dateInput);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth(); // 0 = Jan
  // Jul (6) onwards belongs to the new season starting that calendar year.
  return m >= 6 ? y : y - 1;
}

function parseDateOnly(s: string): Date {
  // Prefer UTC midnight for YYYY-MM-DD so timezone doesn't shift the day.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
  if (m) {
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  }
  return new Date(s);
}

/** Primary season plus adjacent years to try when a league+date search is empty. */
export function seasonCandidates(dateInput: string | Date): number[] {
  const primary = europeanSeasonYear(dateInput);
  const set = new Set([primary, primary - 1, primary + 1]);
  return [...set];
}

export function todayDateInput(timeZone = "Europe/London"): string {
  // en-CA → YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
