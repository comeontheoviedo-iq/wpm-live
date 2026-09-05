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
        primary: sponsored,
      };
    }
  }

  // "Name (also known as X)" / "Name — formerly Y"
  const aka = name.match(/^(.+?)\s*[\(—–-]\s*(?:also known as|formerly|aka)\s*(.+?)\)?$/i);
  if (aka) {
    return {
      sponsored: aka[1].trim(),
      historic: aka[2].trim(),
      primary: aka[1].trim(),
    };
  }

  return { sponsored: null, historic: null, primary: name };
}
