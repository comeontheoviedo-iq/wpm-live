import { matchSquadPlayer, normalizePlayerKey, lastToken } from "./player-name";

/** Parse Gemini pack text into per-entity notes. Resilient: partial matches OK. */

export type SquadMember = { id: string; name: string };

export type DistributedCounts = {
  scripts: number;
  playerNotes: number;
  clubNotes: number;
  leagueNotes: number;
  matchNotes: number;
  coachNotes: number;
  hookNotes: number;
  intro: number;
  lineup: number;
  /** Relevance triggers armed from organised notes */
  relevanceArmed: number;
};

export function emptyDistributed(): DistributedCounts {
  return {
    scripts: 0,
    playerNotes: 0,
    clubNotes: 0,
    leagueNotes: 0,
    matchNotes: 0,
    coachNotes: 0,
    hookNotes: 0,
    intro: 0,
    lineup: 0,
    relevanceArmed: 0,
  };
}

/** Short human summary e.g. "12 player notes · 2 coach · 8 hooks · intro · lineup". */
export function formatDistributeSummary(d: DistributedCounts): string {
  const bits: string[] = [];
  if (d.playerNotes) bits.push(`${d.playerNotes} player note${d.playerNotes === 1 ? "" : "s"}`);
  if (d.coachNotes) bits.push(`${d.coachNotes} coach`);
  if (d.hookNotes) bits.push(`${d.hookNotes} hook${d.hookNotes === 1 ? "" : "s"}`);
  if (d.intro) bits.push("intro");
  if (d.lineup) bits.push("lineup");
  if (d.relevanceArmed) bits.push(`${d.relevanceArmed} relevance armed`);
  if (d.clubNotes) bits.push(`${d.clubNotes} club`);
  if (d.leagueNotes) bits.push(`${d.leagueNotes} league`);
  if (d.matchNotes) bits.push(`${d.matchNotes} match`);
  if (d.scripts && !d.intro && !d.lineup) {
    bits.push(`${d.scripts} script${d.scripts === 1 ? "" : "s"}`);
  }
  return bits.length ? bits.join(" · ") : "nothing mapped";
}

function normalize(s: string) {
  // Same fold as AF ↔ desk matching (Turkish ı, NFKD, …).
  return normalizePlayerKey(s);
}

function surname(name: string) {
  return lastToken(name) || name;
}

/** Research packs often use bare "Name (Role - Starting XI)" lines, not markdown. */
export function isNameRoleHeading(line: string): boolean {
  const t = (line || "").trim();
  if (t.length < 8 || t.length > 140) return false;
  if (!/^[A-Za-zÀ-ÿİıŞşĞğÜüÖöÇç]/.test(t)) return false;
  if (!/\([^)]{2,80}\)\s*$/.test(t)) return false;
  return /(Starting\s+XI|Substitute|Squad\s+Member|Goalkeeper|Forward|Winger|Striker|Midfield|Defender|Back|Keeper|OUT:|INJURED|SUSPENDED|DOUBTFUL)/i.test(
    t
  );
}

/** Split markdown/plain text into heading → body sections.
 *  Leading prose before the first heading is kept as "Overview"
 *  (freeform pastes often have no headings at all). */
export function splitByHeadings(text: string): { heading: string; body: string }[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const sections: { heading: string; body: string }[] = [];
  let current: { heading: string; body: string } | null = null;
  let preamble = "";

  const pushPreamble = () => {
    const body = preamble.trim();
    if (body) sections.push({ heading: "Overview", body });
    preamble = "";
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const md = /^(#{1,4})\s+(.+)$/.exec(line);
    const numbered = /^(\d+)[.)]\s+(.+)$/.exec(line.trim());
    const roman = /^(?:[IVXLCDM]+)[.)]\s+(.+)$/i.exec(line.trim());
    const bold = /^\*\*(.+?)\*\*\s*:?\s*$/.exec(line.trim());
    // Manager Profile lines are rarely markdown — catch before plainCaps
    // so "Manager Profile: Hugo Oliveira (RC Strasbourg Alsace)" becomes a
    // real section (otherwise it stays buried in Overview and coach notes = 0).
    const trimmed = line.trim();
    const managerProfile =
      /^(Manager(?:ial)?\s+Profiles?\b.*|Manager\s+Profile\s*:\s*.+)$/i.test(
        trimmed
      ) && trimmed.length < 140
        ? trimmed
        : null;
    const plainCaps =
      /^([A-Z][A-Za-zÀ-ÿ.'\-]+(?:\s+[A-Z][A-Za-zÀ-ÿ.'\-]+){0,4})\s*:?\s*$/.exec(
        trimmed
      ) && trimmed.length < 60
        ? trimmed.replace(/:$/, "")
        : null;

    const nameRole = isNameRoleHeading(trimmed) ? trimmed : null;

    let heading: string | null = null;
    if (md) heading = md[2].trim();
    else if (bold) heading = bold[1].trim();
    else if (managerProfile) heading = managerProfile;
    else if (nameRole) heading = nameRole;
    else if (roman && roman[1].length < 100) heading = roman[1].trim();
    else if (numbered && numbered[2].length < 80) heading = numbered[2].trim();
    else if (plainCaps && /[A-Za-z]{2,}/.test(plainCaps)) heading = plainCaps;

    if (heading) {
      if (current) sections.push(current);
      else pushPreamble();
      current = { heading, body: "" };
    } else if (current) {
      current.body += (current.body ? "\n" : "") + line;
    } else {
      preamble += (preamble ? "\n" : "") + line;
    }
  }
  if (current) sections.push(current);
  else pushPreamble();
  return sections;
}

function cleanHeadingName(heading: string): string {
  return heading
    .replace(/^#+\s*/, "")
    .replace(/^\*\*|\*\*$/g, "")
    .replace(/^(?:[IVXLCDM]+)[.)]\s+/i, "")
    .replace(/^\d{1,3}[.)]?\s+/, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\s*[—–-]\s*(INJURED|SUSPENDED|DOUBTFUL|OUT).*$/i, "")
    .trim();
}

function matchPlayer(
  heading: string,
  players: SquadMember[]
): SquadMember | null {
  return matchSquadPlayer(heading, players) || matchSquadPlayer(cleanHeadingName(heading), players);
}

export type PlayerSection = { player: SquadMember; title: string; body: string };

export function extractPlayerSections(
  text: string,
  players: SquadMember[]
): PlayerSection[] {
  const sections = splitByHeadings(text);
  const out: PlayerSection[] = [];
  const seen = new Set<string>();

  for (const s of sections) {
    const player = matchPlayer(s.heading, players);
    if (!player || seen.has(player.id)) continue;
    const body = (s.body || "").trim() || s.heading;
    if (body.length < 8) continue;
    seen.add(player.id);
    out.push({
      player,
      title: `${player.name} — Bio`,
      body: body.trim(),
    });
  }

  // Fallback: scan bullet/paragraph lines that start with a player name
  if (out.length < 3) {
    const paras = text.split(/\n{2,}/);
    for (const para of paras) {
      const first = para.trim().split("\n")[0] || "";
      const player = matchPlayer(first.replace(/^[-*•]\s*/, ""), players);
      if (!player || seen.has(player.id)) continue;
      const body = para.trim();
      if (body.length < 20) continue;
      seen.add(player.id);
      out.push({ player, title: `${player.name} — Bio`, body });
    }
  }

  return out;
}

export function extractClubSections(
  text: string,
  home: { id: string; name: string },
  away: { id: string; name: string }
): { clubId: string; clubName: string; title: string; body: string }[] {
  const sections = splitByHeadings(text);
  const homeN = normalize(home.name);
  const awayN = normalize(away.name);
  const homeChunks: string[] = [];
  const awayChunks: string[] = [];
  const sharedChunks: string[] = [];

  for (const s of sections) {
    const h = normalize(s.heading);
    const homeHit =
      h.includes(homeN) ||
      homeN.split(" ").some((t) => t.length >= 4 && h.includes(t));
    const awayHit =
      h.includes(awayN) ||
      awayN.split(" ").some((t) => t.length >= 4 && h.includes(t));

    // Per-heading assignment only — do NOT sticky-bucket later shared
    // sections (Venue, Team news, Must-mention, …) onto one club.
    let dest: "home" | "away" | "shared" = "shared";
    if (homeHit && !awayHit) dest = "home";
    else if (awayHit && !homeHit) dest = "away";
    else dest = "shared";

    const chunk = `## ${s.heading}\n${s.body}`.trim();
    if (dest === "home") homeChunks.push(chunk);
    else if (dest === "away") awayChunks.push(chunk);
    else sharedChunks.push(chunk);
  }

  if (homeChunks.length === 0 && awayChunks.length === 0) {
    // No club-tagged headings — full Notebook/research brief on both clubs
    const body = text.trim();
    return [
      {
        clubId: home.id,
        clubName: home.name,
        title: `${home.name} — Research`,
        body,
      },
      {
        clubId: away.id,
        clubName: away.name,
        title: `${away.name} — Research`,
        body,
      },
    ];
  }

  const join = (clubChunks: string[]) =>
    [...sharedChunks, ...clubChunks].filter(Boolean).join("\n\n").trim() ||
    text.trim();

  return [
    {
      clubId: home.id,
      clubName: home.name,
      title: `${home.name} — Research`,
      body: join(homeChunks),
    },
    {
      clubId: away.id,
      clubName: away.name,
      title: `${away.name} — Research`,
      body: join(awayChunks),
    },
  ];
}

/** Pull hook bullets that mention a player name onto that player. */
export function extractPlayerHooks(
  text: string,
  players: SquadMember[]
): PlayerSection[] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 12);

  const byPlayer = new Map<string, { player: SquadMember; bullets: string[] }>();

  for (const line of lines) {
    const cleaned = line.replace(/^[-*•\d.)\s]+/, "");
    const player = matchPlayer(cleaned.slice(0, 80), players);
    // Unique surname token only — skip shared surnames (Yılmaz ×3)
    let hit = player;
    if (!hit) {
      const cands = players.filter((p) => {
        const sur = normalize(surname(p.name));
        return sur.length >= 3 && normalize(cleaned).split(" ").includes(sur);
      });
      if (cands.length === 1) hit = cands[0];
    }
    if (!hit) continue;
    const entry = byPlayer.get(hit.id) || { player: hit, bullets: [] };
    entry.bullets.push(line.startsWith("-") || line.startsWith("*") ? line : `- ${cleaned}`);
    byPlayer.set(hit.id, entry);
  }

  return [...byPlayer.values()].map((e) => ({
    player: e.player,
    title: `${e.player.name} — Hooks`,
    body: e.bullets.join("\n"),
  }));
}
