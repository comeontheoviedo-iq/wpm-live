"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LifeBuoy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SupportPingType } from "@/lib/support-ping-alert";

const TYPE_OPTIONS: { id: SupportPingType; label: string }[] = [
  { id: "ask", label: "Ask" },
  { id: "bug", label: "Bug" },
  { id: "xi_wrong", label: "XI wrong" },
  { id: "billing", label: "Billing" },
  { id: "other", label: "Other" },
];

export type AskReportDeskContext = {
  matchTitle?: string | null;
  afFixtureId?: number | string | null;
  lineupSource?: string | null;
  matchId?: string | null;
  competition?: string | null;
  status?: string | null;
};

export function AskReportButton({
  deskContext,
  compact,
  className,
  /** Match-desk toolbar style (desk-btn) */
  deskBtn,
}: {
  deskContext?: AskReportDeskContext | null;
  compact?: boolean;
  className?: string;
  deskBtn?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<SupportPingType>("ask");
  const [message, setMessage] = useState("");
  const [includeContext, setIncludeContext] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStatus(null);
      setBusy(false);
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const url =
        typeof window !== "undefined" ? window.location.href : pathname || "";
      const context =
        includeContext && deskContext
          ? {
              matchTitle: deskContext.matchTitle ?? null,
              afFixtureId: deskContext.afFixtureId ?? null,
              lineupSource: deskContext.lineupSource ?? null,
              matchId: deskContext.matchId ?? null,
              competition: deskContext.competition ?? null,
              status: deskContext.status ?? null,
              url,
            }
          : includeContext
            ? { url }
            : null;

      const res = await fetch("/api/support/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          message,
          includeContext,
          context,
          pageUrl: url,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json.error || "Submit failed"));
      setStatus(String(json.message || "Thanks — sent."));
      setMessage("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  const trigger = deskBtn ? (
    <button
      type="button"
      className={cn(
        "desk-btn font-bold tracking-[0.08em] text-amber-100 border-amber-500/40",
        className
      )}
      onClick={() => setOpen(true)}
      data-fast-tip="Ask CoComms / report a bug"
      aria-label="Ask / Report"
    >
      <LifeBuoy className="h-3 w-3" />
      Ask / Report
    </button>
  ) : compact ? (
    <Button
      type="button"
      variant="outline"
      className={cn(
        "border-amber-500/50 text-amber-800 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/40",
        className
      )}
      onClick={() => setOpen(true)}
    >
      <LifeBuoy className="h-4 w-4 mr-1.5" />
      Ask / Report
    </Button>
  ) : (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        "fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-[var(--brand)] px-3.5 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-[var(--brand-dark)] focus-ring",
        className
      )}
      aria-label="Ask / Report"
      title="Ask CoComms or report a problem"
    >
      <LifeBuoy className="h-4 w-4 shrink-0" aria-hidden />
      <span>Ask / Report</span>
    </button>
  );

  // The match desk has its own in-flow Ask / Report button in the desk
  // toolbar (top-right, next to Full/Exit). The floating bottom-right pill sat
  // over the pitch / squad rail there, so don't render it on the desk route.
  const floatingOnDesk =
    !deskBtn && !compact && /^\/match-day\/(?!new\/?$)[^/]+\/?$/.test(pathname || "");
  if (floatingOnDesk) return null;

  return (
    <>
      {trigger}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/45 p-3">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Ask / Report form"
            className="w-full max-w-md rounded-2xl border border-amber-400/40 bg-white p-4 shadow-xl dark:border-amber-600/30 dark:bg-slate-900"
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400">
                  CoComms
                </p>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Ask / Report
                </h2>
              </div>
              <button
                type="button"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-amber-50 dark:hover:bg-slate-800"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={submit} className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {TYPE_OPTIONS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setType(id)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-xs font-medium",
                      type === id
                        ? "border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100"
                        : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <textarea
                name="message"
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What do you need, or what’s wrong on the desk?"
                className="w-full rounded-xl border border-amber-200/80 bg-transparent px-3 py-2 text-sm focus-ring dark:border-amber-800/40"
              />
              <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                  checked={includeContext}
                  onChange={(e) => setIncludeContext(e.target.checked)}
                />
                <span>
                  Include current desk context
                  {deskContext?.matchTitle
                    ? ` (${deskContext.matchTitle}`
                    : ""}
                  {deskContext?.afFixtureId != null
                    ? `${deskContext.matchTitle ? ", " : " ("}AF ${deskContext.afFixtureId}`
                    : ""}
                  {deskContext?.lineupSource
                    ? `${deskContext.matchTitle || deskContext.afFixtureId != null ? ", " : " ("}XI ${deskContext.lineupSource}`
                    : ""}
                  {deskContext?.matchTitle ||
                  deskContext?.afFixtureId != null ||
                  deskContext?.lineupSource
                    ? ")"
                    : " (page URL)"}
                </span>
              </label>
              {status && (
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {status}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={busy || message.trim().length < 3}
                  className="bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)]"
                >
                  {busy ? "Sending…" : "Send"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
