"use client";

import { useMemo, useState } from "react";
import { Lock, LockOpen, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  resolveLineupSourceKind,
  lineupSourceBadgeLabel,
  lineupSourceBadgeClass,
  parseLineupSourceMeta,
  type LineupSourceKind,
} from "@/lib/lineup-source";

function formatKickoffLondon(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function LineupSourceBadge({
  lineupStatus,
  lineupSource,
  lineupSourceMeta,
  className,
}: {
  lineupStatus: string;
  lineupSource?: string | null;
  lineupSourceMeta?: string | null;
  className?: string;
}) {
  const kind = resolveLineupSourceKind({ lineupSource, lineupStatus });
  const meta = parseLineupSourceMeta(lineupSourceMeta);
  const label = lineupSourceBadgeLabel({ kind, meta });
  const title =
    kind === "official"
      ? "Official XI from live feed"
      : kind === "predicted"
        ? "Predicted XI — not Official"
        : meta?.lastXiCompetitionMismatch
          ? "Domestic last XI — not this competition"
          : "Last played XI — not tonight's Official";

  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-px font-semibold text-[9px]",
        lineupSourceBadgeClass(kind),
        kind !== "official" && "ring-1 ring-black/10",
        className
      )}
      title={title}
      data-lineup-source={kind}
    >
      {label}
    </span>
  );
}

export function FixtureIdentityChip({
  competition,
  kickoffAt,
  homeTeamAfId,
  awayTeamAfId,
  apiFootballFixtureId,
}: {
  competition: string;
  kickoffAt?: string | Date | null;
  homeTeamAfId?: number | null;
  awayTeamAfId?: number | null;
  apiFootballFixtureId?: number | null;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-1.5 py-px text-[9px] font-medium text-slate-600 dark:text-slate-300 tabular-nums"
      title="Fixture identity — wrong attach shows here"
    >
      <span className="truncate max-w-[100px]">{competition || "—"}</span>
      <span className="text-slate-400">·</span>
      <span>{formatKickoffLondon(kickoffAt)} Lon</span>
      <span className="text-slate-400">·</span>
      <span>
        AF {homeTeamAfId ?? "?"}–{awayTeamAfId ?? "?"}
      </span>
      <span className="text-slate-400">·</span>
      <span>#{apiFootballFixtureId ?? "—"}</span>
    </span>
  );
}

export function LineupFeedControls({
  matchId,
  xiFeedFrozen,
  xiFeedFrozenReason,
  isOwner,
  onChanged,
}: {
  matchId: string;
  xiFeedFrozen: boolean;
  xiFeedFrozenReason?: string | null;
  isOwner: boolean;
  onChanged?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function post(action: string, extra?: { note?: string }) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/xi-feed`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(json.error || "Failed");
        return;
      }
      setNoteOpen(false);
      setNote("");
      onChanged?.();
    } catch {
      setMsg("Failed");
    } finally {
      setBusy(false);
    }
  }

  const frozenLabel = useMemo(() => {
    if (!xiFeedFrozen) return null;
    if (xiFeedFrozenReason === "looks_wrong") return "Frozen · XI reported wrong";
    return "XI locked from feed";
  }, [xiFeedFrozen, xiFeedFrozenReason]);

  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {frozenLabel && (
        <span className="rounded-full border border-amber-400/80 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-px text-[9px] font-semibold text-amber-800 dark:text-amber-200">
          {frozenLabel}
        </span>
      )}
      {!xiFeedFrozen ? (
        <>
          <button
            type="button"
            className="desk-btn text-[9px] px-1.5 py-0.5 inline-flex items-center gap-0.5"
            disabled={busy}
            title="Lock XI — feed will not overwrite placements"
            onClick={() => void post("lock")}
          >
            <Lock className="h-3 w-3" /> Lock XI
          </button>
          <button
            type="button"
            className="desk-btn text-[9px] px-1.5 py-0.5 inline-flex items-center gap-0.5 text-amber-800 dark:text-amber-200"
            disabled={busy}
            title="Report bad Official XI — freezes feed apply + alerts owner"
            onClick={() => setNoteOpen((v) => !v)}
          >
            <AlertTriangle className="h-3 w-3" /> XI looks wrong
          </button>
        </>
      ) : isOwner ? (
        <button
          type="button"
          className="desk-btn text-[9px] px-1.5 py-0.5 inline-flex items-center gap-0.5"
          disabled={busy}
          title="Unlock — allow Official/Predicted/Last XI feed apply again"
          onClick={() => void post("unlock")}
        >
          <LockOpen className="h-3 w-3" /> Unlock feed
        </button>
      ) : (
        <span className="text-[9px] text-slate-500">Owner can unlock</span>
      )}
      {noteOpen && (
        <span className="inline-flex items-center gap-1">
          <input
            className="h-6 w-40 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 text-[10px]"
            placeholder="Optional note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            type="button"
            className="desk-btn text-[9px] px-1.5 py-0.5"
            disabled={busy}
            onClick={() => void post("report_wrong", { note: note || undefined })}
          >
            Freeze + alert
          </button>
        </span>
      )}
      {msg && <span className="text-[9px] text-rose-600">{msg}</span>}
    </span>
  );
}

export type { LineupSourceKind };
