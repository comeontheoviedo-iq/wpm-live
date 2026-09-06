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
    <div className="panel-surface px-3 py-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="text-desk-label text-[var(--foreground)]">
            Research / Prep stages
          </div>
          <p className="text-[11px] text-[var(--muted)] mt-0.5">
            Gemini Notebook is the research source of truth. Paste → organise /
            tag. Prefer not to full re-Generate over paste.
          </p>
        </div>
        <div className="text-[11px] font-semibold tabular-nums text-[var(--muted)]">
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
                "rounded-[var(--radius-sm)] border px-2 py-1.5 text-[10px]",
                ok
                  ? "border-[var(--success)]/50 bg-[var(--surface)] text-[var(--foreground)] shadow-xs"
                  : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)]"
              )}
            >
              <div className="font-bold text-[var(--foreground)]">
                {i + 1}. {stage.label}
              </div>
              <div className="opacity-80 mt-0.5 leading-snug">{stage.hint}</div>
            </li>
          );
        })}
      </ol>

      {showDiscourage && (
        <p className="text-[11px] font-medium text-[var(--foreground)] rounded-[var(--radius-sm)] border border-[var(--warning)]/40 bg-[var(--surface-muted)] px-2 py-1">
          Notebook paste detected on Research — use{" "}
          <strong>Use my draft → desk notes</strong> to route intro scripts,
          hooks, and notes (Notebook wins over Gemini Intro). Generate will ask
          to confirm before replacing your paste.
        </p>
      )}
      {prog.done.organised && !prog.done.intro_filled && (
        <p className="text-[11px] text-[var(--muted)] rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-1">
          Organised — if Intro is still empty, re-run{" "}
          <strong>Use my draft → desk notes</strong> so SECTION 1 syncs into
          Scripts.
        </p>
      )}

      {prog.missingFillKeys.length > 0 && onFillGap && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[10px] font-semibold text-[var(--muted)]">
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
