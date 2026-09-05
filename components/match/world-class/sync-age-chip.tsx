"use client";

import { useEffect, useState } from "react";
import { formatSyncAge } from "@/lib/sync-age";
import { cn } from "@/lib/utils";

export function SyncAgeChip({
  lastFeedSyncAt,
  pollError,
}: {
  lastFeedSyncAt: string | Date | null;
  pollError?: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, []);
  const age = formatSyncAge(lastFeedSyncAt, now);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] tabular-nums",
        pollError
          ? "border-rose-300 text-rose-700 dark:border-rose-800 dark:text-rose-300"
          : age.stale
            ? "border-amber-300 text-amber-800 dark:border-amber-800 dark:text-amber-200"
            : "border-slate-200 text-slate-500 dark:border-slate-700"
      )}
      title={pollError || age.label}
    >
      {pollError ? `Poll error · ${pollError}` : age.label}
    </span>
  );
}
