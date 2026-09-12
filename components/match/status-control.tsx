"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { STATUS_FLOW, nextStatus, statusColor, cn } from "@/lib/utils";
import { Radio, ChevronRight } from "lucide-react";

type PeriodControl = "HT" | "2H" | "FT";

const HT_BREAK_DEFAULT_SEC = 15 * 60;
const HT_BREAK_STORAGE = "pitchline.htBreakSec";

function formatCountdown(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function StatusControl({
  matchId,
  status,
  period = null,
}: {
  matchId: string;
  status: string;
  period?: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const next = nextStatus(status);
  const isHt =
    period === "HT" || status === "Half Time";
  const showPeriod =
    status === "Live" ||
    status === "Half Time" ||
    status === "Full Time" ||
    status === "Ready";

  const [htEndsAt, setHtEndsAt] = useState<number | null>(null);
  const [htLeft, setHtLeft] = useState<number | null>(null);
  const [breakSec, setBreakSec] = useState(HT_BREAK_DEFAULT_SEC);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(HT_BREAK_STORAGE);
      if (raw) {
        const n = Number(raw);
        if (Number.isFinite(n) && n >= 60 && n <= 30 * 60) setBreakSec(n);
      }
    } catch { /* ignore */ }
  }, []);

  // Start / clear HT countdown from period
  useEffect(() => {
    const key = `pitchline.htEndsAt.${matchId}`;
    if (isHt) {
      try {
        const existing = window.localStorage.getItem(key);
        let ends = existing ? Number(existing) : NaN;
        if (!Number.isFinite(ends) || ends < Date.now() - 60_000) {
          ends = Date.now() + breakSec * 1000;
          window.localStorage.setItem(key, String(ends));
        }
        setHtEndsAt(ends);
      } catch {
        setHtEndsAt(Date.now() + breakSec * 1000);
      }
    } else {
      setHtEndsAt(null);
      setHtLeft(null);
      try {
        window.localStorage.removeItem(key);
      } catch { /* ignore */ }
    }
  }, [isHt, matchId, breakSec]);

  useEffect(() => {
    if (!htEndsAt) return;
    const tick = () => setHtLeft(Math.max(0, Math.ceil((htEndsAt - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [htEndsAt]);

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

  const setPeriod = useCallback(
    async (control: PeriodControl) => {
      setPending(true);
      try {
        const res = await fetch(`/api/matches/${matchId}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ periodControl: control }),
        });
        if (!res.ok) throw new Error("Failed");
        if (control === "HT") {
          // Also kick 2H intro script generation (best-effort)
          void fetch(`/api/matches/${matchId}/ht-2h-intro`, { method: "POST" }).catch(
            () => null
          );
        }
        router.refresh();
      } finally {
        setPending(false);
      }
    },
    [matchId, router]
  );

  const activePeriod =
    isHt
      ? "HT"
      : period === "2H"
        ? "2H"
        : period === "FT" || status === "Full Time"
          ? "FT"
          : period === "1H"
            ? "1H"
            : null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
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

        {showPeriod && (
          <div
            className="flex items-center gap-1.5 flex-wrap"
            role="group"
            aria-label="Period controls"
          >
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide mr-0.5">
              Period
            </span>
            {(
              [
                { id: "HT" as const, label: "HT", title: "Half-time" },
                { id: "2H" as const, label: "2H", title: "Start second half" },
                { id: "FT" as const, label: "FT", title: "Full time" },
              ] as const
            ).map((btn) => (
              <button
                key={btn.id}
                type="button"
                disabled={pending}
                onClick={() => setPeriod(btn.id)}
                title={btn.title}
                aria-pressed={activePeriod === btn.id}
                className={cn(
                  "inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition ring-1",
                  activePeriod === btn.id
                    ? "bg-rose-600 text-white ring-rose-400/40"
                    : "bg-slate-100 text-slate-700 ring-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600 dark:hover:bg-slate-700"
                )}
              >
                {btn.label}
              </button>
            ))}
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                void fetch(`/api/matches/${matchId}/ht-2h-intro`, {
                  method: "POST",
                })
                  .then((r) => r.json())
                  .then((j) => {
                    if (j?.saved) router.refresh();
                  })
                  .catch(() => null)
              }
              title="Generate 2nd half intro script from first-half events"
              className="inline-flex items-center rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide bg-teal-50 text-teal-800 ring-1 ring-teal-200 hover:bg-teal-100 dark:bg-teal-950/50 dark:text-teal-200 dark:ring-teal-800"
            >
              2H intro
            </button>
          </div>
        )}

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
          {status === "Live" && !isHt && (
            <Button
              variant="primary"
              size="sm"
              disabled={pending}
              onClick={() => setPeriod("FT")}
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

      {isHt && htLeft != null && (
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 ring-1",
            htLeft <= 60
              ? "bg-rose-600/15 ring-rose-500/40 text-rose-800 dark:text-rose-200"
              : "bg-amber-500/10 ring-amber-400/40 text-amber-900 dark:text-amber-100"
          )}
          data-cocomms="ht-countdown"
          aria-live="polite"
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-80">
            To 2nd half
          </span>
          <span className="font-black tabular-nums text-2xl tracking-tight leading-none">
            {formatCountdown(htLeft)}
          </span>
          <span className="text-[11px] font-medium opacity-70">
            {htLeft <= 0 ? "Restart window — press 2H when whistle goes" : "break remaining"}
          </span>
          <button
            type="button"
            className="ml-auto text-[10px] font-semibold underline opacity-60 hover:opacity-100"
            title="Reset 15:00 break clock"
            onClick={() => {
              const ends = Date.now() + breakSec * 1000;
              try {
                window.localStorage.setItem(
                  `pitchline.htEndsAt.${matchId}`,
                  String(ends)
                );
              } catch { /* ignore */ }
              setHtEndsAt(ends);
            }}
          >
            Reset {formatCountdown(breakSec)}
          </button>
        </div>
      )}
    </div>
  );
}
