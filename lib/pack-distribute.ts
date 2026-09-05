import { namesLooselyMatch, normalizePlayerKey } from "./player-name";

/** Parse Gemini pack text into per-entity notes. Resilient: partial matches OK. */

export type SquadMember = { id: string; name: string };

export type DistributedCounts = {
  scripts: number;
  playerNotes: number;
  clubNotes: number;
  matchNotes: number;
  coachNotes: number;
  hookNotes: number;
  intro: number;
  lineup: number;
};

export function emptyDistributed(): DistributedCounts {
  return {
    scripts: 0,
    playerNotes: 0,
    clubNotes: 0,
    matchNotes: 0,
    coachNotes: 0,
    hookNotes: 0,
    intro: 0,
    lineup: 0,
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
  if (d.clubNotes) bits.push(`${d.clubNotes} club`);
  if (d.matchNotes) bits.push(`${d.matchNotes} match`);
  if (d.scripts && !d.intro && !d.lineup) {
    bits.push(`${d.scripts} script${d.scripts === 1 ? "" : "s"}`);
  }
  return bits.length ? bits.join(" · ") : "nothing mapped";
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function surname(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] || name;
}

/** Split markdown/plain text into heading → body sections. */
export function splitByHeadings(text: string): { heading: string; body: string }[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const sections: { heading: string; body: string }[] = [];
  let current: { heading: string; body: string } | null = null;

  for (const raw of lines) {
    const line = raw.trimEnd();
    const md = /^(#{1,4})\s+(.+)$/.exec(line);
    const numbered = /^(\d+)[.)]\s+(.+)$/.exec(line.trim());
    const roman = /^(?:[IVXLCDM]+)[.)]\s+(.+)$/i.exec(line.trim());
    const bold = /^\*\*(.+?)\*\*\s*:?\s*$/.exec(line.trim());
    const plainCaps =
      /^([A-Z][A-Za-zÀ-ÿ.'\-]+(?:\s+[A-Z][A-Za-zÀ-ÿ.'\-]+){0,4})\s*:?\s*$/.exec(
        line.trim()
      ) && line.trim().length < 60
        ? line.trim().replace(/:$/, "")
        : null;

    let heading: string | null = null;
    if (md) heading = md[2].trim();
    else if (bold) heading = bold[1].trim();
    else if (roman && roman[1].length < 100) heading = roman[1].trim();
    else if (numbered && numbered[2].length < 80) heading = numbered[2].trim();
    else if (plainCaps && /[A-Za-z]{2,}/.test(plainCaps)) heading = plainCaps;

    if (heading) {
      if (current) sections.push(current);
      current = { heading, body: "" };
    } else if (current) {
      current.body += (current.body ? "\n" : "") + line;
    }
  }
  if (current) sections.push(current);
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
  const cleaned = cleanHeadingName(heading);
  const h = normalize(cleaned);
  let best: SquadMember | null = null;
  let bestScore = 0;
  for (const p of players) {
    if (namesLooselyMatch(cleaned, p.name) || namesLooselyMatch(heading, p.name)) {
      const score = normalizePlayerKey(p.name).length + 100;
      if (score > bestScore) {
        best = p;
        bestScore = score;
      }
      continue;
    }
    const full = normalize(p.name);
    const sur = normalize(surname(p.name));
    if (full.length >= 3 && (h === full || h.includes(full) || full.includes(h))) {
      const score = full.length + 80;
      if (score > bestScore) {
        best = p;
        bestScore = score;
      }
      continue;
    }
    if (sur.length >= 4) {
      const tokens = h.split(" ");
      if (tokens.includes(sur) || h.startsWith(sur + " ") || h.endsWith(" " + sur)) {
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
      const player = matchPlayer(first.replace(/^[-*•]\s*/, "").split(/[:—–-]/)[0], players);
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
    // Also scan full line for surname tokens
    let hit = player;
    if (!hit) {
      for (const p of players) {
        const sur = normalize(surname(p.name));
        if (sur.length >= 4 && normalize(cleaned).includes(sur)) {
          hit = p;
          break;
        }
      }
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
