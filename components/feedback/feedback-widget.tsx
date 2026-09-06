"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageSquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FeedbackType = "bug" | "improvement" | "other";

export function FeedbackWidget({
  matchId,
  compact,
}: {
  matchId?: string;
  /** Inline button for Settings / desk instead of sticky fab */
  compact?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("bug");
  const [message, setMessage] = useState("");
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
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          message,
          pageUrl: typeof window !== "undefined" ? window.location.href : pathname,
          matchId: matchId || undefined,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json.error || "Submit failed"));
      setStatus(String(json.message || "Thanks — saved."));
      setMessage("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {compact ? (
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          <MessageSquarePlus className="h-4 w-4 mr-1.5" />
          Bug / Improvement
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-teal-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-teal-500 focus-ring"
          aria-label="Send feedback"
        >
          <MessageSquarePlus className="h-4 w-4" />
          <span className="hidden sm:inline">Feedback</span>
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-3">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Feedback form"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold">Bug / Improvement</h2>
              <button
                type="button"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Netlify Forms-ready markup for future static deploy */}
            <form
              name="pitchline-feedback"
              method="POST"
              data-netlify="true"
              netlify-honeypot="bot-field"
              onSubmit={submit}
              className="space-y-3"
            >
              <input type="hidden" name="form-name" value="pitchline-feedback" />
              <p className="hidden">
                <label>
                  Don’t fill this out: <input name="bot-field" />
                </label>
              </p>
              <div className="flex gap-2">
                {([
                  ["bug", "Bug"],
                  ["improvement", "Improvement"],
                  ["other", "Other"],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setType(id)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-xs font-medium",
                      type === id
                        ? "border-teal-500 bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200"
                        : "border-slate-200 dark:border-slate-700 text-slate-600"
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
                placeholder="What happened / what would help on the desk?"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-sm focus-ring"
              />
              <input type="hidden" name="pageUrl" value={pathname || ""} />
              {matchId ? <input type="hidden" name="matchId" value={matchId} /> : null}
              <p className="text-[11px] text-slate-400">
                Captures type, message, page URL{matchId ? ", match id" : ""}, and user agent.
                Stored locally for now (API → data/feedback.json).
              </p>
              {status && (
                <p className="text-xs text-slate-600 dark:text-slate-300">{status}</p>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy || message.trim().length < 3}>
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
