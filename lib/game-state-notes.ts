/**
 * Game-state → pre-match note matcher for LIVE desk.
 *
 * Classifies score/events (early/late, lead/trail, home/away scorer, HT/FT,
 * red card, etc.) and scores desk notes (Hook / Match / Team) with keyword
 * rules. Optional Gemini re-rank stays in the relevant-notes route.
 *
 * Factual from HIS notes only — never invents copy.
 */

export type GameStateEvent = {
  type: string;
  minute: number;
  description?: string;
  playerId?: string | null;
  teamSide?: string | null;
};

export type GameStateSnapshot = {
  minute: number;
  status: string;
  homeScore: number;
  awayScore: number;
  homeName: string;
  awayName: string;
  /** Latest actionable event that prompted re-score */
  trigger?: GameStateEvent | null;
  /** All match events (for cumulative cards / goals) */
  events?: GameStateEvent[];
};

export type GameStateTag =
  | "early_goal"
  | "late_goal"
  | "early_concede"
  | "late_concede"
  | "home_scores"
  | "away_scores"
  | "lead"
  | "trail"
  | "level"
  | "comeback"
  | "red_card"
  | "yellow_card"
  | "sub"
  | "halftime"
  | "fulltime"
  | "penalty"
  | "own_goal"
  | "first_goal"
  | "equaliser";

export type NoteForMatch = {
  id: string;
  title: string;
  body: string;
  category: string;
  entityType?: string | null;
  entityId?: string | null;
  pinned?: boolean;
};

export type GameStateNoteHit = {
  noteId: string;
  score: number;
  reason: string;
  tags: GameStateTag[];
};

const EARLY_MAX = 20;
const LATE_MIN = 75;

function isGoal(t: string) {
  return /^(goal|penalty_goal|own_goal)$/i.test(t || "");
}

/** Infer which side scored from event teamSide or description vs club names. */
export function inferScorerSide(
  ev: GameStateEvent | null | undefined,
  homeName: string,
  awayName: string
): "home" | "away" | null {
  if (!ev) return null;
  const side = (ev.teamSide || "").toLowerCase();
  if (/own_goal/i.test(ev.type || "")) {
    // AF teamSide on own goals is usually the team that put it in their net
    if (side === "home") return "away";
    if (side === "away") return "home";
  }
  if (side === "home" || side === "away") return side as "home" | "away";
  const d = `${ev.description || ""}`.toLowerCase();
  const h = homeName.toLowerCase();
  const a = awayName.toLowerCase();
  if (h && d.includes(h)) return "home";
  if (a && d.includes(a)) return "away";
  return null;
}

/** Classify current match moment into tags for note matching. */
export function classifyGameState(snap: GameStateSnapshot): GameStateTag[] {
  const tags: GameStateTag[] = [];
  const { minute, status, homeScore, awayScore, trigger, events = [] } = snap;
  const goals = events.filter((e) => isGoal(e.type));

  if (/half.?time/i.test(status)) tags.push("halftime");
  if (/full.?time|finished/i.test(status)) tags.push("fulltime");

  if (homeScore > awayScore) tags.push("lead");
  else if (awayScore > homeScore) tags.push("trail");
  else tags.push("level");

  const trig = trigger;
  if (trig) {
    if (isGoal(trig.type)) {
      const side = inferScorerSide(trig, snap.homeName, snap.awayName);
      if (side === "home") tags.push("home_scores");
      if (side === "away") tags.push("away_scores");
      if (trig.minute <= EARLY_MAX) {
        tags.push("early_goal");
        tags.push("early_concede");
      }
      if (trig.minute >= LATE_MIN) {
        tags.push("late_goal");
        tags.push("late_concede");
      }
      if (/own_goal/i.test(trig.type)) tags.push("own_goal");
      if (/penalty_goal/i.test(trig.type)) tags.push("penalty");
      if (goals.length <= 1) tags.push("first_goal");
      if (homeScore === awayScore && homeScore + awayScore > 0) {
        tags.push("equaliser");
      }
      if (homeScore === awayScore && goals.length >= 2) tags.push("comeback");
    }
    if (/^red$/i.test(trig.type)) tags.push("red_card");
    if (/^yellow$/i.test(trig.type)) tags.push("yellow_card");
    if (/^sub$/i.test(trig.type)) tags.push("sub");
    if (/penalty_miss/i.test(trig.type)) tags.push("penalty");
  }

  if (!trig && minute <= EARLY_MAX && (homeScore > 0 || awayScore > 0)) {
    tags.push("early_goal");
  }
  if (!trig && minute >= LATE_MIN) {
    tags.push("late_goal");
  }

  return [...new Set(tags)];
}

type PatternRule = {
  tag: GameStateTag;
  weight: number;
  test: (hay: string) => boolean;
};

const PATTERN_RULES: PatternRule[] = [
  {
    tag: "early_goal",
    weight: 6,
    test: (h) =>
      /score early|early goal|fast start|open(ing)? (the )?scoring|first \d+ minut|within (the )?(first )?\d+|quick start|early doors/i.test(
        h
      ),
  },
  {
    tag: "late_goal",
    weight: 6,
    test: (h) =>
      /late goal|score late|last[- ]gasp|stoppage|injury time|late drama/i.test(h),
  },
  {
    tag: "late_concede",
    weight: 7,
    test: (h) =>
      /concede late|late conced|leak late|soft late|ship(ped)? late|vulnerable late|late goal against|conced(e|es|ing) after/i.test(
        h
      ),
  },
  {
    tag: "early_concede",
    weight: 7,
    test: (h) =>
      /concede early|early conced|slow start|fall(s|ing)? behind early|ship(ped)? early/i.test(
        h
      ),
  },
  {
    tag: "first_goal",
    weight: 4,
    test: (h) =>
      /score first|first goal|open(s|ing)? the scoring|draw first blood/i.test(h),
  },
  {
    tag: "equaliser",
    weight: 5,
    test: (h) =>
      /equalis|level(l)?er|come from behind|comeback|rescue a point/i.test(h),
  },
  {
    tag: "comeback",
    weight: 5,
    test: (h) => /comeback|from behind|recover(y|ed)|turn(ed)? it around/i.test(h),
  },
  {
    tag: "red_card",
    weight: 6,
    test: (h) =>
      /red card|sent off|sending[- ]off|ten men|10 men|disciplinary/i.test(h),
  },
  {
    tag: "yellow_card",
    weight: 3,
    test: (h) => /yellow|booking|ill[- ]disciplin|card magnet/i.test(h),
  },
  {
    tag: "penalty",
    weight: 5,
    test: (h) => /penalty|spot[- ]kick|from twelve/i.test(h),
  },
  {
    tag: "own_goal",
    weight: 4,
    test: (h) => /own goal/i.test(h),
  },
  {
    tag: "sub",
    weight: 3,
    test: (h) =>
      /impact sub|super sub|bench threat|fresh legs|change(s)? game/i.test(h),
  },
  {
    tag: "halftime",
    weight: 3,
    test: (h) => /half[- ]time|at the break|first half/i.test(h),
  },
  {
    tag: "fulltime",
    weight: 2,
    test: (h) => /full[- ]time|final whistle|how it finishes/i.test(h),
  },
  {
    tag: "lead",
    weight: 2,
    test: (h) =>
      /when ahead|protect(ing)? a lead|game management|see it out/i.test(h),
  },
  {
    tag: "trail",
    weight: 2,
    test: (h) =>
      /when behind|chase(ing)? the game|need(s)? a goal|go(ing)? for broke/i.test(
        h
      ),
  },
];

/**
 * Score notes against classified game-state tags.
 * Prefer Hook / Match / Team categories; still allow others with lower base.
 */
export function scoreNotesAgainstGameState(opts: {
  notes: NoteForMatch[];
  tags: GameStateTag[];
  trigger?: GameStateEvent | null;
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  homeClubId?: string | null;
  awayClubId?: string | null;
  limit?: number;
}): GameStateNoteHit[] {
  const tagSet = new Set(opts.tags);
  const limit = opts.limit ?? 8;
  const scorerSide = inferScorerSide(
    opts.trigger || null,
    opts.homeName,
    opts.awayName
  );

  const scored = opts.notes.map((n) => {
    let score = 0;
    const reasons: string[] = [];
    const matchedTags: GameStateTag[] = [];
    const hay = `${n.title}\n${n.body}`.toLowerCase();
    const cat = (n.category || "").toLowerCase();

    if (/hook|funfact/i.test(cat)) {
      score += 2;
      reasons.push("hook");
    } else if (/match/i.test(cat)) {
      score += 2;
      reasons.push("match");
    } else if (/team|club/i.test(cat)) {
      score += 1.5;
      reasons.push("team");
    }
    if (n.pinned) score += 0.5;

    for (const rule of PATTERN_RULES) {
      if (!tagSet.has(rule.tag)) continue;
      if (!rule.test(hay)) continue;

      let add = rule.weight;
      if (rule.tag === "late_concede" || rule.tag === "early_concede") {
        if (scorerSide && opts.homeClubId && opts.awayClubId) {
          const concedeClubId =
            scorerSide === "home" ? opts.awayClubId : opts.homeClubId;
          if (n.entityType === "club" && n.entityId === concedeClubId) add += 2;
          const conceder =
            scorerSide === "home" ? opts.awayName : opts.homeName;
          if (conceder && hay.includes(conceder.toLowerCase())) add += 2;
        }
      } else if (rule.tag === "early_goal" || rule.tag === "late_goal") {
        if (
          scorerSide === "home" &&
          opts.homeName &&
          hay.includes(opts.homeName.toLowerCase())
        ) {
          add += 2;
        }
        if (
          scorerSide === "away" &&
          opts.awayName &&
          hay.includes(opts.awayName.toLowerCase())
        ) {
          add += 2;
        }
      }

      if (rule.tag === "lead" || rule.tag === "trail") {
        if (n.entityType === "club" && n.entityId) {
          const homeLeading = opts.homeScore > opts.awayScore;
          const awayLeading = opts.awayScore > opts.homeScore;
          if (rule.tag === "lead") {
            if (n.entityId === opts.homeClubId && !homeLeading) continue;
            if (n.entityId === opts.awayClubId && !awayLeading) continue;
          }
          if (rule.tag === "trail") {
            if (n.entityId === opts.homeClubId && !awayLeading) continue;
            if (n.entityId === opts.awayClubId && !homeLeading) continue;
          }
        }
      }

      score += add;
      matchedTags.push(rule.tag);
      reasons.push(rule.tag);
    }

    if (opts.trigger?.playerId && n.entityId === opts.trigger.playerId) {
      score += 5;
      reasons.push("event player");
    }

    if (
      tagSet.has("level") &&
      /draw specialists|share the spoils|tight affair/i.test(hay)
    ) {
      score += 2;
      reasons.push("level");
      matchedTags.push("level");
    }

    return {
      noteId: n.id,
      score,
      reason: reasons.slice(0, 4).join(" · ") || "context",
      tags: [...new Set(matchedTags)],
    };
  });

  return scored
    .filter((x) => x.score >= 4 && x.tags.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Build a compact gameState payload for the relevant-notes API. */
export function buildGameStatePayload(
  snap: GameStateSnapshot
): GameStateSnapshot & { tags: GameStateTag[] } {
  return { ...snap, tags: classifyGameState(snap) };
}
