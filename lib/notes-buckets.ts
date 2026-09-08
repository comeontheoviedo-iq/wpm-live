import { lastToken, normalizePlayerKey } from "./player-name";
/**
 * Notes rail context buckets — classify desk notes by entity/category/title.
 * No Players bucket: player notes roll into home/away.
 */

export type NotesBucket =
  | "relevant"
  | "prematch"
  | "home"
  | "away"
  | "league"
  | "h2h"
  | "history"
  | "managers"
  | "venue"
  | "tonight";

export type NotesBucketNote = {
  id: string;
  title: string;
  body: string;
  category: string;
  entityType?: string | null;
  entityId?: string | null;
  pinned?: boolean;
};

export type NotesBucketContext = {
  homePlayerIds?: Set<string> | string[];
  awayPlayerIds?: Set<string> | string[];
  homeClubId?: string | null;
  awayClubId?: string | null;
  homeName?: string | null;
  awayName?: string | null;
  relevantNoteIds?: Set<string> | string[];
};

const BUCKET_ORDER: NotesBucket[] = [
  "relevant",
  "prematch",
  "home",
  "away",
  "league",
  "h2h",
  "history",
  "managers",
  "venue",
  "tonight",
];

function asSet(v?: Set<string> | string[] | null): Set<string> {
  if (!v) return new Set();
  return v instanceof Set ? v : new Set(v);
}

function hay(n: NotesBucketNote): string {
  return `${n.title || ""} ${n.body || ""} ${n.category || ""} ${n.entityType || ""}`.toLowerCase();
}

function titleHay(n: NotesBucketNote): string {
  return `${n.title || ""}`.toLowerCase();
}

/** Live Match event rows (goals/cards/subs with minute markers). */
export function isLiveEventNote(n: NotesBucketNote): boolean {
  if (n.category === "Match" && n.pinned) {
    const t = hay(n);
    if (/\b(goal|penalt|yellow|red|sub|card|var|own\s*goal)\b/i.test(t)) return true;
  }
  const t = `${n.title || ""} ${n.body || ""}`.toLowerCase();
  return (
    n.category === "Match" &&
    (/\d+'/.test(n.title || "") ||
      /\b(goal|penalt|yellow|red|sub|card|var)\b/i.test(t))
  );
}

function clubNameHit(text: string, name?: string | null): boolean {
  if (!name) return false;
  const tokens = name
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  if (!tokens.length) return false;
  // Prefer full short-name include; fall back to longest token
  const lower = name.toLowerCase();
  if (lower.length >= 3 && text.includes(lower)) return true;
  const longest = [...tokens].sort((a, b) => b.length - a.length)[0];
  return Boolean(longest && text.includes(longest));
}

/** Title + first lines of body — chunk retitles often drop bucket keywords. */
function titleOrLead(n: NotesBucketNote): string {
  const lead = (n.body || "")
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join(" ");
  return `${n.title || ""} ${lead} ${n.category || ""} ${n.entityType || ""}`.toLowerCase();
}

export function isManagersNote(n: NotesBucketNote): boolean {
  if (n.entityType === "coach") return true;
  const t = titleHay(n);
  if (/manager|head coach|touchline|dugout|coach\b|—\s*Coach\b/i.test(t)) {
    return true;
  }
  // Bio / club fallback manager cards after organise
  if (
    (n.category === "Bio" || n.entityType === "club") &&
    /manager|head coach|touchline|dugout|\bcoach\b/i.test(titleOrLead(n))
  ) {
    return true;
  }
  return false;
}

export function isVenueNote(n: NotesBucketNote): boolean {
  return /venue|atmosphere|stadium|ground\b|fortress|arena\b/i.test(
    titleOrLead(n)
  );
}

export function isH2hNote(n: NotesBucketNote): boolean {
  return /\bh2h\b|head[- ]?to[- ]?head|rivalry|historical scorelines/i.test(
    titleOrLead(n)
  );
}

export function isLeagueNote(n: NotesBucketNote): boolean {
  if (n.entityType === "league") return true;
  const t = titleOrLead(n);
  return (
    /league|table\s*&?\s*form|standings|season context|divisional|competition\b/i.test(
      t
    ) && !isH2hNote(n)
  );
}

export function isHistoryNote(n: NotesBucketNote): boolean {
  if (n.category === "Career") return true;
  // Organised club profile cards ("Stuttgart — Club") belong in History
  if (
    n.entityType === "club" &&
    /—\s*Club\b/i.test(n.title || "") &&
    !/^Manager\b/i.test(n.title || "")
  ) {
    return true;
  }
  return /history|founded|centenary|institution|club (profile|story)|nickname|background|rebuild|heritage|legacy/i.test(
    titleOrLead(n)
  );
}

export function isTonightNote(n: NotesBucketNote): boolean {
  if (isLiveEventNote(n)) return true;
  const h = hay(n);
  if (/tonight|this evening|matchday|on the night|kick-?off night|under lights/i.test(h)) {
    return true;
  }
  // Pinned air hooks are the "tonight" must-mentions
  if (n.pinned && (n.category === "Hook" || n.category === "Funfact")) return true;
  return false;
}

export function isPrematchNote(n: NotesBucketNote): boolean {
  // Thin curated build-up only — NOT a dump of every organised note.
  // League / H2H / History / Managers / Venue / Tonight / squad bios have
  // their own buckets; Prematch keeps short prep cards (team news, tactical,
  // referee, preview).
  if (isLiveEventNote(n)) return false;
  if (isManagersNote(n) || isVenueNote(n) || isH2hNote(n) || isLeagueNote(n)) {
    return false;
  }
  if (isHistoryNote(n)) return false;
  // Hooks / funfacts → TONIGHT (and home/away when player-tagged), not Prematch
  if (n.category === "Hook" || n.category === "Funfact" || isTonightNote(n)) {
    return false;
  }
  // Player / coach / club dossiers roll into HOME/AWAY / MANAGERS
  if (
    n.entityType === "player" ||
    n.entityType === "coach" ||
    n.entityType === "club" ||
    n.entityType === "league"
  ) {
    return false;
  }
  if (n.category === "Bio" || n.category === "Career") return false;
  if (n.category === "Injury") return true;

  const t = titleHay(n);
  if (/full research|archive/i.test(t)) return false;
  if (
    /team news|tactical|battle lines|lineup|referee|preview|pre-?match|key battle|watch for|absente/i.test(
      t
    )
  ) {
    return true;
  }
  // Short untitled match prep cards only
  if (n.category === "Match" || n.category === "Custom") {
    const bodyLen = (n.body || "").trim().length;
    if (bodyLen > 0 && bodyLen <= 320) {
      const h = hay(n);
      return /team news|tactical|referee|preview|pre-?match|lineup|form\b|absente|key battle/i.test(
        h
      );
    }
  }
  return false;
}

export function isHomeNote(n: NotesBucketNote, ctx: NotesBucketContext): boolean {
  const homePlayers = asSet(ctx.homePlayerIds);
  const homeClubId = ctx.homeClubId || null;
  if (n.entityId && homePlayers.has(n.entityId)) return true;
  if (homeClubId && n.entityId === homeClubId) return true;
  if (n.entityType === "coach" && n.entityId && homePlayers.has(n.entityId)) return true;
  // Club/manager notes that name the home side
  if (
    (n.entityType === "club" || n.entityType === "coach" || !n.entityType) &&
    clubNameHit(hay(n), ctx.homeName)
  ) {
    // Avoid double-counting pure away-named notes
    if (clubNameHit(hay(n), ctx.awayName) && ctx.awayName && ctx.homeName) {
      const h = hay(n);
      const hi = h.indexOf(ctx.homeName.toLowerCase());
      const ai = h.indexOf(ctx.awayName.toLowerCase());
      if (ai >= 0 && (hi < 0 || ai < hi)) return false;
    }
    return true;
  }
  return false;
}

export function isAwayNote(n: NotesBucketNote, ctx: NotesBucketContext): boolean {
  const awayPlayers = asSet(ctx.awayPlayerIds);
  const awayClubId = ctx.awayClubId || null;
  if (n.entityId && awayPlayers.has(n.entityId)) return true;
  if (awayClubId && n.entityId === awayClubId) return true;
  if (
    (n.entityType === "club" || n.entityType === "coach" || !n.entityType) &&
    clubNameHit(hay(n), ctx.awayName)
  ) {
    if (clubNameHit(hay(n), ctx.homeName) && ctx.awayName && ctx.homeName) {
      const h = hay(n);
      const hi = h.indexOf(ctx.homeName.toLowerCase());
      const ai = h.indexOf(ctx.awayName.toLowerCase());
      if (hi >= 0 && (ai < 0 || hi < ai)) return false;
    }
    return true;
  }
  return false;
}

/** Whether note belongs in a given bucket (independent filters; note may match several). */
export function noteMatchesBucket(
  n: NotesBucketNote,
  bucket: NotesBucket,
  ctx: NotesBucketContext = {}
): boolean {
  const relevant = asSet(ctx.relevantNoteIds);
  switch (bucket) {
    case "relevant":
      return relevant.has(n.id);
    case "managers":
      return isManagersNote(n);
    case "venue":
      return isVenueNote(n);
    case "h2h":
      return isH2hNote(n);
    case "league":
      return isLeagueNote(n);
    case "history":
      return isHistoryNote(n);
    case "home":
      return isHomeNote(n, ctx);
    case "away":
      return isAwayNote(n, ctx);
    case "tonight":
      return isTonightNote(n);
    case "prematch":
      return isPrematchNote(n);
    default:
      return false;
  }
}

export function countNotesByBucket(
  notes: NotesBucketNote[],
  ctx: NotesBucketContext
): Record<NotesBucket, number> {
  const out = {} as Record<NotesBucket, number>;
  for (const b of BUCKET_ORDER) {
    out[b] = notes.filter((n) => noteMatchesBucket(n, b, ctx)).length;
  }
  return out;
}

/** Kickoff is "tonight" when calendar day matches Europe/London today (or within 18h). */
export function isKickoffTonight(kickoff?: Date | string | null): boolean {
  if (!kickoff) return false;
  const d = typeof kickoff === "string" ? new Date(kickoff) : kickoff;
  if (Number.isNaN(d.getTime())) return false;
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const today = fmt.format(new Date());
  const koDay = fmt.format(d);
  if (today === koDay) return true;
  const ms = d.getTime() - Date.now();
  return ms >= 0 && ms <= 18 * 60 * 60 * 1000;
}

/**
 * Default rail bucket:
 * Live / HT → RELEVANT
 * else if kickoff tonight → TONIGHT
 * else → PREMATCH
 */
export function defaultNotesBucket(
  status: string,
  kickoff?: Date | string | null
): NotesBucket {
  if (status === "Live" || status === "Half Time") return "relevant";
  if (isKickoffTonight(kickoff)) return "tonight";
  return "prematch";
}

export function notesBucketLabel(
  bucket: NotesBucket,
  homeName?: string | null,
  awayName?: string | null
): string {
  switch (bucket) {
    case "relevant":
      return "RELEVANT";
    case "prematch":
      return "PREMATCH";
    case "home":
      return (homeName || "HOME").toUpperCase();
    case "away":
      return (awayName || "AWAY").toUpperCase();
    case "league":
      return "LEAGUE";
    case "h2h":
      return "H2H";
    case "history":
      return "HISTORY";
    case "managers":
      return "MANAGERS";
    case "venue":
      return "VENUE";
    case "tonight":
      return "TONIGHT";
    default:
      return String(bucket).toUpperCase();
  }
}


/**
 * Coach / manager card on the desk — match Research notes by coach id,
 * synthetic `${side}-coach`, normalised name/surname, or club-side managers.
 */
export function noteMatchesCoachCard(
  n: NotesBucketNote,
  opts: {
    coachId?: string | null;
    coachName?: string | null;
    side: "home" | "away";
    clubId?: string | null;
    clubName?: string | null;
  }
): boolean {
  const syntheticId = `${opts.side}-coach`;
  if (opts.coachId && n.entityId === opts.coachId) return true;
  if (n.entityId === syntheticId) return true;

  const hayNorm = normalizePlayerKey(
    `${n.title || ""} ${n.body || ""} ${n.category || ""}`
  );
  const nameNorm = normalizePlayerKey(opts.coachName || "");
  const sur = lastToken(opts.coachName || "");
  const nameHit =
    Boolean(nameNorm) &&
    ((nameNorm.length >= 4 && hayNorm.includes(nameNorm)) ||
      (sur.length >= 4 &&
        (hayNorm.split(" ").includes(sur) || hayNorm.includes(sur))));

  // Direct coach entity or any managers-shaped note naming this coach
  if (nameHit && (n.entityType === "coach" || isManagersNote(n))) return true;

  if (!isManagersNote(n)) return false;

  // Club-linked manager fallback — require name hit so a wrong-side
  // club entityId (co-coach salvage) cannot leak onto the other manager card.
  if (opts.clubId && n.entityId === opts.clubId && nameHit) return true;

  // Side via club name in title/body, still gated on naming this coach
  // OR a generic Manager title with this club and no other person surname.
  const clubNorm = normalizePlayerKey(opts.clubName || "");
  if (
    clubNorm.length >= 4 &&
    hayNorm.includes(clubNorm) &&
    (n.entityType === "club" ||
      n.entityType === "match" ||
      n.entityType === "coach" ||
      !n.entityType)
  ) {
    if (nameHit) return true;
    const titleNorm = normalizePlayerKey(n.title || "");
    const genericManager =
      /^manager(\s|$)/i.test(n.title || "") &&
      !/[a-z]{4,}/.test(
        titleNorm
          .replace(/manager/g, " ")
          .replace(clubNorm, " ")
          .replace(/profile|coach|touchline|dugout|head/g, " ")
      );
    if (genericManager) return true;
  }

  return false;
}

export const NOTES_BUCKET_ORDER = BUCKET_ORDER;
