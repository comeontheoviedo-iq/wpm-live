"use client";

import { useEffect, useRef, useState } from "react";
import { Palette, X } from "lucide-react";
import {
  emptyKit,
  type KitSwatch,
  type MatchKitColors,
} from "@/lib/kit-colors";
import { cn } from "@/lib/utils";

function SwatchRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: KitSwatch;
  onChange: (next: KitSwatch) => void;
}) {
  const primary = value.primary || "#94a3b8";
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-white/70">
        {label}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <label className="inline-flex items-center gap-1 text-[10px] text-white/80">
          <span>Primary</span>
          <input
            type="color"
            value={primary}
            onChange={(e) =>
              onChange({ ...value, primary: e.target.value })
            }
            className="h-6 w-8 cursor-pointer rounded border border-white/20 bg-transparent p-0"
          />
        </label>
        <label className="inline-flex items-center gap-1 text-[10px] text-white/60">
          <span>#</span>
          <input
            type="color"
            value={value.number || "#f8fafc"}
            onChange={(e) =>
              onChange({ ...value, number: e.target.value })
            }
            className="h-5 w-6 cursor-pointer rounded border border-white/15 bg-transparent p-0"
            title="Number colour"
          />
        </label>
        <label className="inline-flex items-center gap-1 text-[10px] text-white/60">
          <span>Trim</span>
          <input
            type="color"
            value={value.border || value.number || "#f8fafc"}
            onChange={(e) =>
              onChange({ ...value, border: e.target.value })
            }
            className="h-5 w-6 cursor-pointer rounded border border-white/15 bg-transparent p-0"
            title="Border / trim"
          />
        </label>
      </div>
    </div>
  );
}

function SideKitEditor({
  title,
  kit,
  onChange,
}: {
  title: string;
  kit: MatchKitColors;
  onChange: (next: MatchKitColors) => void;
}) {
  return (
    <div className="space-y-2 rounded border border-white/10 bg-black/30 p-2">
      <div className="text-[11px] font-bold text-amber-300">{title}</div>
      <SwatchRow
        label="Outfield"
        value={kit.player}
        onChange={(player) => onChange({ ...kit, player })}
      />
      <SwatchRow
        label="GK"
        value={kit.goalkeeper}
        onChange={(goalkeeper) => onChange({ ...kit, goalkeeper })}
      />
    </div>
  );
}

export function KitsPopover({
  matchId,
  homeName,
  awayName,
  homeKit,
  awayKit,
  homeManual,
  awayManual,
  onApplied,
  className,
}: {
  matchId: string;
  homeName: string;
  awayName: string;
  homeKit: MatchKitColors | null;
  awayKit: MatchKitColors | null;
  homeManual?: boolean;
  awayManual?: boolean;
  onApplied: (next: {
    homeKit: MatchKitColors | null;
    awayKit: MatchKitColors | null;
    homeManual: boolean;
    awayManual: boolean;
  }) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [home, setHome] = useState<MatchKitColors>(homeKit || emptyKit());
  const [away, setAway] = useState<MatchKitColors>(awayKit || emptyKit());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHome(homeKit || emptyKit());
    setAway(awayKit || emptyKit());
  }, [homeKit, awayKit]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/matches/${matchId}/kits`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Save failed");
      onApplied({
        homeKit: j.homeKit,
        awayKit: j.awayKit,
        homeManual: Boolean(j.homeManual),
        awayManual: Boolean(j.awayManual),
      });
      if (j.homeKit) setHome(j.homeKit);
      else setHome(emptyKit());
      if (j.awayKit) setAway(j.awayKit);
      else setAway(emptyKit());
      setMsg(body.reset ? "Reset to feed" : "Saved");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const locked = homeManual || awayManual;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-6 items-center gap-1 rounded-[2px] px-1.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--bug-fg)] hover:bg-white/10",
          locked && "text-amber-300"
        )}
        aria-label="Kits"
        aria-expanded={open}
        data-fast-tip="Kits · override strip colours"
      >
        <Palette className="h-3.5 w-3.5" />
        Kits
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-[min(20rem,90vw)] rounded-md border border-white/15 bg-[#0f141b] p-2 shadow-xl">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-[11px] font-bold text-white">Match kits</div>
            <button
              type="button"
              className="rounded p-0.5 text-white/60 hover:bg-white/10 hover:text-white"
              onClick={() => setOpen(false)}
              aria-label="Close kits"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-2">
            <SideKitEditor title={`Home · ${homeName}`} kit={home} onChange={setHome} />
            <SideKitEditor title={`Away · ${awayName}`} kit={away} onChange={setAway} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => void patch({ home, away })}
              className="rounded bg-[#F59E0B] px-2 py-1 text-[10px] font-bold text-black disabled:opacity-50"
            >
              {busy ? "Saving…" : "Apply"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void patch({ reset: "both" })}
              className="rounded border border-white/20 px-2 py-1 text-[10px] font-semibold text-white/80 hover:bg-white/10 disabled:opacity-50"
            >
              Reset to feed
            </button>
            {msg ? (
              <span className="text-[10px] text-white/55">{msg}</span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
