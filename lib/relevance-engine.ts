/**
 * Relevance engine — arm note triggers (post-organise), fire on live events.
 * Cap 7 active relevant notes; TTL expiry; Esc clears via clearRelevant().
 */

export const RELEVANT_CAP = 7;
/** How long a fired note stays in the RELEVANT bucket */
export const RELEVANT_TTL_MS = 4 * 60 * 1000;

export type RelevanceNote = {
  id: string;
  title: string;
  body: string;
  category: string;
  entityType?: string | null;
  entityId?: string | null;
  pinned?: boolean;
};

export type RelevanceEvent = {
  type: string;
  minute?: number;
  description?: string;
  playerId?: string | null;
  teamSide?: string | null;
};

export type TriggerKind =
  | "goal"
  | "card"
  | "red"
  | "sub"
  | "penalty"
  | "var"
  | "player"
  | "club"
  | "any";

export type ArmedTrigger = {
  noteId: string;
  kinds: TriggerKind[];
  entityId: string | null;
  tokens: string[];
  /** Higher = prefer when capping */
  weight: number;
};

export type RelevantEntry = {
  noteId: string;
  armedAt: number;
  reason: string;
};

function hay(n: RelevanceNote): string {
  return `${n.title || ""}\n${n.body || ""}`.toLowerCase();
}

function tokenize(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .split(/[\s—–,.:;/()'"!?]+/)
        .map((p) => p.trim())
        .filter((p) => p.length >= 4)
    ),
  ].slice(0, 16);
}

/** Infer which event kinds this note should arm for (from organise/content). */
export function armTriggerKinds(n: RelevanceNote): TriggerKind[] {
  const h = hay(n);
  const kinds = new Set<TriggerKind>();

  if (/\b(goal|scorer|scored|finishing|clinical|net\b|brace|hat-?trick)\b/i.test(h)) {
    kinds.add("goal");
  }
  if (/\b(penalt|spot[- ]kick|from twelve)\b/i.test(h)) {
    kinds.add("penalty");
  }
  if (/\b(red card|sent off|sending[- ]off|ten men|10 men)\b/i.test(h)) {
    kinds.add("red");
  }
  if (/\b(yellow|booking|ill[- ]disciplin|card magnet|cards?\b)\b/i.test(h)) {
    kinds.add("card");
  }
  if (/\b(sub(stitution)?|bench|impact sub|super sub|fresh legs)\b/i.test(h)) {
    kinds.add("sub");
  }
  if (/\bvar\b|video assistant/i.test(h)) {
    kinds.add("var");
  }
  if (n.entityType === "player" && n.entityId) {
    kinds.add("player");
  }
  if (n.entityType === "club" || n.entityType === "coach") {
    kinds.add("club");
  }
  // Hooks / pinned always soft-arm as "any" so big moments can surface them
  if (n.category === "Hook" || n.category === "Funfact" || n.pinned) {
    kinds.add("any");
  }
  if (!kinds.size && (n.category === "Match" || n.category === "Hook")) {
    kinds.add("any");
  }
  return [...kinds];
}

function noteWeight(n: RelevanceNote, kinds: TriggerKind[]): number {
  let w = 1;
  if (n.pinned) w += 2;
  if (n.category === "Hook" || n.category === "Funfact") w += 2;
  if (n.category === "Match") w += 1;
  if (kinds.includes("goal") || kinds.includes("penalty")) w += 1;
  if (kinds.includes("player")) w += 1;
  return w;
}

/**
 * Arm triggers from desk notes (call after organise / on notes load).
 * Skips live event rows and empty stubs.
 */
export function armTriggersFromNotes(notes: RelevanceNote[]): ArmedTrigger[] {
  const out: ArmedTrigger[] = [];
  for (const n of notes) {
    // Skip auto live-event notes (minute' goal/card lines)
    if (
      n.category === "Match" &&
      /^\d{1,3}(?:\+\d{1,2})?\s*['′']/.test(n.title || "") &&
      /\b(goal|yellow|red|sub|card|var|penalt|own)\b/i.test(n.title || "")
    ) {
      continue;
    }
    const kinds = armTriggerKinds(n);
    if (!kinds.length) continue;
    const body = (n.body || "").trim();
    if (body.length < 20 && !(n.pinned || n.category === "Hook")) continue;
    out.push({
      noteId: n.id,
      kinds,
      entityId: n.entityId || null,
      tokens: tokenize(`${n.title} ${n.body}`),
      weight: noteWeight(n, kinds),
    });
  }
  return out;
}

function eventKinds(ev: RelevanceEvent): TriggerKind[] {
  const t = (ev.type || "").toLowerCase();
  const d = (ev.description || "").toLowerCase();
  const kinds: TriggerKind[] = [];
  if (/own_goal|goal|penalty_goal/.test(t) || /\bgoal\b/.test(d)) kinds.push("goal");
  if (/penalty/.test(t) || /penalt/.test(d)) kinds.push("penalty");
  if (/^red$|red_card/.test(t) || /\bred\b/.test(d)) kinds.push("red");
  if (/yellow|card/.test(t) || /\byellow\b|\bcard\b/.test(d)) kinds.push("card");
  if (/sub|subst/.test(t) || /\bsub(stitution)?\b/.test(d)) kinds.push("sub");
  if (/var/.test(t) || /\bvar\b/.test(d)) kinds.push("var");
  if (ev.playerId) kinds.push("player");
  kinds.push("any");
  return kinds;
}

/**
 * Fire armed triggers against a live event → matching note ids (best first).
 */
export function fireTriggers(
  armed: ArmedTrigger[],
  event: RelevanceEvent,
  opts?: { limit?: number }
): { noteId: string; reason: string; score: number }[] {
  const limit = opts?.limit ?? RELEVANT_CAP;
  const ekinds = new Set(eventKinds(event));
  const desc = `${event.description || ""}`.toLowerCase();
  const scored: { noteId: string; reason: string; score: number }[] = [];

  for (const a of armed) {
    let score = 0;
    const reasons: string[] = [];

    if (a.entityId && event.playerId && a.entityId === event.playerId) {
      score += 10;
      reasons.push("player");
    }
    const kindHits = a.kinds.filter((k) => k !== "any" && ekinds.has(k));
    if (kindHits.length) {
      score += 4 * kindHits.length;
      reasons.push(kindHits.join("+"));
    } else if (a.kinds.includes("any") && (ekinds.has("goal") || ekinds.has("red") || ekinds.has("penalty"))) {
      // Soft: any-armed notes only on big moments
      score += 2;
      reasons.push("any-big");
    } else if (a.kinds.includes("any")) {
      score += 0.5;
    } else {
      continue;
    }

    const tokHits = a.tokens.filter((tok) => desc.includes(tok)).length;
    if (tokHits) {
      score += Math.min(4, tokHits);
      reasons.push("tokens");
    }

    score += a.weight * 0.25;
    if (score < 2.5) continue;
    scored.push({
      noteId: a.noteId,
      reason: reasons.slice(0, 3).join(" · ") || "trigger",
      score,
    });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Drop expired entries. */
export function expireRelevant(
  entries: RelevantEntry[],
  now = Date.now(),
  ttlMs = RELEVANT_TTL_MS
): RelevantEntry[] {
  return entries.filter((e) => now - e.armedAt <= ttlMs);
}

/**
 * Merge newly fired note ids into the relevant session.
 * Cap RELEVANT_CAP; refresh TTL on re-fire; drop expired.
 */
export function mergeRelevant(
  prev: RelevantEntry[],
  incoming: { noteId: string; reason?: string }[],
  now = Date.now(),
  opts?: { cap?: number; ttlMs?: number }
): RelevantEntry[] {
  const cap = opts?.cap ?? RELEVANT_CAP;
  const ttlMs = opts?.ttlMs ?? RELEVANT_TTL_MS;
  const alive = expireRelevant(prev, now, ttlMs);
  const byId = new Map(alive.map((e) => [e.noteId, e]));

  for (const hit of incoming) {
    if (!hit.noteId) continue;
    byId.set(hit.noteId, {
      noteId: hit.noteId,
      armedAt: now,
      reason: hit.reason || byId.get(hit.noteId)?.reason || "fired",
    });
  }

  return [...byId.values()]
    .sort((a, b) => b.armedAt - a.armedAt)
    .slice(0, cap);
}

export function clearRelevant(): RelevantEntry[] {
  return [];
}

/** Attach arming summary after notebook organise (for distribute response). */
export function summariseArmedTriggers(armed: ArmedTrigger[]): {
  armedCount: number;
  byKind: Record<string, number>;
} {
  const byKind: Record<string, number> = {};
  for (const a of armed) {
    for (const k of a.kinds) {
      byKind[k] = (byKind[k] || 0) + 1;
    }
  }
  return { armedCount: armed.length, byKind };
}
