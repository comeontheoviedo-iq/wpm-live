"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Clapperboard } from "lucide-react";

export function ClaimUrButton({
  matchDayId,
  claimed = false,
  compact = false,
}: {
  matchDayId: string;
  claimed?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    if (claimed) {
      router.push(`/show/${matchDayId}`);
      return;
    }
    setPending(true);
    try {
      const res = await fetch(`/api/show/${matchDayId}/claim`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Claim failed");
      router.push(`/show/${matchDayId}`);
      router.refresh();
    } catch {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      title={claimed ? "Open U&R Show board" : "Claim for U&R"}
      className={
        compact
          ? "focus-ring inline-flex items-center gap-1 rounded-[var(--radius-xs)] border border-[#7EB6FF]/35 bg-[#7EB6FF]/12 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[#7EB6FF] hover:bg-[#7EB6FF]/20 disabled:opacity-50"
          : "focus-ring interactive-press inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[#7EB6FF]/40 bg-[#7EB6FF]/15 px-3 py-2 text-[11px] font-semibold text-[#A8CFFF] hover:bg-[#7EB6FF]/25 disabled:opacity-50"
      }
    >
      <Clapperboard className="h-3.5 w-3.5" />
      {pending ? "Claiming…" : claimed ? "U&R board" : "Claim U&R"}
    </button>
  );
}
