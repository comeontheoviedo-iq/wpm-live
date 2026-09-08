/**
 * Smart Notebook organiser — parse Gemini Notebook research packs into
 * per-player / coach / referee / intro / lineup / bite-sized hook notes.
 * Prefer split-first; never dump one mega Match note as the primary path.
 */

import { namesLooselyMatch, normalizePlayerKey, lastToken } from "./player-name";
import { splitByHeadings, type SquadMember } from "./pack-distribute";
import {
  chunkPackBody,
  packBodyToCards,
  LEAGUE_NOTE_MAX_CHARS,
} from "./pack-chunker";

export type CoachMember = { id: string; name: string; clubId: string; side: "home" | "away" };

export type OrganisedNote = {
  title: string;
  body: string;
  category: string;
  entityType: string;
  entityId: string;
  pinned?: boolean;
};

export type OrganisedSpeak = {
  title: string;
  body: string;
  timing: string;
  order: number;
};

export type OrganisedPack = {
  notes: OrganisedNote[];
  speaks: OrganisedSpeak[];
  /** Human summary bits for the UI. */
  summary: {
    playerNotes: number;
    coachNotes: number;
    hookNotes: number;
    clubNotes: number;
    leagueNotes: number;
    matchNotes: number;
    intro: boolean;
    lineup: boolean;
  };
};

function stripHeadingDecor(heading: string): string {
  return heading
    .replace(/^#+\s*/, "")
    .replace(/^\*\*|\*\*$/g, "")
    .replace(/^(?:[IVXLCDM]+)[.)]\s+/i, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/\s*[—–-]\s*\*\*.+$/, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** "31. Ederson (Goalkeeper)" → "Ederson" */
export function cleanPlayerHeading(heading: string): string {
  let h = stripHeadingDecor(heading);
  // Leading shirt number still present after #### strip
  h = h.replace(/^\d{1,3}[.)]?\s+/, "");
  h = h.replace(/\s*[—–-]\s*(INJURED|SUSPENDED|DOUBTFUL|OUT).*$/i, "");
  return h.trim();
}

function looksLikePlayerHeading(heading: string): boolean {
  const h = heading.trim();
  // #### 31. Name (Role) or **1. Name (#31)**
  if (/^\d{1,3}[.)]\s+[A-Za-zÀ-ÿ]/.test(h)) return true;
  if (/^[A-Za-zÀ-ÿ].+\([^)]*(GK|DF|MF|FW|Goalkeeper|Back|Midfield|Winger|Forward|Keeper)/i.test(h))
    return true;
  if (/^#{0,4}\s*\d{1,3}\.\s+/.test(h)) return true;
  return false;
}

/** Narrative / Season Metrics (and similar) under a player heading — merge back. */
const PLAYER_SUBHEAD_RE =
  /^(narrative|season\s*metrics|season\s*stats|key\s*stats|metrics|bio|profile|form\s*guide|career|this\s*season)$/i;

function isPlayerSubheading(heading: string): boolean {
  const h = stripHeadingDecor(heading)
    .replace(/\*\*/g, "")
    .replace(/:$/, "")
    .trim();
  return PLAYER_SUBHEAD_RE.test(h);
}

/**
 * PART IV packs often split each player into empty name heading + Narrative +
 * Season Metrics children. Fold those children into the preceding player body
 * so profiles reach the desk squad.
 */
export function coalescePlayerSubsections(
  sections: { heading: string; body: string }[]
): { heading: string; body: string }[] {
  const out: { heading: string; body: string }[] = [];
  for (const s of sections) {
    if (
      out.length &&
      isPlayerSubheading(s.heading) &&
      (looksLikePlayerHeading(out[out.length - 1].heading) ||
        /[A-Za-zÀ-ÿ].{1,60}/.test(cleanPlayerHeading(out[out.length - 1].heading)))
    ) {
      const prev = out[out.length - 1];
      const label = stripHeadingDecor(s.heading)
        .replace(/\*\*/g, "")
        .replace(/:$/, "")
        .trim();
      const chunk = `**${label}**\n${(s.body || "").trim()}`.trim();
      prev.body = prev.body.trim()
        ? `${prev.body.trim()}\n\n${chunk}`
        : chunk;
      continue;
    }
    out.push({ heading: s.heading, body: s.body });
  }
  return out;
}

function isPartMajorHeading(heading: string): boolean {
  const h = heading.trim();
  return (
    /^PART\s+[IVXLCDM\d]+\b/i.test(h) ||
    /^(?:[IVX]+)\.\s+/i.test(h) ||
    /^#{0,2}\s*[IVX]+\./i.test(h) ||
    /^section\s*\d+\s*:/i.test(h)
  );
}

function stickyFromMajorHeading(heading: string):
  | "intro"
  | "lineup"
  | "hooks"
  | "referee"
  | "table"
  | "tactical"
  | "team_news"
  | null {
  const h = heading.toLowerCase();
  // PART I / timed intro script → Speaks intro (not Prematch)
  if (
    /part\s+i\b/i.test(h) ||
    /timed\s+matchday\s+intro|introductory\s+script|intro(ductory)?\s+script|cold open|commentary monologue/i.test(
      h
    )
  ) {
    return "intro";
  }
  // PART V / hooks list
  if (
    /part\s+v\b/i.test(h) ||
    /hooks|goldmines|fillers|must[- ]?mention|dead-?air/i.test(h)
  ) {
    return "hooks";
  }
  // PART III — only sticky lineup when heading itself is lineup-shaped;
  // managers classify on their own.
  if (/part\s+iii\b/i.test(h)) {
    if (/lineup|team sheets|starting xi/i.test(h)) return "lineup";
    return null;
  }
  if (/part\s+iv\b/i.test(h)) return null; // players via headings + coalesce
  if (/part\s+ii\b/i.test(h)) return null; // children: league/h2h/venue/ref

  const major = classifySection(heading).kind;
  if (
    major === "intro" ||
    major === "lineup" ||
    major === "hooks" ||
    major === "referee" ||
    major === "table" ||
    major === "tactical" ||
    major === "team_news"
  ) {
    return major;
  }
  if (/season-to-date|state of the division|divisional context/i.test(heading)) {
    return "table";
  }
  if (/officials|referee/i.test(heading)) return "referee";
  if (/hooks|goldmines|fillers/i.test(heading)) return "hooks";
  if (/monologue|awaits|introductory\s+script|timed\s+matchday\s+intro/i.test(heading)) {
    return "intro";
  }
  if (/team sheets|lineups/i.test(heading)) return "lineup";
  return null;
}

function classifySection(heading: string): {
  kind:
    | "intro"
    | "lineup"
    | "hooks"
    | "referee"
    | "manager"
    | "player"
    | "venue"
    | "table"
    | "h2h"
    | "club_home"
    | "club_away"
    | "tactical"
    | "team_news"
    | "skip"
    | "other";
} {
  const h = heading.toLowerCase();
  const n = normalizePlayerKey(heading);

  if (
    /pre-?match commentary monologue|cold open|air-?ready intro|broadcast intro|i\.\s*pre-?match/i.test(
      h
    ) ||
    /part\s+i\b|section\s*1\b|timed\s+matchday\s+intro|introductory\s+script|intro(ductory)?\s+script|matchday\s+introductory/i.test(
      h
    ) ||
    (/monologue|awaits|kad[ıi]k[oö]y|scene setting|institutional friction|player narrative|final warm-?up|unofficial broadcast declaration/i.test(
      h
    ) && /commentator|timed\s+script|timed\s+matchday|pre-?match|introductory/i.test(h + " " + n)) ||
    (/^i\b/.test(n) && /monologue|awaits|kad|intro/.test(h)) ||
    // Timed commentator beat lines under PART I
    (/^\(?\s*commentator\b/i.test(h) &&
      !/lineup|team sheets/i.test(h) &&
      /\d+:\d+|timed|intro|script|monologue|cold open/i.test(h))
  ) {
    return { kind: "intro" };
  }
  if (
    /team sheets? and lineups?|lineup (analysis|read|announce)|expected starting xi|starting lineups?/i.test(
      h
    ) ||
    /commentator - .*lineup/i.test(h)
  ) {
    return { kind: "lineup" };
  }
  if (
    /part\s+v\b|matchday commentary hooks|commentary hooks|dead-?air|goldmines|must[- ]?mention|key facts|air[- ]?ready facts|fillers|section\s*\d+\s*:\s*.*hooks/i.test(
      h
    )
  ) {
    return { kind: "hooks" };
  }
  // Skip PART IV container / player subheads (payload merged via coalesce)
  if (/part\s+iv\b|player profiles?/i.test(h) && !looksLikePlayerHeading(heading)) {
    return { kind: "skip" };
  }
  if (isPlayerSubheading(heading)) {
    return { kind: "skip" };
  }
  if (/match officials|referee|ref:\s*|var:\s*|cards?\s*profile/i.test(h)) {
    return { kind: "referee" };
  }
  if (/manager profile|touchline|head coach|dugout/i.test(h)) {
    return { kind: "manager" };
  }
  if (/venue|atmosphere|stadium|chobani|saraco.lu|kad.koy fortress/i.test(h)) {
    return { kind: "venue" };
  }
  if (
    /league table|table position|season-to-date|form\b|last 7 days|standings|divisional context|division trajectory|state of the division/i.test(
      h
    )
  ) {
    return { kind: "table" };
  }
  if (/\bh2h\b|head[- ]?to[- ]?head|rivalry history|historical scorelines|centenary/i.test(h)) {
    return { kind: "h2h" };
  }
  if (/tactical|battle lines|opposition identity/i.test(h)) {
    return { kind: "tactical" };
  }
  if (/team news|sidelined|injur|squad depth|absences|key absentees/i.test(h)) {
    return { kind: "team_news" };
  }
  if (/other .*squad|institutional & squad|broadcast framing|open questions|unknowns/i.test(h)) {
    // Parent containers — children carry the payload; skip dumping whole club dump
    if (/other .*squad members/i.test(h)) return { kind: "skip" };
    if (/institutional & squad profiles/i.test(h)) return { kind: "skip" };
    if (/expected starting xi/i.test(h)) return { kind: "skip" };
  }
  if (looksLikePlayerHeading(heading)) {
    return { kind: "player" };
  }
  return { kind: "other" };
}

function matchPlayerLoose(
  heading: string,
  players: SquadMember[]
): SquadMember | null {
  const cleaned = cleanPlayerHeading(heading);
  if (!cleaned || cleaned.length < 2) return null;

  let best: SquadMember | null = null;
  let bestScore = 0;
  for (const p of players) {
    if (namesLooselyMatch(cleaned, p.name)) {
      const score = normalizePlayerKey(p.name).length + 50;
      if (score > bestScore) {
        best = p;
        bestScore = score;
      }
      continue;
    }
    // Surname token in cleaned heading
    const sur = lastToken(p.name);
    if (sur.length >= 4) {
      const tokens = normalizePlayerKey(cleaned).split(" ");
      if (tokens.includes(sur)) {
        const score = sur.length;
        if (score > bestScore) {
          best = p;
          bestScore = score;
        }
      }
    }
  }
  return best;
}

function matchCoach(
  heading: string,
  body: string,
  coaches: CoachMember[]
): CoachMember | null {
  const blob = `${heading}\n${body.slice(0, 500)}`;
  const blobKey = normalizePlayerKey(blob);
  const headingKey = normalizePlayerKey(heading);
  let best: CoachMember | null = null;
  let bestScore = 0;
  for (const c of coaches) {
    const cleaned = cleanPlayerHeading(heading);
    if (namesLooselyMatch(cleaned, c.name)) return c;
    // "Manager Profile: İsmail Kartal" / em-dash forms
    const afterColon = heading.split(/:\s*/).slice(1).join(": ").trim();
    if (afterColon && namesLooselyMatch(afterColon, c.name)) return c;
    const afterDash = heading.split(/[—–-]/).slice(1).join("-").trim();
    if (
      afterDash &&
      namesLooselyMatch(cleanPlayerHeading(afterDash), c.name)
    ) {
      return c;
    }
    const cKey = normalizePlayerKey(c.name);
    if (cKey.length >= 4 && blobKey.includes(cKey)) {
      const score = cKey.length + 40;
      if (score > bestScore) {
        best = c;
        bestScore = score;
      }
    }
    // Surname in heading or early body
    const sur = lastToken(c.name);
    if (sur.length >= 4) {
      if (headingKey.includes(sur) || blobKey.split(" ").includes(sur)) {
        const score = sur.length + 10;
        if (score > bestScore) {
          best = c;
          bestScore = score;
        }
      }
    }
  }
  return best;
}

/** Prefer a resolvable coach id when manager section failed a direct name hit. */
function resolveCoachFallback(
  heading: string,
  body: string,
  coaches: CoachMember[],
  side: "home" | "away" | null,
  homeClubId: string,
  awayClubId: string
): CoachMember | null {
  const sideCoaches = coaches.filter((c) => {
    if (side === "home") return c.side === "home" || c.clubId === homeClubId;
    if (side === "away") return c.side === "away" || c.clubId === awayClubId;
    return true;
  });
  const hit = matchCoach(heading, body, sideCoaches.length ? sideCoaches : coaches);
  if (hit) return hit;
  if (sideCoaches.length === 1) return sideCoaches[0];
  return null;
}

/** Split a hooks section body into bite-sized notes. */
export function splitHookBullets(text: string): { title: string; body: string }[] {
  const raw = text.replace(/\r\n/g, "\n").trim();
  if (!raw) return [];

  // Numbered blocks: "1. **Title**: ..." or "1. [Tag] Title\n   Spoken..."
  const blocks: { title: string; body: string }[] = [];
  const lines = raw.split("\n");
  let cur: { title: string; body: string } | null = null;

  const startRe =
    /^(\d{1,2})[.)]\s+(.*)$/;
  const tagTitleRe = /^(?:\*\*)?\[([^\]]{1,60})\]\s*(.+)$/;

  for (const line of lines) {
    const m = startRe.exec(line.trim());
    if (m) {
      if (cur && cur.body.trim().length >= 12) blocks.push(cur);
      let rest = (m[2] || "").replace(/\*\*/g, "").trim();
      let title = "";
      const tagged = tagTitleRe.exec(rest);
      if (tagged) {
        // "[Venue] Fortress Swabia" → "Fortress Swabia" (keep tag light)
        const tag = tagged[1].trim();
        const name = tagged[2].replace(/^[:—–-]\s*/, "").trim();
        title = (name || tag).slice(0, 80);
        rest = name || rest;
      } else {
        const colon = rest.split(/:\s*/);
        title = (colon[0] || rest).slice(0, 80);
      }
      title = title || `Hook ${m[1]}`;
      cur = {
        title: `Hook: ${title}`.slice(0, 100),
        body: rest,
      };
      continue;
    }
    if (cur) {
      cur.body += (cur.body ? "\n" : "") + line;
    }
  }
  if (cur && cur.body.trim().length >= 12) blocks.push(cur);

  // Fallback: bullet lines
  if (blocks.length < 3) {
    const bullets = raw
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^[-*•]/.test(l) && l.length > 20);
    if (bullets.length >= 3) {
      return bullets.map((b, i) => {
        const cleaned = b.replace(/^[-*•]\s+/, "");
        const title = cleaned.slice(0, 60).replace(/\s+\S*$/, "") || `Hook ${i + 1}`;
        return { title: `Hook: ${title}`, body: cleaned };
      });
    }
  }

  return blocks.map((b) => ({ title: b.title, body: b.body.trim() }));
}

function clubSideFromHeading(
  heading: string,
  homeName: string,
  awayName: string
): "home" | "away" | null {
  const h = normalizePlayerKey(heading);
  const homeN = normalizePlayerKey(homeName);
  const awayN = normalizePlayerKey(awayName);
  const homeHit =
    h.includes(homeN) ||
    homeN.split(" ").some((t) => t.length >= 4 && h.includes(t));
  const awayHit =
    h.includes(awayN) ||
    awayN.split(" ").some((t) => t.length >= 4 && h.includes(t));
  if (homeHit && !awayHit) return "home";
  if (awayHit && !homeHit) return "away";
  return null;
}

export type OrganiseArgs = {
  text: string;
  matchId: string;
  homeClub: { id: string; name: string };
  awayClub: { id: string; name: string };
  players: SquadMember[];
  coaches: CoachMember[];
  /** Competition display name (e.g. Premier League). */
  competition?: string | null;
  /**
   * Stable league dossier key — prefer AF league id string ("39"), else competition name.
   * League dossier Notes tab queries entityType=league with this entityId.
   */
  leagueEntityId?: string | null;
  /** When true, also store a pinned archive of the full paste (secondary). Default false. */
  keepFullArchive?: boolean;
};

/**
 * Parse a Notebook-shaped research pack into entity-attached notes + speaks.
 */

export {
  chunkPackBody,
  packBodyToCards,
  cardTitleForChunk,
  bodyWithoutLeadingHeading,
  isLeagueBucketFatNote,
  LEAGUE_NOTE_MAX_CHARS,
} from "./pack-chunker";


export function organiseNotebookPack(args: OrganiseArgs): OrganisedPack {
  const {
    text,
    matchId,
    homeClub,
    awayClub,
    players,
    coaches,
    competition,
    leagueEntityId,
    keepFullArchive = false,
  } = args;
  const notes: OrganisedNote[] = [];
  const speaks: OrganisedSpeak[] = [];
  const seenPlayer = new Set<string>();
  const seenCoach = new Set<string>();
  const seenHookTitles = new Set<string>();
  const leagueKey =
    (leagueEntityId && String(leagueEntityId).trim()) ||
    (competition && String(competition).trim()) ||
    "league";

  const sections = coalescePlayerSubsections(splitByHeadings(text));

  let introChunks: string[] = [];
  let lineupChunks: string[] = [];
  let refereeChunks: string[] = [];
  let venueChunks: string[] = [];
  let tableChunks: string[] = [];
  let h2hChunks: string[] = [];
  let tacticalChunks: string[] = [];
  let teamNewsChunks: string[] = [];
  let homeClubChunks: string[] = [];
  let awayClubChunks: string[] = [];
  let leagueChunks: string[] = [];
  let hooksRaw = "";

  // Sticky bucket for roman / major sections so nested **(Commentator)**
  // children inherit intro/lineup/hooks context when their own classify is "other".
  let sticky:
    | "intro"
    | "lineup"
    | "hooks"
    | "referee"
    | "table"
    | "tactical"
    | "team_news"
    | null = null;

  for (const s of sections) {
    const body = (s.body || "").trim();
    const heading = s.heading.trim();
    if (!heading) continue;

    // Major section resets sticky (PART I–V / roman / SECTION N)
    if (isPartMajorHeading(heading)) {
      sticky = stickyFromMajorHeading(heading);
    }

    // Player headings win even inside club sections (Narrative+Metrics coalesced).
    // Under PART V hooks sticky, skip — surnames in hook titles must stay hooks.
    const player =
      sticky === "hooks" ? null : matchPlayerLoose(heading, players);
    if (sticky !== "hooks" && (player || looksLikePlayerHeading(heading))) {
      if (player) {
        const content = body.length >= 20 ? body : `${heading}\n${body}`.trim();
        if (content.length >= 20) {
          const existing = notes.find(
            (n) =>
              n.entityType === "player" &&
              n.entityId === player.id &&
              n.title === `${player.name} — Bio`
          );
          if (existing) {
            // Idempotent merge on re-organise / split fragments
            if (!existing.body.includes(content.slice(0, 80))) {
              existing.body = `${existing.body}\n\n${content}`.trim();
            }
          } else {
            seenPlayer.add(player.id);
            notes.push({
              title: `${player.name} — Bio`,
              body: content,
              category: "Bio",
              entityType: "player",
              entityId: player.id,
            });
          }
        }
      }
      continue;
    }

    let { kind } = classifySection(heading);
    // Club dossier sections: "Everton FC: …", "Manchester United FC: …"
    if (kind === "other" || kind === "skip") {
      const sideHint = clubSideFromHeading(heading, homeClub.name, awayClub.name);
      if (
        sideHint &&
        /\bFC\b|club background|institutional|rebuild|club profile|storylines?|nickname|history|founded|identity/i.test(
          heading
        ) &&
        !/manager profile|expected starting|other .*squad|player/i.test(heading)
      ) {
        kind = sideHint === "home" ? "club_home" : "club_away";
      }
    }
    if (
      kind === "other" &&
      sticky &&
      !/manager profile|institutional & squad|expected starting|other .*squad/i.test(
        heading
      )
    ) {
      kind = sticky;
    }
    // Sticky PART context wins over opportunistic title keywords
    // (e.g. "[Venue] Fortress…" under PART V must stay a hook, not VENUE).
    if (sticky === "hooks" && !isPartMajorHeading(heading)) {
      kind = "hooks";
    }
    if (
      sticky === "intro" &&
      !isPartMajorHeading(heading) &&
      !/lineup analysis|team sheets|expected starting/i.test(heading)
    ) {
      kind = "intro";
    }
    if (
      sticky === "lineup" ||
      (/commentator/i.test(heading) && /lineup/i.test(heading))
    ) {
      if (/lineup|team sheets|sidelined/i.test(heading)) kind = "lineup";
    }
    const chunk = `## ${heading}\n${body}`.trim();

    switch (kind) {
      case "intro":
        if (body.length >= 40) introChunks.push(chunk);
        break;
      case "lineup":
        if (body.length >= 40) lineupChunks.push(chunk);
        break;
      case "hooks": {
        // Numbered hooks often become their own headings via splitByHeadings —
        // rebuild "N. title\nbody" so splitHookBullets still fires.
        const hookTitle = stripHeadingDecor(heading);
        if (
          hookTitle &&
          !/part\s+v\b|commentary hooks|goldmines|must[- ]?mention|fillers/i.test(
            hookTitle
          ) &&
          body.length >= 12
        ) {
          const n = (hooksRaw.match(/^\d+[.)]/gm) || []).length + 1;
          hooksRaw +=
            (hooksRaw ? "\n\n" : "") + `${n}. ${hookTitle}\n${body}`;
        } else {
          hooksRaw += (hooksRaw ? "\n\n" : "") + (body || chunk);
        }
        break;
      }
      case "referee":
        if (body.length >= 20) refereeChunks.push(chunk);
        break;
      case "manager": {
        const side = clubSideFromHeading(heading, homeClub.name, awayClub.name);
        const coach =
          matchCoach(heading, body, coaches) ||
          resolveCoachFallback(
            heading,
            body,
            coaches,
            side,
            homeClub.id,
            awayClub.id
          );
        if (coach && !seenCoach.has(coach.id) && body.length >= 40) {
          seenCoach.add(coach.id);
          notes.push({
            title: `${coach.name} — Coach`,
            body,
            category: "Bio",
            entityType: "coach",
            entityId: coach.id,
          });
        } else if (body.length >= 40) {
          // Fall back: club-level manager note if coach row missing
          const club = side === "away" ? awayClub : homeClub;
          notes.push({
            title: `Manager — ${cleanPlayerHeading(heading).slice(0, 60)}`,
            body,
            category: "Bio",
            entityType: "club",
            entityId: club.id,
          });
        }
        break;
      }
      case "venue":
        if (body.length >= 30) venueChunks.push(chunk);
        break;
      case "table":
        if (body.length >= 30) {
          tableChunks.push(chunk);
          leagueChunks.push(chunk);
        }
        break;
      case "h2h":
        if (body.length >= 30) {
          h2hChunks.push(chunk);
          // Rivalry is match-level, but also useful on league Notes
          leagueChunks.push(chunk);
        }
        break;
      case "tactical":
        if (body.length >= 30) tacticalChunks.push(chunk);
        break;
      case "team_news":
        if (body.length >= 30) {
          teamNewsChunks.push(chunk);
          // Split club-named team news into club dossiers when possible
          const newsSide = clubSideFromHeading(heading, homeClub.name, awayClub.name);
          if (newsSide === "home") homeClubChunks.push(chunk);
          else if (newsSide === "away") awayClubChunks.push(chunk);
          else {
            // Body often has **Everton:** / **Manchester United:** bullets — copy whole to both
            const hn = normalizePlayerKey(homeClub.name);
            const an = normalizePlayerKey(awayClub.name);
            const bn = normalizePlayerKey(body);
            if (hn.split(" ").some((t) => t.length >= 4 && bn.includes(t))) {
              homeClubChunks.push(chunk);
            }
            if (an.split(" ").some((t) => t.length >= 4 && bn.includes(t))) {
              awayClubChunks.push(chunk);
            }
          }
        }
        break;
      case "skip":
        break;
      case "club_home":
        if (body.length >= 20) homeClubChunks.push(chunk);
        break;
      case "club_away":
        if (body.length >= 20) awayClubChunks.push(chunk);
        break;
      case "other": {
        // Club history / background when heading clearly names one club
        const side = clubSideFromHeading(heading, homeClub.name, awayClub.name);
        if (
          side &&
          /history|founded|institution|identity|club (profile|story)|nickname|background|rebuild|friction|pragmatism|volatility/i.test(
            heading
          ) &&
          body.length >= 40
        ) {
          if (side === "home") homeClubChunks.push(chunk);
          else awayClubChunks.push(chunk);
        }
        break;
      }
      default:
        break;
    }
  }

  // Also scan full text for hook section if not captured via headings
  if (!hooksRaw || splitHookBullets(hooksRaw).length < 3) {
    const hookSectionMatch = text.match(
      /#{1,4}\s+.*?(?:hooks?|goldmines|must[- ]?mention|dead-?air)[^\n]*\n([\s\S]*?)(?=\n#{1,3}\s+[IVX]+\.|$)/i
    );
    if (hookSectionMatch?.[1] && hookSectionMatch[1].length > (hooksRaw?.length || 0)) {
      hooksRaw = hookSectionMatch[1];
    }
  }

  // Fallback player scan via extract-style if we got very few
  if (seenPlayer.size < 4) {
    for (const s of sections) {
      const player = matchPlayerLoose(s.heading, players);
      if (!player || seenPlayer.has(player.id)) continue;
      const body = (s.body || "").trim();
      if (body.length < 40) continue;
      seenPlayer.add(player.id);
      notes.push({
        title: `${player.name} — Bio`,
        body,
        category: "Bio",
        entityType: "player",
        entityId: player.id,
      });
    }
  }

  // Speaks
  const introBody = introChunks.join("\n\n").trim();
  if (introBody.length >= 80) {
    speaks.push({
      title: "Intro script",
      body: introBody,
      timing: "pre-match",
      order: 1,
    });
  }
  const lineupBody = lineupChunks.join("\n\n").trim();
  if (lineupBody.length >= 80) {
    speaks.push({
      title: "Lineup read",
      body: lineupBody,
      timing: "kickoff",
      order: 2,
    });
  }

  // Referee
  const refBody = refereeChunks.join("\n\n").trim();
  if (refBody.length >= 40) {
    notes.push({
      title: "Referee",
      body: refBody,
      category: "Match",
      entityType: "match",
      entityId: matchId,
    });
  }

  // Bite-sized hooks (pinned)
  const hookItems = splitHookBullets(hooksRaw);
  for (const h of hookItems.slice(0, 24)) {
    if (seenHookTitles.has(h.title)) continue;
    seenHookTitles.add(h.title);
    notes.push({
      title: h.title,
      body: h.body,
      category: "Hook",
      entityType: "match",
      entityId: matchId,
      pinned: true,
    });
  }

  // Also attach player-tagged hooks onto players when surname matches
  for (const h of hookItems) {
    for (const p of players) {
      const sur = lastToken(p.name);
      if (sur.length >= 4 && normalizePlayerKey(h.body).includes(sur)) {
        const title = `${p.name} — Hook`;
        // Upsert-friendly single player hook note — merge later by title
        const existing = notes.find(
          (n) => n.entityType === "player" && n.entityId === p.id && n.title === title
        );
        if (existing) {
          existing.body = `${existing.body}\n\n${h.body}`.trim();
        } else {
          notes.push({
            title,
            body: h.body,
            category: "Hook",
            entityType: "player",
            entityId: p.id,
          });
        }
        break;
      }
    }
  }

  // Match-level scannable notes (not one blob).
  // Table & form (league-bucket) always chunked ≤280; other long bits too.
  const matchBits: { title: string; chunks: string[]; forceChunk?: boolean }[] = [
    { title: "Venue & atmosphere", chunks: venueChunks },
    { title: "Table & form", chunks: tableChunks, forceChunk: true },
    { title: "H2H & rivalry", chunks: h2hChunks },
    { title: "Tactical battle lines", chunks: tacticalChunks },
    { title: "Team news", chunks: teamNewsChunks },
  ];
  for (const bit of matchBits) {
    const body = bit.chunks.join("\n\n").trim();
    if (body.length < 40) continue;
    const shouldChunk =
      bit.forceChunk || body.length > LEAGUE_NOTE_MAX_CHARS;
    if (shouldChunk) {
      for (const card of packBodyToCards(bit.title, body, LEAGUE_NOTE_MAX_CHARS)) {
        notes.push({
          title: card.title,
          body: card.body,
          category: "Match",
          entityType: "match",
          entityId: matchId,
        });
      }
    } else {
      notes.push({
        title: bit.title,
        body,
        category: "Match",
        entityType: "match",
        entityId: matchId,
      });
    }
  }

  // Club-level notes (dossier Club Notes tab)
  if (homeClubChunks.join("").trim().length >= 40) {
    notes.push({
      title: `${homeClub.name} — Club`,
      body: homeClubChunks.join("\n\n").trim(),
      category: "Club",
      entityType: "club",
      entityId: homeClub.id,
    });
  }
  if (awayClubChunks.join("").trim().length >= 40) {
    notes.push({
      title: `${awayClub.name} — Club`,
      body: awayClubChunks.join("\n\n").trim(),
      category: "Club",
      entityType: "club",
      entityId: awayClub.id,
    });
  }

  // League / competition Notes (league dossier tab) — always ≤280 cards
  const leagueBody = leagueChunks.join("\n\n").trim();
  if (leagueBody.length >= 40) {
    const leagueTitle = competition
      ? `${competition} — Season context`
      : "League — Season context";
    for (const card of packBodyToCards(
      leagueTitle,
      leagueBody,
      LEAGUE_NOTE_MAX_CHARS
    )) {
      notes.push({
        title: card.title,
        body: card.body,
        category: "Match",
        entityType: "league",
        entityId: leagueKey,
      });
    }
  }

  // Optional full archive (secondary) — off by default
  if (keepFullArchive && text.trim().length >= 200) {
    notes.push({
      title: "Full research (archive)",
      body: text.trim(),
      category: "Match",
      entityType: "match",
      entityId: matchId,
      pinned: false,
    });
  }

  const playerNotes = notes.filter(
    (n) => n.entityType === "player" && n.category === "Bio"
  ).length;
  const coachNotes = notes.filter((n) => n.entityType === "coach").length;
  const hookNotes = notes.filter((n) => n.category === "Hook").length;
  const clubNotes = notes.filter((n) => n.entityType === "club").length;
  const leagueNotes = notes.filter((n) => n.entityType === "league").length;
  const matchNotes = notes.filter(
    (n) => n.entityType === "match" && n.category !== "Hook"
  ).length;

  return {
    notes,
    speaks,
    summary: {
      playerNotes,
      coachNotes,
      hookNotes,
      clubNotes,
      leagueNotes,
      matchNotes,
      intro: speaks.some((s) => /intro/i.test(s.title)),
      lineup: speaks.some((s) => /lineup/i.test(s.title)),
    },
  };
}

/** Detect Notebook mega-paste (roman sections + player #### headings). */
export function looksLikeNotebookPack(text: string): boolean {
  const t = text || "";
  if (t.length < 800) return false;
  const hasRoman = /(?:^|\n)\s*#{0,3}\s*[IVX]+\.\s+\S/m.test(t);
  const hasParts =
    (t.match(/(?:^|\n)\s*#{0,3}\s*PART\s+[IVX\d]+\b/gim) || []).length >= 2;
  const hasSections =
    (t.match(/(?:^|\n)\s*#{1,3}\s*SECTION\s*\d+\s*:/gim) || []).length >= 2;
  const hasPlayerHeads =
    (t.match(/#{2,4}\s*\d{1,3}\.\s+[A-Za-zÀ-ÿ]/g) || []).length >= 3 ||
    (t.match(/(?:^|\n)\s*\d{1,3}\.\s+[A-Za-zÀ-ÿ][^\n]{0,40}\((?:GK|DF|MF|FW|Goalkeeper|Back|Midfield|Winger|Forward|Keeper)/gi) || []).length >= 3;
  const hasNarrativeMetrics =
    /\bNarrative\b/i.test(t) && /Season\s+Metrics/i.test(t);
  const hasHooks = /commentary hooks|goldmines|must[- ]?mention|matchday commentary hooks|part\s+v\b/i.test(t);
  const hasManager = /manager profile/i.test(t);
  const hasIntroScript = /introductory script|timed matchday intro|cold open|part\s+i\b/i.test(t);
  return (
    (hasRoman && hasPlayerHeads) ||
    (hasParts && (hasIntroScript || hasHooks || hasNarrativeMetrics)) ||
    (hasPlayerHeads && hasHooks) ||
    (hasManager && hasPlayerHeads) ||
    (hasNarrativeMetrics && hasPlayerHeads) ||
    (hasSections && (hasHooks || hasIntroScript))
  );
}
