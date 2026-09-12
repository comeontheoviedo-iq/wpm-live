/**
 * Research / Prep stage checklist.
 * One dump only — paste prep, then file into Notes, Scripts, profiles.
 * Scripts stay destinations (organise / Official XI), not peer generators.
 */

export type ResearchStageId =
  | "notebook_pasted"
  | "organised"
  | "intro_filled"
  | "lineup_filled"
  | "hooks_ready";

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
    label: "Prep pasted",
    hint: "Paste your prep into the single Research dump.",
    templateKeys: ["research"],
  },
  {
    id: "organised",
    label: "Filed",
    hint: "File into Notes, Scripts, profiles — one organise pass.",
    templateKeys: ["research"],
  },
  {
    id: "intro_filled",
    label: "Intro in Scripts",
    hint: "Intro lands in Scripts when you file — not a Research generator.",
    templateKeys: ["intro"],
  },
  {
    id: "lineup_filled",
    label: "Lineup in Scripts",
    hint: "Lineup script fills from organise or Official XI confirm.",
    templateKeys: ["lineup"],
  },
  {
    id: "hooks_ready",
    label: "Hooks in Notes",
    hint: "Hooks land in Notes when you file.",
    templateKeys: ["hooks"],
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

/** Heuristic: pasted prep often has ## headings or long prose. */
export function looksLikeNotebookPaste(content: string) {
  const t = content.trim();
  if (t.length < MIN_CHARS) return false;
  if (/^##\s+/m.test(t)) return true;
  if (/notebook|gemini|research brief/i.test(t.slice(0, 400))) return true;
  return t.length >= 280;
}

export function computeResearchStageProgress(opts: {
  sections: PackSectionLite[];
  /** True once user filed the research dump to desk notes */
  researchDistributed?: boolean;
}) {
  const { sections, researchDistributed } = opts;
  const research = sections.find((s) => s.templateKey === "research");
  const researchContent = research?.content || "";
  const pasted =
    looksLikeNotebookPaste(researchContent) ||
    sectionHasContent(sections, "research");
  const organised =
    Boolean(researchDistributed) ||
    (pasted &&
      /desk notes|organised|distributed|filed/i.test(research?.status || ""));

  const intro = sectionHasContent(sections, "intro");
  const lineup = sectionHasContent(sections, "lineup");
  const hooks = sectionHasContent(sections, "hooks");

  const done: Record<ResearchStageId, boolean> = {
    notebook_pasted: pasted,
    organised: organised || (pasted && Boolean(researchDistributed)),
    intro_filled: intro,
    lineup_filled: lineup,
    hooks_ready: hooks,
  };

  const completed = RESEARCH_STAGES.filter((s) => done[s.id]).length;
  const total = RESEARCH_STAGES.length;

  return {
    done,
    completed,
    total,
    pct: Math.round((completed / total) * 100),
    hasPaste: pasted,
  };
}
