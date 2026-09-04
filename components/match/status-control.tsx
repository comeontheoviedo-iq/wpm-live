"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { STATUS_FLOW, nextStatus, statusColor, cn } from "@/lib/utils";
import { Radio, ChevronRight } from "lucide-react";

export function StatusControl({
  matchId,
  status,
}: {
  matchId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const next = nextStatus(status);

  async function advance(target?: string) {
    setPending(true);
    try {
      const res = await fetch(`/api/matches/${matchId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: target || next }),
      });
      if (!res.ok) throw new Error("Failed");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide mr-1">
          Prep status
        </span>
        {STATUS_FLOW.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <button
              type="button"
              disabled={pending}
              onClick={() => advance(s)}
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white transition",
                s === status
                  ? statusColor(s)
                  : "bg-slate-300 dark:bg-slate-700 opacity-70 hover:opacity-100"
              )}
            >
              {s}
            </button>
            {i < STATUS_FLOW.length - 1 && (
              <ChevronRight className="h-3 w-3 text-slate-300" />
            )}
          </div>
        ))}
      </div>
      <div className="sm:ml-auto flex gap-2">
        {status !== "Live" && (next === "Live" || status === "Ready") && (
          <Button
            variant="danger"
            size="sm"
            disabled={pending}
            onClick={() => advance("Live")}
          >
            <Radio className="h-3.5 w-3.5" />
            Go Live
          </Button>
        )}
        {status === "Live" && (
          <Button
            variant="primary"
            size="sm"
            disabled={pending}
            onClick={() => advance("Full Time")}
          >
            Full Time
          </Button>
        )}
        {next && next !== "Live" && status !== "Full Time" && (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => advance()}
          >
            Advance to {next}
          </Button>
        )}
      </div>
    </div>
  );
}
