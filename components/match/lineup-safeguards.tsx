"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Lock, LockOpen, AlertTriangle, RefreshCw, ExternalLink, Download } from "lucide-react";
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
  matchStatus,
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
  matchStatus?: string | null;
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
    if (xiFeedFrozenReason === "fotmob_apply")
      return "FROZEN · FotMob Apply — Unlock / Re-pull to let AF overwrite";
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
        matchId={matchId}
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
        matchStatus={matchStatus}
        onChanged={onChanged}
      />
      {msg && (
        <span className="text-[9px] font-semibold text-emerald-700 dark:text-emerald-300">
          {msg}
        </span>
      )}
    </span>
  );
}

/** Human Verify tabs + silent FotMob auto-verify badge / Apply. */
export function LineupVerifyPanel({
  matchId,
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
  matchStatus,
  onChanged,
}: {
  matchId?: string;
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
  matchStatus?: string | null;
  onChanged?: () => void;
}) {
  const meta = parseLineupSourceMeta(lineupSourceMeta);
  const kind = resolveLineupSourceKind({
    lineupSource,
    lineupStatus,
    matchStatus,
    meta,
  });
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
        title={`Open FotMob + SofaScore search for "${urls.query}" — human compare`}
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
      {matchId ? (
        <FotMobSilentVerify
          matchId={matchId}
          kickoffAt={kickoffAt}
          matchStatus={matchStatus}
          onChanged={onChanged}
        />
      ) : null}
    </span>
  );
}

type FotMobVerifyPayload = {
  status: string;
  statusLabel: string;
  fotmobConfirmed: boolean;
  minutesToKickoff: number | null;
  canApply: boolean;
  error?: string | null;
  fotmobMatchId?: number | null;
  deskActive?: boolean;
};

function fotmobBadgeClass(status: string): string {
  switch (status) {
    case "matches":
      return "bg-emerald-600 text-white";
    case "fotmob_official_ours_predicted":
      return "bg-amber-500 text-black";
    case "mismatch":
      return "bg-rose-600 text-white";
    case "fotmob_unavailable":
      return "bg-slate-500 text-white";
    case "fotmob_pending":
      return "bg-sky-700 text-white";
    default:
      return "bg-slate-400 text-white";
  }
}

/** Silent poll — commentator does nothing. Apply only when canApply. */
function FotMobSilentVerify({
  matchId,
  kickoffAt,
  matchStatus,
  onChanged,
}: {
  matchId: string;
  kickoffAt?: string | Date | null;
  matchStatus?: string | null;
  onChanged?: () => void;
}) {
  const [payload, setPayload] = useState<FotMobVerifyPayload | null>(null);
  const [busyApply, setBusyApply] = useState(false);
  const [applyMsg, setApplyMsg] = useState<string | null>(null);
  const [unmappedWarn, setUnmappedWarn] = useState<string | null>(null);
  const alive = useRef(true);

  const shouldPoll = useMemo(() => {
    if (!kickoffAt) return false;
    const d = typeof kickoffAt === "string" ? new Date(kickoffAt) : kickoffAt;
    if (Number.isNaN(d.getTime())) return false;
    const mins = (d.getTime() - Date.now()) / 60_000;
    // Within ~3h of KO through shortly after
    if (mins > 180 || mins < -15) return false;
    const s = String(matchStatus || "");
    if (/full time|cancel|postpone|abandon/i.test(s)) return false;
    return (
      !s ||
      /Assigned|Preparation|Ready|Live|Half Time|Not Started|Scheduled|1H|2H/i.test(
        s
      )
    );
  }, [kickoffAt, matchStatus]);

  const poll = useCallback(async () => {
    if (!shouldPoll) return;
    try {
      const res = await fetch(`/api/matches/${matchId}/fotmob-verify`, {
        method: "GET",
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as FotMobVerifyPayload | null;
      if (!alive.current || !json) return;
      setPayload(json);
    } catch {
      if (!alive.current) return;
      setPayload({
        status: "fotmob_unavailable",
        statusLabel: "FotMob unavailable",
        fotmobConfirmed: false,
        minutesToKickoff: null,
        canApply: false,
        error: "poll failed",
      });
    }
  }, [matchId, shouldPoll]);

  useEffect(() => {
    alive.current = true;
    if (!shouldPoll) {
      setPayload(null);
      return () => {
        alive.current = false;
      };
    }
    void poll();
    // 75s — within 60–90s product band
    const id = window.setInterval(() => void poll(), 75_000);
    return () => {
      alive.current = false;
      window.clearInterval(id);
    };
  }, [poll, shouldPoll]);

  async function applyFotMob() {
    setBusyApply(true);
    setApplyMsg(null);
    setUnmappedWarn(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/fotmob-apply`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setApplyMsg(json.error || "Apply failed");
        if (json.home?.unmapped || json.away?.unmapped) {
          const hu = (json.home?.unmapped || [])
            .map((u: { fotmobName: string }) => u.fotmobName)
            .join(", ");
          const au = (json.away?.unmapped || [])
            .map((u: { fotmobName: string }) => u.fotmobName)
            .join(", ");
          setUnmappedWarn(
            [hu && `Home unmapped: ${hu}`, au && `Away unmapped: ${au}`]
              .filter(Boolean)
              .join(" · ")
          );
        }
        return;
      }
      const hu = (json.home?.unmapped || []) as { fotmobName: string }[];
      const au = (json.away?.unmapped || []) as { fotmobName: string }[];
      if (hu.length || au.length) {
        setUnmappedWarn(
          [
            hu.length
              ? `Home unmapped: ${hu.map((u) => u.fotmobName).join(", ")}`
              : "",
            au.length
              ? `Away unmapped: ${au.map((u) => u.fotmobName).join(", ")}`
              : "",
          ]
            .filter(Boolean)
            .join(" · ")
        );
      }
      setApplyMsg(
        `Applied FotMob Official · ${json.home?.mapped?.length ?? "?"}/${json.away?.mapped?.length ?? "?"} · feed frozen`
      );
      if (json.verify) setPayload(json.verify as FotMobVerifyPayload);
      onChanged?.();
    } catch {
      setApplyMsg("Apply failed");
    } finally {
      setBusyApply(false);
    }
  }

  if (!shouldPoll && !payload) return null;

  const label = payload?.statusLabel || "FotMob…";
  const status = payload?.status || "fotmob_pending";

  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      <span
        className={cn(
          "inline-flex items-center rounded-full px-1.5 py-px text-[9px] font-bold",
          fotmobBadgeClass(status)
        )}
        title={
          payload?.error
            ? String(payload.error)
            : "Silent FotMob XI verify (server poll) — no commentator action"
        }
        data-fotmob-verify={status}
      >
        {label}
      </span>
      {payload?.canApply ? (
        <button
          type="button"
          className="desk-btn text-[9px] px-1.5 py-0.5 inline-flex items-center gap-0.5 font-black border border-emerald-500/70 text-emerald-900 dark:text-emerald-100"
          disabled={busyApply}
          title="Import confirmed FotMob Official XI (T−30 only). Explicit click — AF remains default spine."
          onClick={() => void applyFotMob()}
        >
          <Download className="h-3 w-3" />
          {busyApply ? "Applying…" : "Apply FotMob XI"}
        </button>
      ) : null}
      {applyMsg && (
        <span className="text-[9px] font-semibold text-emerald-700 dark:text-emerald-300">
          {applyMsg}
        </span>
      )}
      {unmappedWarn && (
        <span
          className="text-[9px] font-semibold text-amber-800 dark:text-amber-200 max-w-[18rem]"
          title={unmappedWarn}
        >
          Unmapped: {unmappedWarn}
        </span>
      )}
    </span>
  );
}


export type { LineupSourceKind };
