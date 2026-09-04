export type EventType =
  | "goal"
  | "own_goal"
  | "penalty_goal"
  | "penalty_miss"
  | "yellow"
  | "red"
  | "sub"
  | "kickoff"
  | "halftime"
  | "fulltime"
  | "corner"
  | "save"
  | "chance"
  | "var"
  | "injury";

const templates: Record<EventType, string[]> = {
  goal: [
    "It's in! {player} finds the net for {team} — {score}. Clinical finish.",
    "GOAL! {player} wheels away in celebration. {team} lead the scoring charts again.",
    "{minute}' — {player} strikes! The travelling support erupts as {team} make it {score}.",
  ],
  own_goal: [
    "Disaster for {team} — an own goal under pressure. Scoreline flips to {score}.",
    "Unfortunate deflection. Own goal credited against {team}. It's {score}.",
  ],
  penalty_goal: [
    "Cool as you like from the spot. {player} converts the penalty. {score}.",
    "Penalty tucked away by {player}. Keeper went the wrong way — {score}.",
  ],
  penalty_miss: [
    "Saved! Or wide! {player} misses from twelve yards. Huge moment.",
    "Penalty miss — {player} can't convert. The net stays untouched.",
  ],
  yellow: [
    "Yellow card for {player}. The referee reaches into the pocket at {minute}'.",
    "{player} is booked. Caution for {team} after a late challenge.",
  ],
  red: [
    "RED CARD! {player} is sent off. {team} down to ten men.",
    "Straight red for {player}. The complexion of this contest changes at {minute}'.",
  ],
  sub: [
    "Change for {team}. Fresh legs introduced at {minute}'.",
    "Substitution: {player} involved as {team} reshuffle.",
  ],
  kickoff: [
    "We're underway! {home} vs {away} — Northern Premier Demo League.",
    "Kick-off! The referee's whistle starts proceedings under these skies.",
  ],
  halftime: [
    "Half-time. Score at the break: {score}. Plenty still to play for.",
    "The whistle for half-time. {score} after forty-five.",
  ],
  fulltime: [
    "Full time! Final score {score}. What a contest.",
    "That's it — the referee ends it. {score} is how it finishes.",
  ],
  corner: [
    "Corner to {team}. Bodies packing the box.",
    "Flag raised — corner kick for {team} at {minute}'.",
  ],
  save: [
    "Outstanding save! The keeper keeps {team} out.",
    "Denied! A strong hand turns it away at {minute}'.",
  ],
  chance: [
    "Big chance! {player} should have done better for {team}.",
    "So close — {player} rattles the woodwork or flashes wide.",
  ],
  var: [
    "VAR check ongoing. Everyone holding their breath.",
    "The referee is going to the monitor. Decision pending.",
  ],
  injury: [
    "Stoppage as medical staff attend to {player}.",
    "Concern for {player} — physio on the pitch at {minute}'.",
  ],
};

export function suggestCommentary(
  type: EventType,
  vars: Record<string, string | number>
): string[] {
  const list = templates[type] || ["Event noted at {minute}'."];
  return list.map((t) =>
    t.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ""))
  );
}

export const EVENT_SHORTCUTS: { key: string; type: EventType; label: string }[] =
  [
    { key: "g", type: "goal", label: "Goal" },
    { key: "y", type: "yellow", label: "Yellow" },
    { key: "r", type: "red", label: "Red" },
    { key: "s", type: "sub", label: "Sub" },
    { key: "c", type: "corner", label: "Corner" },
    { key: "v", type: "var", label: "VAR" },
    { key: "h", type: "halftime", label: "HT" },
    { key: "f", type: "fulltime", label: "FT" },
  ];
