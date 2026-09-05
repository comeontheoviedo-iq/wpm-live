"use client";

import {
  RESEARCH_STAGES,
  computeResearchStageProgress,
  type PackSectionLite,
} from "@/lib/research-stages";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function ResearchStagesHeader({
  sections,
  researchDistributed,
  onFillGap,
  fillBusy,
  discourageGenerate,
}: {
  sections: PackSectionLite[];
  researchDistributed?: boolean;
  onFillGap?: (templateKey: string) => void;
  fillBusy?: boolean;
  discourageGenerate?: boolean;
}) {
  const prog = computeResearchStageProgress({
    sections,
    researchDistributed,
  });
  const showDiscourage = discourageGenerate ?? prog.discourageFullGenerate;

  return (
    <div className="rounded-xl border border-violet-200 dark:border-violet-900 bg-violet-50/70 dark:bg-violet-950/30 px-3 py-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="text-xs font-bold text-violet-950 dark:text-violet-100">
            Research / Prep stages
          </div>
          <p className="text-[11px] text-violet-800/80 dark:text-violet-200/80">
            Gemini Notebook is the research source of truth. Paste → organise /
            tag. Prefer not to full re-Generate over paste.
          </p>
        </div>
        <div className="text-[11px] font-semibold tabular-nums text-violet-700 dark:text-violet-300">
          {prog.completed}/{prog.total} · {prog.pct}%
        </div>
      </div>

      <ol className="grid sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
        {RESEARCH_STAGES.map((stage, i) => {
          const ok = prog.done[stage.id];
          return (
            <li
              key={stage.id}
              title={stage.hint}
              className={cn(
                "rounded-lg border px-2 py-1.5 text-[10px]",
                ok
                  ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100"
                  : "border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/40 text-slate-600 dark:text-slate-300"
              )}
            >
              <div className="font-bold">
                {i + 1}. {stage.label}
              </div>
              <div className="opacity-80 mt-0.5 leading-snug">{stage.hint}</div>
            </li>
          );
        })}
      </ol>

      {showDiscourage && (
        <p className="text-[11px] font-medium text-amber-800 dark:text-amber-200 rounded-md border border-amber-300/80 bg-amber-50/80 dark:bg-amber-950/40 px-2 py-1">
          Notebook paste detected on Research — use{" "}
          <strong>Use my draft → desk notes</strong> instead of Generate.
          Generate will ask to confirm before replacing your paste.
        </p>
      )}

      {prog.missingFillKeys.length > 0 && onFillGap && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[10px] font-semibold text-slate-500">
            Fill gap only:
          </span>
          {prog.missingFillKeys.map((key) => (
            <Button
              key={key}
              size="sm"
              variant="outline"
              className="h-6 text-[10px]"
              disabled={fillBusy}
              onClick={() => onFillGap(key)}
            >
              {key}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
