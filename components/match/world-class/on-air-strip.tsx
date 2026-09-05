"use client";

import { cn } from "@/lib/utils";

export type StripNote = { id: string; title: string; body: string };
export type StripEvent = {
  id?: string;
  type: string;
  minute: number;
  description: string;
};

export function OnAirStrip({
  relevantNotes,
  lastEvent,
  scoreline,
  clockLabel,
  onExpandNotes,
  onOpenEvents,
}: {
  relevantNotes: StripNote[];
  lastEvent: StripEvent | null;
  scoreline: string;
  clockLabel: string;
  onExpandNotes?: () => void;
  onOpenEvents?: () => void;
}) {
  return (
    <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/90 dark:bg-rose-950/40 px-2.5 py-2 text-[11px] shadow-sm">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="rounded-full bg-rose-600 text-white text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5">
          On-air
        </span>
        <span className="font-bold tabular-nums text-slate-900 dark:text-white">
          {scoreline}
        </span>
        {clockLabel ? (
          <span className="tabular-nums text-slate-500">{clockLabel}</span>
        ) : null}
        <button
          type="button"
          className="ml-auto text-[10px] font-semibold text-rose-700 dark:text-rose-300 hover:underline"
          onClick={onExpandNotes}
        >
          Expand notes
        </button>
        <button
          type="button"
          className="text-[10px] text-slate-500 hover:underline"
          onClick={onOpenEvents}
        >
          Events
        </button>
      </div>
      <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
        <div className="min-w-0">
          <div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
            Relevant now
          </div>
          {relevantNotes.length === 0 ? (
            <p className="text-slate-500 mt-0.5">No ranked notes yet</p>
          ) : (
            <ul className="mt-0.5 space-y-0.5">
              {relevantNotes.slice(0, 3).map((n) => (
                <li key={n.id} className="truncate leading-snug" title={n.body}>
                  <span className="font-semibold">{n.title}</span>
                  {n.body ? (
                    <span className="text-slate-500">
                      {" "}
                      — {n.body.replace(/\s+/g, " ").slice(0, 80)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="min-w-0">
          <div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
            Last event
          </div>
          {lastEvent ? (
            <p className="mt-0.5 leading-snug">
              <span className="font-bold tabular-nums">{lastEvent.minute}&apos;</span>{" "}
              <span
                className={cn(
                  "font-semibold",
                  /goal/i.test(lastEvent.type) && "text-emerald-700 dark:text-emerald-300",
                  /yellow/i.test(lastEvent.type) && "text-amber-700",
                  /red|var/i.test(lastEvent.type) && "text-rose-700 dark:text-rose-300"
                )}
              >
                {lastEvent.type}
              </span>{" "}
              {lastEvent.description}
            </p>
          ) : (
            <p className="text-slate-500 mt-0.5">Waiting for feed…</p>
          )}
        </div>
      </div>
    </div>
  );
}
