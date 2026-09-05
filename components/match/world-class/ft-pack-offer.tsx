"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function FtPackOffer({
  matchId,
  status,
  visible,
}: {
  matchId: string;
  status: string;
  visible: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [script, setScript] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (!visible || status !== "Full Time" || dismissed) return null;

  async function generate() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/ft-summary`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "FT summary failed");
      setScript(json.script || "");
      setMsg(json.saved ? "Saved to Speaks + Packs" : "Generated (not saved)");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-1 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/90 dark:bg-emerald-950/40 px-3 py-2 text-[11px]">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-bold text-emerald-900 dark:text-emerald-100">
          Full time — FT pack
        </span>
        <Button
          size="sm"
          className="h-6 text-[10px] bg-emerald-700 hover:bg-emerald-600"
          disabled={busy}
          onClick={() => void generate()}
        >
          {busy ? "Building…" : script ? "Regenerate FT summary" : "Generate FT summary"}
        </Button>
        <button
          type="button"
          className="ml-auto text-[10px] text-slate-500 hover:underline"
          onClick={() => setDismissed(true)}
        >
          Dismiss
        </button>
      </div>
      {msg && <p className="mt-1 text-emerald-800 dark:text-emerald-200">{msg}</p>}
      {script && (
        <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white/80 dark:bg-slate-950/60 p-2 text-[10px] leading-snug text-slate-800 dark:text-slate-100">
          {script}
        </pre>
      )}
    </div>
  );
}
