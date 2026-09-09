/**
 * Match kit / strip colours — from feed lineups when available.
 * AF shape: team.colors.{player|goalkeeper}.{primary,number,border} (hex without #).
 */

export type KitSwatch = {
  primary: string | null;
  number: string | null;
  border: string | null;
};

export type MatchKitColors = {
  player: KitSwatch;
  goalkeeper: KitSwatch;
};

const EMPTY_SWATCH: KitSwatch = { primary: null, number: null, border: null };

export function emptyKit(): MatchKitColors {
  return { player: { ...EMPTY_SWATCH }, goalkeeper: { ...EMPTY_SWATCH } };
}

/** Expand 3/6-digit hex (with or without #) → `#rrggbb`, or null. */
export function normalizeHex(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(t)) return `#${t.toLowerCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(t)) {
    const [a, b, c] = t.toLowerCase().split("");
    return `#${a}${a}${b}${b}${c}${c}`;
  }
  return null;
}

function relativeLuminance(hex: string): number {
  const n = normalizeHex(hex);
  if (!n) return 0;
  const r = parseInt(n.slice(1, 3), 16) / 255;
  const g = parseInt(n.slice(3, 5), 16) / 255;
  const b = parseInt(n.slice(5, 7), 16) / 255;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function parseSwatch(raw: unknown): KitSwatch {
  if (!raw || typeof raw !== "object") return { ...EMPTY_SWATCH };
  const o = raw as Record<string, unknown>;
  return {
    primary: normalizeHex(o.primary),
    number: normalizeHex(o.number),
    border: normalizeHex(o.border),
  };
}

/** Parse feed `team.colors` object into normalised kit colours. */
export function parseAfTeamColors(colors: unknown): MatchKitColors | null {
  if (!colors || typeof colors !== "object") return null;
  const o = colors as Record<string, unknown>;
  const player = parseSwatch(o.player);
  const goalkeeper = parseSwatch(o.goalkeeper ?? o.goalKeeper);
  if (!player.primary && !goalkeeper.primary) return null;
  return { player, goalkeeper };
}

/** Parse stored Match.homeKitJson / awayKitJson ("" = checked empty). */
export function parseStoredKit(
  json: string | null | undefined
): MatchKitColors | null {
  if (json == null) return null;
  const trimmed = json.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    // Support both our shape and raw AF shape
    if (o.player || o.goalkeeper || o.goalKeeper) {
      return parseAfTeamColors(parsed);
    }
    return null;
  } catch {
    return null;
  }
}

export function serializeKit(kit: MatchKitColors | null): string {
  if (!kit) return "";
  return JSON.stringify({
    player: {
      primary: kit.player.primary?.replace(/^#/, "") ?? null,
      number: kit.player.number?.replace(/^#/, "") ?? null,
      border: kit.player.border?.replace(/^#/, "") ?? null,
    },
    goalkeeper: {
      primary: kit.goalkeeper.primary?.replace(/^#/, "") ?? null,
      number: kit.goalkeeper.number?.replace(/^#/, "") ?? null,
      border: kit.goalkeeper.border?.replace(/^#/, "") ?? null,
    },
  });
}

/** Side chrome / scorebug — outfield strip primary, else club default. */
export function sidePlayingColor(
  kit: MatchKitColors | null | undefined,
  clubPrimary: string
): string {
  return kit?.player.primary || normalizeHex(clubPrimary) || clubPrimary || "#94a3b8";
}

/**
 * Card accents for a player token.
 * Prefer GK strip when present; shirt # uses number colour with contrast fallback.
 */
export function cardKitAccent(
  kit: MatchKitColors | null | undefined,
  isGk: boolean,
  clubPrimary: string
): { strip: string; number: string; chip: string; chipTrim: string } {
  const fallback = normalizeHex(clubPrimary) || clubPrimary || "#94a3b8";
  const swatch =
    isGk && kit?.goalkeeper.primary
      ? kit.goalkeeper
      : kit?.player.primary
        ? kit.player
        : null;
  const truePrimary = swatch?.primary || fallback;
  let strip = truePrimary;

  // Number colour: prefer feed number if visible on dark charcoal card
  const candidates = [
    swatch?.number,
    swatch?.border,
    swatch?.primary,
    fallback,
    "#f8fafc",
  ].filter(Boolean) as string[];
  let number = strip;
  for (const c of candidates) {
    if (relativeLuminance(c) >= 0.18) {
      number = c;
      break;
    }
  }
  // If strip itself is very dark, keep a light number
  if (relativeLuminance(number) < 0.12) number = "#f8fafc";

  // Jersey chip keeps match-night truth (even navy) — edge may lift for charcoal.
  const chip = truePrimary;
  const chipTrim =
    (swatch?.border && relativeLuminance(swatch.border) >= 0.12
      ? swatch.border
      : null) ||
    (swatch?.number && relativeLuminance(swatch.number) >= 0.12
      ? swatch.number
      : null) ||
    number;

  // Charcoal cards swallow navy/black thin edges — lift edge/hairline only.
  if (relativeLuminance(strip) < 0.1) {
    const edgeAlts = [
      swatch?.border,
      swatch?.number,
      number,
      "#94a3b8",
    ].filter(Boolean) as string[];
    for (const c of edgeAlts) {
      if (relativeLuminance(c) >= 0.12) {
        strip = c;
        break;
      }
    }
  }

  return { strip, number, chip, chipTrim };
}


/** Default club teal — treat as unset when upgrading from feed kits. */
export const DEFAULT_CLUB_PRIMARY = "#0d9488";

/** Legacy "" or explicit checked marker — do not keep re-fetching forever. */
export function isCheckedEmptyKit(json: string | null | undefined): boolean {
  if (json == null) return false;
  const t = json.trim();
  if (t === "") return false; // legacy empty — still needs last-known fallback pass
  try {
    const o = JSON.parse(t) as Record<string, unknown>;
    return Boolean(o && o.checked === true);
  } catch {
    return false;
  }
}

/** True when Match kit JSON still needs a hydrate attempt. */
export function kitNeedsHydration(json: string | null | undefined): boolean {
  if (json == null) return true;
  const t = json.trim();
  if (t === "") return true; // legacy checked-empty without last-known fallback
  if (isCheckedEmptyKit(t)) return false;
  return parseStoredKit(t) == null;
}

export function serializeCheckedEmptyKit(): string {
  return JSON.stringify({ checked: true });
}

/** True when both sides share the same outfield primary (cards look identical). */
export function kitsSharePrimary(
  homeJson: string | null | undefined,
  awayJson: string | null | undefined
): boolean {
  const h = parseStoredKit(homeJson);
  const a = parseStoredKit(awayJson);
  const hp = h?.player.primary?.toLowerCase();
  const ap = a?.player.primary?.toLowerCase();
  return Boolean(hp && ap && hp === ap);
}

export function kitDistinctTried(json: string | null | undefined): boolean {
  if (!json) return false;
  try {
    const o = JSON.parse(json.trim()) as Record<string, unknown>;
    return Boolean(o && o.distinctTried === true);
  } catch {
    return false;
  }
}

export function markKitDistinctTried(json: string): string {
  try {
    const o = JSON.parse(json) as Record<string, unknown>;
    if (!o || typeof o !== "object") return json;
    return JSON.stringify({ ...o, distinctTried: true });
  } catch {
    return json;
  }
}



/** Resolve playing colours + kits for a match row + clubs. */
export function playingColorsForMatch(match: {
  homeKitJson?: string | null;
  awayKitJson?: string | null;
  homeClub: { primaryColor: string };
  awayClub: { primaryColor: string };
}): {
  homeColor: string;
  awayColor: string;
  homeKit: MatchKitColors | null;
  awayKit: MatchKitColors | null;
} {
  const homeKit = parseStoredKit(match.homeKitJson);
  const awayKit = parseStoredKit(match.awayKitJson);
  return {
    homeKit,
    awayKit,
    homeColor: sidePlayingColor(homeKit, match.homeClub.primaryColor),
    awayColor: sidePlayingColor(awayKit, match.awayClub.primaryColor),
  };
}


/**
 * Match-night kit overrides when AF returns colors:null.
 * Prefer tonight's truth over wrong last-known domestic strips.
 * Keyed by apiFootballFixtureId.
 */
export const MATCH_KIT_OVERRIDES: Record<
  number,
  { home: MatchKitColors; away: MatchKitColors; note: string }
> = {
  // Stuttgart vs Viking — UCL 9 Sep 2026
  // Stuttgart: CL home white + red Brustring. Viking: CL European home navy + pink
  // (not domestic navy/white — clash + match-night photos).
  1635741: {
    note: "Stuttgart CL white/red home; Viking CL navy/pink European home",
    home: {
      player: { primary: "#ffffff", number: "#e11d48", border: "#e11d48" },
      goalkeeper: { primary: "#111827", number: "#f8fafc", border: "#f8fafc" },
    },
    away: {
      player: { primary: "#0b1b33", number: "#ff4fa3", border: "#ff4fa3" },
      goalkeeper: { primary: "#f9a8d4", number: "#0b1b33", border: "#0b1b33" },
    },
  },
};

export function kitOverrideForFixture(
  fixtureId: number | null | undefined
): { home: MatchKitColors; away: MatchKitColors; note: string } | null {
  if (fixtureId == null || !Number.isFinite(fixtureId)) return null;
  return MATCH_KIT_OVERRIDES[fixtureId] || null;
}

/** True when stored kit already matches a fixture override (skip rewrite noise). */
export function kitMatchesOverride(
  json: string | null | undefined,
  override: MatchKitColors
): boolean {
  const cur = parseStoredKit(json);
  if (!cur?.player.primary || !override.player.primary) return false;
  return (
    cur.player.primary.toLowerCase() === override.player.primary.toLowerCase() &&
    (cur.player.number || "").toLowerCase() ===
      (override.player.number || "").toLowerCase()
  );
}
