"use client";

import {
  RESEARCH_STAGES,
  computeResearchStageProgress,
  type PackSectionLite,
} from "@/lib/research-stages";
import { cn } from "@/lib/utils";

export function ResearchStagesHeader({
  sections,
  researchDistributed,
}: {
  sections: PackSectionLite[];
  researchDistributed?: boolean;
}) {
  const prog = computeResearchStageProgress({
    sections,
    researchDistributed,
  });

  return (
    <div className="panel-surface px-3 py-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="text-desk-label text-[var(--foreground)]">
            Research dump
          </div>
          <p className="text-[11px] text-[var(--muted)] mt-0.5">
            Bring your notes / paste your prep — we file them into Notes, Scripts, profiles.
          </p>
        </div>
        <div className="text-[11px] font-semibold tabular-nums text-[var(--muted)]">
          {prog.completed}/{prog.total} · {prog.pct}%
        </div>
      </div>

      <ol className="grid sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
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

      {prog.hasPaste && !prog.done.organised && (
        <p className="text-[11px] font-medium text-[var(--foreground)] rounded-[var(--radius-sm)] border border-[var(--warning)]/40 bg-[var(--surface-muted)] px-2 py-1">
          Prep is in the dump —{" "}
          <strong>File into Notes & Scripts</strong> routes intro, hooks, and
          profiles. Scripts stay destinations, not extra generators.
        </p>
      )}
      {prog.done.organised && !prog.done.intro_filled && (
        <p className="text-[11px] text-[var(--muted)] rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-1">
          Filed — if Intro is still empty, file again so section 1 lands in
          Scripts.
        </p>
      )}
    </div>
  );
}
