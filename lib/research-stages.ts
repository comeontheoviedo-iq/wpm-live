/**
 * Research / Prep stage checklist.
 * Gemini Notebook paste is the research source of truth — organise/tag only;
 * do not full re-Generate on top of paste.
 */

export type ResearchStageId =
  | "notebook_pasted"
  | "organised"
  | "intro_filled"
  | "lineup_filled"
  | "hooks_ready"
  | "gaps_only";

export type ResearchStage = {
  id: ResearchStageId;
  label: string;
  hint: string;
  /** Pack template keys that satisfy this stage when contentful */
  templateKeys?: string[];
};

export const RESEARCH_STAGES: ResearchStage[] = [
  {
    id: "notebook_pasted",
    label: "Notebook pasted",
    hint: "Paste Gemini Notebook research into Research (or section editors).",
    templateKeys: ["research"],
  },
  {
    id: "organised",
    label: "Organised",
    hint: "Use my draft → desk notes: routes Notebook into Notes + Intro Scripts. Do not re-Generate over paste.",
    templateKeys: ["research"],
  },
  {
    id: "intro_filled",
    label: "Intro filled",
    hint: "Auto-fills from Notebook intro/script on organise — or paste into Intro.",
    templateKeys: ["intro"],
  },
  {
    id: "lineup_filled",
    label: "Lineup filled",
    hint: "Lineup script — from Notebook organise or auto on Official XI confirm.",
    templateKeys: ["lineup"],
  },
  {
    id: "hooks_ready",
    label: "Hooks ready",
    hint: "Hooks / fillers section ready for live.",
    templateKeys: ["hooks"],
  },
  {
    id: "gaps_only",
    label: "Gaps only",
    hint: "Optional: Fill gap on missing sections only — never full re-research.",
  },
];

export type PackSectionLite = {
  templateKey: string;
  content: string;
  status?: string;
};

const MIN_CHARS = 40;

export function sectionHasContent(sections: PackSectionLite[], key: string) {
  const s = sections.find((x) => x.templateKey === key);
  return Boolean(s && s.content.trim().length >= MIN_CHARS);
}

/** Heuristic: pasted Notebook often has ## headings or long prose. */
export function looksLikeNotebookPaste(content: string) {
  const t = content.trim();
  if (t.length < MIN_CHARS) return false;
  if (/^##\s+/m.test(t)) return true;
  if (/notebook|gemini|research brief/i.test(t.slice(0, 400))) return true;
  return t.length >= 280;
}

export function computeResearchStageProgress(opts: {
  sections: PackSectionLite[];
  /** True once user distributed research draft to desk notes */
  researchDistributed?: boolean;
}) {
  const { sections, researchDistributed } = opts;
  const research = sections.find((s) => s.templateKey === "research");
  const researchContent = research?.content || "";
  const pasted = looksLikeNotebookPaste(researchContent) || sectionHasContent(sections, "research");
  const organised = Boolean(researchDistributed) || (pasted && /desk notes|organised|distributed/i.test(research?.status || ""));
  // If they used draft→notes we pass researchDistributed from client localStorage/flag

  const intro = sectionHasContent(sections, "intro");
  const lineup = sectionHasContent(sections, "lineup");
  const hooks = sectionHasContent(sections, "hooks");

  const done: Record<ResearchStageId, boolean> = {
    notebook_pasted: pasted,
    organised: organised || (pasted && Boolean(researchDistributed)),
    intro_filled: intro,
    lineup_filled: lineup,
    hooks_ready: hooks,
    gaps_only: pasted && intro && lineup && hooks,
  };

  const missingFillKeys = (["intro", "lineup", "hooks", "profiles", "referee"] as const).filter(
    (k) => !sectionHasContent(sections, k)
  );

  const completed = RESEARCH_STAGES.filter((s) => done[s.id]).length;
  const total = RESEARCH_STAGES.length;

  return {
    done,
    completed,
    total,
    pct: Math.round((completed / total) * 100),
    missingFillKeys: [...missingFillKeys],
    discourageFullGenerate: pasted,
  };
}
