/**
 * Scored-goal helpers for desk GOALS list, tallies, and sync prune.
 * AF can emit duplicate Goal rows (assist/minute drift) and leave cancelled
 * goals in our DB after VAR overturn — filter/dedupe so UI matches the score.
 */

export const SCORED_GOAL_TYPES = ["goal", "penalty_goal", "own_goal"] as const;

export type ScoredGoalType = (typeof SCORED_GOAL_TYPES)[number];

export function isScoredGoalType(type: string | null | undefined): boolean {
  return SCORED_GOAL_TYPES.includes(
    String(type || "").toLowerCase() as ScoredGoalType
  );
}

/** AF detail / stored description looks like a disallowed or cancelled goal. */
export function isCancelledGoalText(text: string | null | undefined): boolean {
  const d = String(text || "").toLowerCase();
  if (!d) return false;
  return (
    /goal\s*(cancelled|canceled|disallowed|annulled)/i.test(d) ||
    /(cancelled|canceled|disallowed|annulled)\s*goal/i.test(d) ||
    /\b(disallowed|annulled|overturned|not given|no goal)\b/i.test(d) ||
    (/\bcancel/.test(d) && /\bgoal\b/.test(d))
  );
}

function scorerKey(e: {
  playerId?: string | null;
  description?: string | null;
}): string {
  if (e.playerId) return `id:${e.playerId}`;
  const raw = String(e.description || "");
  const after = raw.replace(/^.*?[—–-]\s*/, "").trim() || raw;
  const name = after.replace(/\s*\([^)]*\)\s*$/, "").trim().toLowerCase();
  return name ? `name:${name}` : `raw:${raw.toLowerCase().slice(0, 48)}`;
}

export type GoalLike = {
  id?: string;
  type: string;
  minute?: number | null;
  description?: string | null;
  playerId?: string | null;
  teamSide?: string | null;
};

/**
 * Real scored goals only: drop cancelled text, keep one row per scorer/side
 * within ±2' (AF often re-emits the same goal as minute/assist updates).
 */
export function selectScoredGoals<T extends GoalLike>(events: T[]): T[] {
  const goals = events
    .filter((e) => isScoredGoalType(e.type))
    .filter((e) => !isCancelledGoalText(e.description))
    .slice()
    .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));

  const kept: T[] = [];
  for (const g of goals) {
    const key = scorerKey(g);
    const side = g.teamSide || "";
    const dupIdx = kept.findIndex((k) => {
      if (scorerKey(k) !== key) return false;
      if ((k.teamSide || "") !== side) return false;
      return Math.abs((k.minute ?? 0) - (g.minute ?? 0)) <= 2;
    });
    if (dupIdx < 0) {
      kept.push(g);
      continue;
    }
    const prev = kept[dupIdx]!;
    if ((g.description || "").length >= (prev.description || "").length) {
      kept[dupIdx] = g;
    }
  }
  return kept;
}
