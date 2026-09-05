export const DEFAULT_CHECKLIST: {
  label: string;
  category: string;
  order: number;
}[] = [
  { label: "Confirm kick-off time & venue access", category: "prep", order: 1 },
  { label: "Pull expected / official lineups", category: "prep", order: 2 },
  { label: "Review injuries & absences", category: "prep", order: 3 },
  { label: "Write / generate intro script", category: "scripts", order: 4 },
  { label: "Load research pack + hooks", category: "scripts", order: 5 },
  { label: "Weather & pitch report", category: "prep", order: 6 },
  { label: "Test headset & backup mic", category: "tech", order: 7 },
  { label: "Sync live event composer shortcuts", category: "tech", order: 8 },
  { label: "Print / export match pack", category: "export", order: 9 },
  { label: "Ready for Go Live", category: "on-air", order: 10 },
];

export const DEFAULT_SCRIPT_SLOTS: {
  title: string;
  body: string;
  timing: string;
  order: number;
}[] = [
  {
    title: "Cold open",
    body: "Placeholder — generate from Research or write your open.",
    timing: "pre-match",
    order: 1,
  },
  {
    title: "Lineup read",
    body: "Placeholder — pull confirmed XI then generate lineup read.",
    timing: "kickoff",
    order: 2,
  },
  {
    title: "Half-time bridge",
    body: "Placeholder — scoreline, key moment, second-half watch.",
    timing: "half-time",
    order: 3,
  },
  {
    title: "Full-time wrap",
    body: "Placeholder — final score, standout performers, next fixture.",
    timing: "full-time",
    order: 4,
  },
];

export const NOTE_CATEGORIES = [
  "Bio",
  "Funfact",
  "Match",
  "Career",
  "Injury",
  "Hook",
  "Custom",
] as const;

export type NoteCategory = (typeof NOTE_CATEGORIES)[number];
