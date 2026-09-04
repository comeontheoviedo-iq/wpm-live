"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Item = { id: string; label: string; category: string; done: boolean };

export function ChecklistClient({ matchId, items: initial }: { matchId: string; items: Item[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  async function toggle(id: string, done: boolean) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, done } : i)));
    await fetch(`/api/matches/${matchId}/checklist`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, done }) });
    router.refresh();
  }
  const cats = Array.from(new Set(items.map((i) => i.category)));
  return (
    <div className="space-y-4">
      {cats.map((cat) => (
        <div key={cat}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{cat}</h3>
          <ul className="space-y-2">
            {items.filter((i) => i.category === cat).map((i) => (
              <li key={i.id}>
                <label className={cn("flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition", i.done ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900")}>
                  <input type="checkbox" checked={i.done} onChange={(e) => toggle(i.id, e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                  <span className={cn("text-sm", i.done && "line-through text-slate-500")}>{i.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
