"use client";

import { useMemo, useState } from "react";
import { Lock, LockOpen, AlertTriangle, RefreshCw, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  resolveLineupSourceKind,
  lineupSourceBadgeLabel,
  lineupSourceBadgeClass,
  lineupSourceBadgeTitle,
  parseLineupSourceMeta,
  buildLineupVerifyUrls,
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
  matchStatus,
  hasSubEvents,
  className,
}: {
  lineupStatus: string;
  lineupSource?: string | null;
  lineupSourceMeta?: string | null;
  matchStatus?: string | null;
  hasSubEvents?: boolean;
  className?: string;
}) {
  const meta = parseLineupSourceMeta(lineupSourceMeta);
  const kind = resolveLineupSourceKind({
    lineupSource,
    lineupStatus,
    matchStatus,
    hasSubEvents,
    meta,
  });
  const label = lineupSourceBadgeLabel({ kind, meta });
  const title = lineupSourceBadgeTitle({ kind, meta });
  const loud = kind === "predicted" || kind === "last_xi";
  let display = label;
  if (kind === "predicted") display = "PREDICTED — NOT OFFICIAL";
  else if (kind === "last_xi") {
    const comp = (meta?.competitionShort || "").trim();
    display = comp
      ? `LAST XI — NOT OFFICIAL · ${comp}`
      : "LAST XI — NOT OFFICIAL";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full",
        loud
          ? "px-2 py-0.5 text-[10px] font-black uppercase tracking-wide shadow ring-2 ring-black/25"
          : kind === "live"
            ? "px-2 py-0.5 text-[10px] font-bold shadow"
            : "rounded-full px-1.5 py-px font-semibold text-[9px]",
        lineupSourceBadgeClass(kind),
        kind !== "official" && "ring-1 ring-black/10",
        className
      )}
      title={title}
      data-lineup-source={kind}
    >
      {display}
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

/** Loud incomplete XI chip for desk header when starters &lt; 11. */
export function IncompleteXiWarning({
  homeStarters,
  awayStarters,
  homeName,
  awayName,
}: {
  homeStarters: number;
  awayStarters: number;
  homeName: string;
  awayName: string;
}) {
  if (homeStarters >= 11 && awayStarters >= 11) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border-2 border-amber-400 bg-rose-700 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-100 shadow"
      title="Formation has empty slots or fewer than 11 starters mapped"
    >
      <AlertTriangle className="h-3 w-3 shrink-0" />
      Incomplete XI · {homeName} {homeStarters}/11 · {awayName} {awayStarters}/11
    </span>
  );
}

export function LineupFeedControls({
  matchId,
  xiFeedFrozen,
  xiFeedFrozenReason,
  isOwner,
  onChanged,
  homeName,
  awayName,
  kickoffAt,
  apiFootballFixtureId,
  lineupStatus,
  lineupSource,
  lineupSourceMeta,
  lastFeedSyncAt,
  homeStarters,
  awayStarters,
}: {
  matchId: string;
  xiFeedFrozen: boolean;
  xiFeedFrozenReason?: string | null;
  isOwner: boolean;
  onChanged?: () => void;
  homeName?: string;
  awayName?: string;
  kickoffAt?: string | Date | null;
  apiFootballFixtureId?: number | null;
  lineupStatus?: string | null;
  lineupSource?: string | null;
  lineupSourceMeta?: string | null;
  lastFeedSyncAt?: string | Date | null;
  homeStarters?: number;
  awayStarters?: number;
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
      if (action === "repull_official") {
        const before = json.before?.starters;
        const after = json.after?.starters;
        const applied = json.lineupApplied;
        if (before != null && after != null) {
          setMsg(
            applied
              ? `Re-pulled Official · starters ${before} → ${after}`
              : `Unlocked + synced · starters ${after} (Official not both-sides usable yet)`
          );
        } else {
          setMsg(applied ? "Re-pulled Official XI" : "Unlocked + synced");
        }
      } else if (action === "report_wrong") {
        setMsg("Frozen — owner alerted (does not refresh XI)");
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
    if (xiFeedFrozenReason === "looks_wrong")
      return "FROZEN · blocks Official updates until Unlock / Re-pull";
    if (xiFeedFrozenReason === "lock") return "FROZEN · blocks Official updates until Unlock";
    return "FROZEN · blocks Official updates until Unlock / Re-pull";
  }, [xiFeedFrozen, xiFeedFrozenReason]);

  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {frozenLabel && (
        <span className="rounded-md border-2 border-amber-400 bg-amber-100 dark:bg-amber-950/70 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-950 dark:text-amber-100 shadow">
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
            title="Blocks Official updates until Unlock / Re-pull — does NOT refresh XI; alerts owner"
            onClick={() => setNoteOpen((v) => !v)}
          >
            <AlertTriangle className="h-3 w-3" /> Report wrong XI
          </button>
          {isOwner && (
            <button
              type="button"
              className="desk-btn text-[9px] px-1.5 py-0.5 inline-flex items-center gap-0.5 text-emerald-800 dark:text-emerald-200"
              disabled={busy}
              title="Force re-apply Official XI from the live feed (works pre-KO; clears freeze)"
              onClick={() => void post("repull_official")}
            >
              <RefreshCw className="h-3 w-3" /> Re-pull Official XI
            </button>
          )}
        </>
      ) : isOwner ? (
        <>
          <button
            type="button"
            className="desk-btn text-[9px] px-1.5 py-0.5 inline-flex items-center gap-0.5"
            disabled={busy}
            title="Unlock — allow Official/Predicted/Last XI feed apply again"
            onClick={() => void post("unlock")}
          >
            <LockOpen className="h-3 w-3" /> Unlock feed
          </button>
          <button
            type="button"
            className="desk-btn text-[9px] px-1.5 py-0.5 inline-flex items-center gap-0.5 border border-emerald-500/60 text-emerald-800 dark:text-emerald-200 font-bold"
            disabled={busy}
            title="Unlock freeze + force Official XI re-apply from AF (works pre-KO)"
            onClick={() => void post("repull_official")}
          >
            <RefreshCw className="h-3 w-3" /> Re-pull Official XI
          </button>
        </>
      ) : (
        <span className="text-[9px] font-semibold text-amber-800 dark:text-amber-200">
          Owner can Unlock / Re-pull Official
        </span>
      )}
      {noteOpen && (
        <span className="inline-flex items-center gap-1 flex-wrap">
          <input
            className="h-6 w-44 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 text-[10px]"
            placeholder="What’s wrong? (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            type="button"
            className="desk-btn text-[9px] px-1.5 py-0.5"
            disabled={busy}
            title="Freezes feed apply + emails owner + SupportPing — does not refresh XI"
            onClick={() => void post("report_wrong", { note: note || undefined })}
          >
            Freeze + alert owner
          </button>
          <span className="text-[9px] text-slate-500 max-w-[14rem]">
            Blocks Official feed updates until Unlock / Re-pull. Does not refresh XI.
          </span>
        </span>
      )}
      <LineupVerifyPanel
        homeName={homeName || "Home"}
        awayName={awayName || "Away"}
        kickoffAt={kickoffAt}
        apiFootballFixtureId={apiFootballFixtureId}
        lineupStatus={lineupStatus}
        lineupSource={lineupSource}
        lineupSourceMeta={lineupSourceMeta}
        lastFeedSyncAt={lastFeedSyncAt}
        homeStarters={homeStarters}
        awayStarters={awayStarters}
      />
      {msg && (
        <span className="text-[9px] font-semibold text-emerald-700 dark:text-emerald-300">
          {msg}
        </span>
      )}
    </span>
  );
}

/** Human FotMob / SofaScore verify — opens search tabs; no scrapers. */
export function LineupVerifyPanel({
  homeName,
  awayName,
  kickoffAt,
  apiFootballFixtureId,
  lineupStatus,
  lineupSource,
  lineupSourceMeta,
  lastFeedSyncAt,
  homeStarters,
  awayStarters,
}: {
  homeName: string;
  awayName: string;
  kickoffAt?: string | Date | null;
  apiFootballFixtureId?: number | null;
  lineupStatus?: string | null;
  lineupSource?: string | null;
  lineupSourceMeta?: string | null;
  lastFeedSyncAt?: string | Date | null;
  homeStarters?: number;
  awayStarters?: number;
}) {
  const meta = parseLineupSourceMeta(lineupSourceMeta);
  const kind = resolveLineupSourceKind({ lineupSource, lineupStatus, meta });
  const urls = buildLineupVerifyUrls({
    homeName,
    awayName,
    kickoffAt,
    apiFootballFixtureId,
  });
  const synced = lastFeedSyncAt
    ? formatKickoffLondon(lastFeedSyncAt)
    : meta?.officialCapturedAt
      ? formatKickoffLondon(meta.officialCapturedAt)
      : "—";
  const homeN = homeStarters ?? meta?.homeStarters ?? null;
  const awayN = awayStarters ?? meta?.awayStarters ?? null;
  const emptyWarn =
    (homeN != null && homeN < 11) || (awayN != null && awayN < 11);

  return (
    <span className="inline-flex items-center gap-1 flex-wrap rounded border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/50 px-1.5 py-0.5">
      <button
        type="button"
        className="desk-btn text-[9px] px-1.5 py-0.5 inline-flex items-center gap-0.5 font-bold"
        title={`Open FotMob + SofaScore search for "${urls.query}" — human compare (no scraper)`}
        onClick={() => {
          window.open(urls.fotmob, "_blank", "noopener,noreferrer");
          window.open(urls.sofascore, "_blank", "noopener,noreferrer");
        }}
      >
        <ExternalLink className="h-3 w-3" /> Verify
      </button>
      <a
        href={urls.fotmob}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[9px] font-semibold text-slate-600 dark:text-slate-300 underline-offset-2 hover:underline"
      >
        FotMob
      </a>
      <a
        href={urls.sofascore}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[9px] font-semibold text-slate-600 dark:text-slate-300 underline-offset-2 hover:underline"
      >
        SofaScore
      </a>
      <span
        className="text-[9px] text-slate-600 dark:text-slate-300 tabular-nums"
        title="Our side: source · last sync · starter counts"
      >
        Ours: {lineupSourceBadgeLabel({ kind, meta })}
        {" · "}
        synced {synced} Lon
        {homeN != null && awayN != null ? ` · XI ${homeN}/${awayN}` : ""}
        {emptyWarn ? " · empty slots" : ""}
      </span>
    </span>
  );
}

export type { LineupSourceKind };
