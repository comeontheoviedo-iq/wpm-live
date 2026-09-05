/** Nationality / country → ISO 3166-1 alpha-2 for flagcdn. */
const NAME_TO_ISO: Record<string, string> = {
  england: "gb-eng",
  scotland: "gb-sct",
  wales: "gb-wls",
  "northern ireland": "gb-nir",
  "united kingdom": "gb",
  uk: "gb",
  "great britain": "gb",
  france: "fr",
  germany: "de",
  spain: "es",
  italy: "it",
  portugal: "pt",
  netherlands: "nl",
  belgium: "be",
  switzerland: "ch",
  austria: "at",
  poland: "pl",
  denmark: "dk",
  sweden: "se",
  norway: "no",
  finland: "fi",
  ireland: "ie",
  "republic of ireland": "ie",
  croatia: "hr",
  serbia: "rs",
  slovenia: "si",
  slovakia: "sk",
  "czech republic": "cz",
  czechia: "cz",
  hungary: "hu",
  romania: "ro",
  bulgaria: "bg",
  greece: "gr",
  turkey: "tr",
  "türkiye": "tr",
  russia: "ru",
  ukraine: "ua",
  brazil: "br",
  argentina: "ar",
  uruguay: "uy",
  chile: "cl",
  colombia: "co",
  ecuador: "ec",
  paraguay: "py",
  peru: "pe",
  venezuela: "ve",
  mexico: "mx",
  "united states": "us",
  usa: "us",
  canada: "ca",
  japan: "jp",
  "south korea": "kr",
  korea: "kr",
  china: "cn",
  australia: "au",
  "new zealand": "nz",
  "ivory coast": "ci",
  "côte d'ivoire": "ci",
  "cote d'ivoire": "ci",
  senegal: "sn",
  nigeria: "ng",
  ghana: "gh",
  cameroon: "cm",
  mali: "ml",
  morocco: "ma",
  algeria: "dz",
  tunisia: "tn",
  egypt: "eg",
  "south africa": "za",
  congo: "cd",
  "dr congo": "cd",
  angola: "ao",
  guinea: "gn",
  gabon: "ga",
  bosnia: "ba",
  "bosnia and herzegovina": "ba",
  albania: "al",
  macedonia: "mk",
  "north macedonia": "mk",
  iceland: "is",
  luxembourg: "lu",
  georgia: "ge",
  armenia: "am",
  israel: "il",
  iran: "ir",
  iraq: "iq",
  "saudi arabia": "sa",
  qatar: "qa",
  uae: "ae",
  "united arab emirates": "ae",
  jamaica: "jm",
  haiti: "ht",
  suriname: "sr",
  martinique: "mq",
  guadeloupe: "gp",
  "french guiana": "gf",
  eng: "gb-eng",
  sco: "gb-sct",
  wal: "gb-wls",
  nir: "gb-nir",
  fra: "fr",
  ger: "de",
  deu: "de",
  spa: "es",
  esp: "es",
  ita: "it",
  por: "pt",
  ned: "nl",
  nld: "nl",
  bel: "be",
  sui: "ch",
  che: "ch",
  aut: "at",
  pol: "pl",
  den: "dk",
  dnk: "dk",
  swe: "se",
  nor: "no",
  fin: "fi",
  irl: "ie",
  cro: "hr",
  srb: "rs",
  svn: "si",
  svk: "sk",
  cze: "cz",
  hun: "hu",
  rou: "ro",
  bul: "bg",
  gre: "gr",
  tur: "tr",
  rus: "ru",
  ukr: "ua",
  bra: "br",
  arg: "ar",
  uru: "uy",
  chi: "cl",
  col: "co",
  ecu: "ec",
  mex: "mx",
  can: "ca",
  jpn: "jp",
  kor: "kr",
  aus: "au",
  civ: "ci",
  sen: "sn",
  nga: "ng",
  gha: "gh",
  cmr: "cm",
  mar: "ma",
  alg: "dz",
  tun: "tn",
  egy: "eg",
  unk: "",
};

export function nationalityToIso(nationality?: string | null): string | null {
  if (!nationality) return null;
  const raw = nationality.trim();
  if (!raw || raw.toUpperCase() === "UNK") return null;
  if (/^[a-z]{2}$/i.test(raw)) return raw.toLowerCase();
  if (/^[a-z]{2}-[a-z]{3}$/i.test(raw)) return raw.toLowerCase();
  const key = raw.toLowerCase();
  if (NAME_TO_ISO[key]) return NAME_TO_ISO[key];
  // 3-letter FIFA-ish
  if (/^[a-z]{3}$/i.test(raw) && NAME_TO_ISO[key]) return NAME_TO_ISO[key];
  return null;
}

export function flagUrl(nationality?: string | null, w = 16): string | null {
  const iso = nationalityToIso(nationality);
  if (!iso) return null;
  const h = Math.round((w * 12) / 16);
  return `https://flagcdn.com/${w}x${h}/${iso}.png`;
}

export function posCode(position?: string | null, slotLabel?: string | null): string {
  const slot = (slotLabel || "").trim().toUpperCase();
  if (slot && slot.length <= 4) return slot;
  const p = (position || "").trim().toUpperCase();
  if (!p) return "—";
  if (["GK", "CB", "LB", "RB", "LWB", "RWB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "CF", "ST", "SS"].includes(p))
    return p;
  if (p === "G" || p.startsWith("GOAL")) return "GK";
  if (p === "D" || p === "DEF" || p.startsWith("DEF")) return slot || "CB";
  if (p === "M" || p === "MID" || p.startsWith("MID")) return slot || "CM";
  if (p === "F" || p === "FWD" || p.startsWith("ATT") || p.startsWith("FOR")) return slot || "ST";
  return p.slice(0, 3);
}

export function lastNameOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  // "D. Greif" / "L. Openda" → last token
  return parts[parts.length - 1].replace(/\./g, "");
}

export function formatHeight(cm?: number | null): string {
  if (cm == null || !Number.isFinite(cm)) return "—";
  return String(Math.round(cm));
}

export function formatWeight(kg?: number | null): string {
  if (kg == null || !Number.isFinite(kg)) return "—";
  return String(Math.round(kg));
}

export function formatFoot(foot?: string | null): string {
  if (!foot) return "—";
  const f = foot.trim().toLowerCase();
  if (f.startsWith("l")) return "L";
  if (f.startsWith("r")) return "R";
  if (f.startsWith("b")) return "B";
  return foot.slice(0, 1).toUpperCase();
}

export function formatRating(rating?: number | string | null): string {
  if (rating == null || rating === "") return "—";
  const n = typeof rating === "number" ? rating : Number(rating);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return n.toFixed(1);
}

export function playerPhotoUrl(opts: {
  photoUrl?: string | null;
  apiFootballPlayerId?: number | null;
}): string | null {
  if (opts.photoUrl) return opts.photoUrl;
  if (opts.apiFootballPlayerId)
    return `https://media.api-sports.io/football/players/${opts.apiFootballPlayerId}.png`;
  return null;
}
