/** Split AF venue strings like "Chobani Stadium Fenerbahce Sukru Saracoglu". */
export function splitVenueNames(raw: string): {
  sponsored: string | null;
  historic: string | null;
  primary: string;
} {
  const name = raw.trim();
  if (!name) return { sponsored: null, historic: null, primary: name };

  // "Sponsored Stadium … Historic"
  const stadiumSplit = name.match(
    /^(.+?\bStadium)\s+(.+)$/i
  );
  if (stadiumSplit) {
    const sponsored = stadiumSplit[1].trim();
    const rest = stadiumSplit[2].trim();
    // If rest looks like a club+historic ground, treat as historic/original
    if (rest.length >= 6 && !/^stadium$/i.test(rest)) {
      return {
        sponsored,
        historic: rest,
        // Desk / pitch chrome prefer original (non-sponsored) name
        primary: rest,
      };
    }
  }

  // "Name (also known as X)" / "Name — formerly Y"
  const aka = name.match(/^(.+?)\s*[\(—–-]\s*(?:also known as|formerly|aka)\s*(.+?)\)?$/i);
  if (aka) {
    const current = aka[1].trim();
    const historic = aka[2].trim();
    return {
      sponsored: current,
      historic,
      primary: historic || current,
    };
  }

  return { sponsored: null, historic: null, primary: name };
}

/** Desk / scoreboard label: original/historic when known, else raw. */
export function deskVenueName(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  return splitVenueNames(raw).primary || raw.trim();
}
