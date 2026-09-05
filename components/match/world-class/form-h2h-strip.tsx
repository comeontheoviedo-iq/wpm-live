"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type FormBits = {
  homeForm: string | null;
  awayForm: string | null;
  homeRank: number | null;
  awayRank: number | null;
  h2h: string | null;
  message?: string | null;
};

function FormPills({ form, label }: { form: string | null; label: string }) {
  const chars = (form || "").replace(/[^WDL]/gi, "").slice(-5).toUpperCase().split("");
  return (
    <div className="inline-flex items-center gap-1 min-w-0">
      <span className="text-[10px] font-semibold text-slate-500 truncate max-w-[7rem]">
        {label}
      </span>
      <span className="inline-flex gap-0.5">
        {chars.length ? (
          chars.map((c, i) => (
            <span
              key={i}
              className={cn(
                "h-4 w-4 rounded-sm text-[9px] font-bold inline-flex items-center justify-center text-white",
                c === "W" && "bg-emerald-600",
                c === "D" && "bg-slate-400",
                c === "L" && "bg-rose-600"
              )}
            >
              {c}
            </span>
          ))
        ) : (
          <span className="text-[10px] text-slate-400">—</span>
        )}
      </span>
    </div>
  );
}

export function FormH2HStrip({
  matchId,
  h2hSummary,
  homeName,
  awayName,
  visible,
}: {
  matchId: string;
  h2hSummary?: string | null;
  homeName: string;
  awayName: string;
  visible: boolean;
}) {
  const [data, setData] = useState<FormBits | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    fetch(`/api/matches/${matchId}/form-h2h`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setData(j as FormBits);
      })
      .catch(() => {
        if (!cancelled)
          setData({
            homeForm: null,
            awayForm: null,
            homeRank: null,
            awayRank: null,
            h2h: h2hSummary || null,
            message: "Form feed soft-failed",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [matchId, visible, h2hSummary]);

  if (!visible) return null;

  const h2h = data?.h2h || h2hSummary || null;

  return (
    <div className="mx-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/80 px-2 py-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
      <FormPills
        form={data?.homeForm ?? null}
        label={
          data?.homeRank != null ? `${homeName} #${data.homeRank}` : homeName
        }
      />
      <FormPills
        form={data?.awayForm ?? null}
        label={
          data?.awayRank != null ? `${awayName} #${data.awayRank}` : awayName
        }
      />
      <div className="min-w-0 flex-1 text-slate-600 dark:text-slate-300 truncate" title={h2h || undefined}>
        <span className="font-semibold text-slate-500 mr-1">H2H</span>
        {h2h || data?.message || "No H2H on desk yet — Sync predictions"}
      </div>
    </div>
  );
}
