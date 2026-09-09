/**
 * Persist data-viz flash payloads into Notes -> VIZ bucket.
 * Summaries only use numbers present on the payload - never invent facts.
 */

import type { VizPayload, VizFlashKind } from "@/lib/viz-build";

/** Body fence so Notes can reopen the exact viz that was flashed. */
export const VIZ_PAYLOAD_MARKER = "[[viz-payload]]";

export function stripVizPayload(body: string): string {
  const idx = body.indexOf(VIZ_PAYLOAD_MARKER);
  if (idx < 0) return body;
  return body.slice(0, idx).replace(/\s+$/, "");
}

export function embedVizPayload(body: string, viz: VizPayload): string {
  const clean = stripVizPayload(body);
  return `${clean}\n\n${VIZ_PAYLOAD_MARKER}\n${JSON.stringify(viz)}`;
}

export function extractVizPayload(body: string | null | undefined): VizPayload | null {
  if (!body) return null;
  const idx = body.indexOf(VIZ_PAYLOAD_MARKER);
  if (idx < 0) return null;
  const raw = body.slice(idx + VIZ_PAYLOAD_MARKER.length).trim();
  try {
    const parsed = JSON.parse(raw) as VizPayload;
    if (!parsed || typeof parsed !== "object" || !parsed.kind) return null;
    return parsed;
  } catch {
    return null;
  }
}


const KIND_TITLE: Record<VizFlashKind, string> = {
  shot_map: "Shot map",
  xg_race: "xG race",
  xg_timeline: "xG timeline",
  shot_outcome: "Shot outcomes",
  xg_vs_goals: "xG vs goals",
  possession: "Possession",
  shots_compare: "Shots",
  corners_fouls: "Corners & fouls",
  pass_pct: "Pass accuracy",
  match_dna: "Match DNA",
  leaderboard: "Leaderboard",
  gk_saves: "Goalkeeper saves",
  goal_timeline: "Goal timeline",
  card_timeline: "Card timeline",
  momentum_proxy: "Momentum",
};

function fmtNum(n: number | null | undefined, digits = 2): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  const r = Math.round(n * Math.pow(10, digits)) / Math.pow(10, digits);
  return String(r);
}

/** Stable key so re-showing the same viz updates instead of duplicating. */
export function vizNoteDedupeKey(
  viz: VizPayload,
  scoreline?: string | null
): string {
  const parts: string[] = [viz.kind];
  if (viz.homeXg != null) parts.push(`hxg:${fmtNum(viz.homeXg)}`);
  if (viz.awayXg != null) parts.push(`axg:${fmtNum(viz.awayXg)}`);
  if (viz.homeGoals != null) parts.push(`hg:${viz.homeGoals}`);
  if (viz.awayGoals != null) parts.push(`ag:${viz.awayGoals}`);
  if (viz.compare?.length) {
    parts.push(
      "cmp:" +
        viz.compare
          .map((c) => `${c.label}:${fmtNum(c.home)}-${fmtNum(c.away)}`)
          .join("|")
    );
  }
  if (viz.dna?.length) {
    parts.push(
      "dna:" +
        viz.dna
          .map((c) => `${c.label}:${fmtNum(c.home)}-${fmtNum(c.away)}`)
          .join("|")
    );
  }
  if (viz.leaderboard?.length) {
    parts.push(
      "lb:" +
        (viz.leaderboardTitle || "") +
        ":" +
        viz.leaderboard
          .slice(0, 3)
          .map((r) => `${r.name}:${r.value}`)
          .join("|")
    );
  }
  if (viz.gkName && viz.gkSaves != null) {
    parts.push(`gk:${viz.gkName}:${viz.gkSaves}`);
  }
  if (viz.timelineEvents?.length) {
    parts.push(
      "tl:" +
        viz.timelineEvents
          .slice(0, 6)
          .map((e) => `${e.minute}${e.side[0]}${e.type[0]}`)
          .join(",")
    );
  }
  if (viz.shots?.length) parts.push(`shots:${viz.shots.length}`);
  if (viz.possessionSamples?.length) {
    const last = viz.possessionSamples[viz.possessionSamples.length - 1];
    parts.push(`poss:${viz.possessionSamples.length}:${fmtNum(last, 1)}`);
  }
  if (scoreline) parts.push(`sc:${scoreline}`);
  const raw = parts.join(";");
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  }
  return `viz:${viz.kind}:${(hash >>> 0).toString(36)}`;
}

export function summarizeVizForNote(
  viz: VizPayload,
  opts?: {
    homeName?: string | null;
    awayName?: string | null;
    scoreline?: string | null;
    contextTitle?: string | null;
  }
): { title: string; body: string; dedupeKey: string } {
  const home = opts?.homeName || "Home";
  const away = opts?.awayName || "Away";
  const kindLabel = KIND_TITLE[viz.kind] || viz.kind;
  const title = `VIZ · ${kindLabel}`;
  const lines: string[] = [];
  if (opts?.contextTitle) lines.push(String(opts.contextTitle));
  if (opts?.scoreline) lines.push(opts.scoreline);

  switch (viz.kind) {
    case "xg_race":
    case "xg_timeline":
    case "xg_vs_goals": {
      const hx = fmtNum(viz.homeXg);
      const ax = fmtNum(viz.awayXg);
      if (hx != null && ax != null) lines.push(`xG ${home} ${hx} - ${ax} ${away}`);
      if (viz.homeGoals != null && viz.awayGoals != null) {
        lines.push(`Goals ${home} ${viz.homeGoals} - ${viz.awayGoals} ${away}`);
      }
      if (viz.shots?.length) lines.push(`${viz.shots.length} shots plotted`);
      break;
    }
    case "shot_map":
    case "shot_outcome": {
      if (viz.shots?.length) lines.push(`${viz.shots.length} shots`);
      const hx = fmtNum(viz.homeXg);
      const ax = fmtNum(viz.awayXg);
      if (hx != null && ax != null) lines.push(`xG ${home} ${hx} - ${ax} ${away}`);
      break;
    }
    case "possession": {
      if (viz.compare?.[0]) {
        const c = viz.compare[0];
        lines.push(`${c.label}: ${home} ${c.home} - ${c.away} ${away}`);
      } else if (viz.possessionSamples?.length) {
        const last = viz.possessionSamples[viz.possessionSamples.length - 1];
        lines.push(
          `Possession samples: ${viz.possessionSamples.length} (latest home ${fmtNum(last, 1)}%)`
        );
      }
      break;
    }
    case "shots_compare":
    case "corners_fouls":
    case "pass_pct": {
      if (viz.compareTitle) lines.push(viz.compareTitle);
      for (const c of viz.compare || []) {
        lines.push(`${c.label}: ${home} ${c.home} - ${c.away} ${away}`);
      }
      break;
    }
    case "match_dna": {
      lines.push("Match DNA");
      for (const c of viz.dna || []) {
        lines.push(`${c.label}: ${home} ${c.home} - ${c.away} ${away}`);
      }
      break;
    }
    case "leaderboard": {
      lines.push(viz.leaderboardTitle || "Leaderboard");
      for (const r of viz.leaderboard || []) {
        lines.push(`${r.name} (${r.side}) ${r.value}`);
      }
      break;
    }
    case "gk_saves": {
      if (viz.gkName != null && viz.gkSaves != null) {
        lines.push(`${viz.gkName}: ${viz.gkSaves} saves`);
      }
      for (const c of viz.compare || []) {
        lines.push(`${c.label}: ${home} ${c.home} - ${c.away} ${away}`);
      }
      break;
    }
    case "goal_timeline":
    case "card_timeline": {
      lines.push(viz.timelineTitle || kindLabel);
      for (const e of viz.timelineEvents || []) {
        const who = e.label ? ` - ${e.label}` : "";
        lines.push(`${e.minute}' ${e.side} ${e.type}${who}`);
      }
      break;
    }
    case "momentum_proxy": {
      if (viz.momentumSamples?.length) {
        lines.push(`${viz.momentumSamples.length} momentum samples`);
        const last = viz.momentumSamples[viz.momentumSamples.length - 1];
        if (last) {
          lines.push(
            `Latest score ${last.homeScore}-${last.awayScore}` +
              (last.homePoss != null ? ` · poss ${last.homePoss}` : "")
          );
        }
      }
      for (const c of viz.compare || []) {
        lines.push(`${c.label}: ${home} ${c.home} - ${c.away} ${away}`);
      }
      break;
    }
    default:
      break;
  }

  const body = lines.filter(Boolean).join("\n").trim() || kindLabel;
  return {
    title,
    body,
    dedupeKey: vizNoteDedupeKey(viz, opts?.scoreline),
  };
}

/**
 * Upsert a VIZ note via /api/notes (create or PATCH existing by entityId).
 * Soft-fails - never throws to the desk popup path.
 */
export async function upsertVizNote(opts: {
  matchId: string;
  viz: VizPayload;
  homeName?: string | null;
  awayName?: string | null;
  scoreline?: string | null;
  contextTitle?: string | null;
}): Promise<{ id: string } | null> {
  try {
    const summarized = summarizeVizForNote(opts.viz, {
      homeName: opts.homeName,
      awayName: opts.awayName,
      scoreline: opts.scoreline,
      contextTitle: opts.contextTitle,
    });
    const title = summarized.title;
    const dedupeKey = summarized.dedupeKey;
    // Persist full viz payload so clicking the VIZ note reopens the same renderer.
    const body = embedVizPayload(summarized.body, opts.viz);
    const q = new URLSearchParams({
      matchId: opts.matchId,
      entityType: "viz",
      entityId: dedupeKey,
    });
    const listRes = await fetch(`/api/notes?${q.toString()}`, {
      cache: "no-store",
    });
    if (listRes.ok) {
      const json = await listRes.json();
      const existing = (json.notes || []) as { id: string }[];
      const hit = existing[0];
      if (hit?.id) {
        const patch = await fetch(`/api/notes/${hit.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, body, category: "Viz", pinned: false }),
        });
        if (patch.ok) return { id: hit.id };
      }
    }
    const create = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId: opts.matchId,
        title,
        body,
        category: "Viz",
        entityType: "viz",
        entityId: dedupeKey,
        pinned: false,
      }),
    });
    if (!create.ok) return null;
    const created = await create.json();
    return created.note?.id ? { id: created.note.id } : null;
  } catch {
    return null;
  }
}
