"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Radio,
  ExternalLink,
  Clapperboard,
  Megaphone,
  Link2,
  HandMetal,
  ListChecks,
  AlertTriangle,
  Sparkles,
  CircleDot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UR_PALETTE, UR_SHOW_STATUSES } from "@/lib/ur-show";

type Creative = {
  id: string;
  kind: string;
  label: string;
  canvaId: string | null;
  canvaUrl: string | null;
  assetUrl: string | null;
  status: string;
  sortOrder: number;
  placeholder?: string | null;
  brief?: string | null;
};

type SocialDraft = {
  id: string;
  slot: string;
  label: string;
  platform: string;
  copy: string;
  assetUrl: string | null;
  approved: boolean;
  scheduledAt: string | null;
  status: string;
  creativeKind: string | null;
};

type HandoffLog = {
  id: string;
  message: string;
  payload: unknown;
  createdAt: string;
};

type ProvisionTask = {
  key: string;
  label: string;
  status: "pending" | "done" | string;
};

export type Board = {
  showId: string;
  matchDayId: string;
  status: string;
  statuses: readonly string[] | string[];
  provisioningStatus?: string;
  provisioning?: boolean;
  provisionTasks?: ProvisionTask[];
  goLive?: {
    enabled: boolean;
    softWarn: string | null;
    note: string;
  };
  writeBackFields?: Record<string, string>;
  ytThumbUrl: string | null;
  ytTitle: string;
  ytDescription: string;
  fbCoverUrl: string | null;
  igStillUrl: string | null;
  igStillNote?: string | null;
  creativesPlaceholder?: string;
  thumbnailBrief?: string;
  creativeBriefs?: Record<string, string>;
  youtubeWatchUrl: string | null;
  restreamExternalUrl: string | null;
  destinationsGate: { pass: boolean; reason: string };
  restreamEventStubId: string | null;
  youtubeUpcomingStubId: string | null;
  restreamApi: string;
  youtubeApi: string;
  creatives: Creative[];
  socialDrafts: SocialDraft[];
  handoffReadyAt: string | null;
  handoffLogs: HandoffLog[];
  matchDay: {
    id: string;
    title: string;
    competition: string;
    matchId: string | null;
    afFixtureId: number | null;
    home: string | null;
    away: string | null;
    homeShort?: string | null;
    awayShort?: string | null;
    homeCrestUrl?: string | null;
    awayCrestUrl?: string | null;
    kickoff: string | null;
    kickoffLondon?: string | null;
    venue?: string | null;
  } | null;
  creativePackKey?: string | null;
  graphics: {
    rfcStudio: { label: string; note: string; localPro: string };
    overlayUrl: string;
    overlayParams: string;
    pitchOff: boolean;
  };
  canva: Record<
    string,
    {
      canvaId: string | null;
      canvaUrl: string | null;
      previewAsset: string | null;
      note?: string;
      provisional?: boolean;
    }
  >;
};

export function ShowBoardClient({
  initialBoard,
  user,
}: {
  initialBoard: Board;
  user: { name: string; avatarInitials: string };
}) {
  const [board, setBoard] = useState(initialBoard);
  const [busy, setBusy] = useState(false);
  const [ytUrl, setYtUrl] = useState(board.youtubeWatchUrl || "");
  const [rsUrl, setRsUrl] = useState(board.restreamExternalUrl || "");
  const [ytTitle, setYtTitle] = useState(board.ytTitle);
  const [ytDescription, setYtDescription] = useState(board.ytDescription);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const matchDayId = board.matchDayId;
  const statusIdx = UR_SHOW_STATUSES.indexOf(
    board.status as (typeof UR_SHOW_STATUSES)[number]
  );

  const applyBoard = (next: Board) => {
    setBoard(next);
    setYtUrl(next.youtubeWatchUrl || "");
    setRsUrl(next.restreamExternalUrl || "");
    setYtTitle(next.ytTitle);
    setYtDescription(next.ytDescription);
  };

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/show/${matchDayId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Update failed");
        applyBoard(data.board);
        return data.board as Board;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Update failed");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [matchDayId]
  );

  const setStatus = async (direction: "next" | "back") => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/show/${matchDayId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Status failed");
      applyBoard(data.board);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status failed");
    } finally {
      setBusy(false);
    }
  };

  const jumpStatus = async (status: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/show/${matchDayId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Status failed");
      applyBoard(data.board);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status failed");
    } finally {
      setBusy(false);
    }
  };

  const handoff = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/show/${matchDayId}/handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ready_for_desk" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Handoff failed");
      applyBoard(data.board);
      setToast(
        data.webhook?.ok
          ? "Handoff packaged + webhook fired → Remote desk"
          : "Handoff packaged (in-app log). Remote football comms desk is consumer."
      );
      setTimeout(() => setToast(null), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Handoff failed");
    } finally {
      setBusy(false);
    }
  };

  const goLive = async () => {
    if (!board.goLive?.enabled) {
      setError(board.destinationsGate.reason || "URL gate must PASS before GO LIVE");
      return;
    }
    if (board.goLive.softWarn) {
      const ok = window.confirm(
        `${board.goLive.softWarn}\n\nGO LIVE anyway? (Signal only — does not start encoder)`
      );
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/show/${matchDayId}/handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "go_live" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "GO LIVE failed");
      applyBoard(data.board);
      setToast(
        data.webhook?.ok
          ? "GO LIVE signal fired → U+R (Restream destinations + We're live)"
          : "GO LIVE logged in-app. U+R owns encoder — CoComms did not start streaming."
      );
      setTimeout(() => setToast(null), 6000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "GO LIVE failed");
    } finally {
      setBusy(false);
    }
  };

  const fixture = useMemo(() => {
    if (!board.matchDay) return board.matchDayId;
    if (board.matchDay.home && board.matchDay.away) {
      return `${board.matchDay.home} vs ${board.matchDay.away}`;
    }
    return board.matchDay.title;
  }, [board]);

  const sectionClass =
    "rounded-lg border border-white/10 p-3 sm:p-4";
  const sectionStyle = { background: UR_PALETTE.steel };

  return (
    <div
      className="min-h-dvh text-[var(--ur-ice)]"
      style={
        {
          "--ur-deep": UR_PALETTE.deep,
          "--ur-steel": UR_PALETTE.steel,
          "--ur-ice": UR_PALETTE.ice,
          "--ur-accent": UR_PALETTE.accent,
          background: UR_PALETTE.deep,
          color: UR_PALETTE.ice,
        } as React.CSSProperties
      }
    >
      <header
        className="sticky top-0 z-30 border-b border-white/10 backdrop-blur-md"
        style={{ background: "rgba(11,15,20,0.92)" }}
      >
        <div className="mx-auto flex max-w-[820px] flex-wrap items-center gap-3 px-3 py-3 sm:px-5">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded text-[11px] font-semibold uppercase tracking-[0.1em] text-white/55 hover:text-[var(--ur-accent)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Desks
          </Link>
          <div className="h-4 w-px bg-white/15" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Clapperboard
                className="h-3.5 w-3.5 shrink-0"
                style={{ color: UR_PALETTE.accent }}
              />
              <span
                className="text-[10px] font-bold uppercase tracking-[0.16em]"
                style={{ color: UR_PALETTE.accent }}
              >
                U&R Show board
              </span>
              <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/40 ring-1 ring-white/15">
                CoComms
              </span>
              {board.provisioning ? (
                <span className="animate-pulse rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-200 ring-1 ring-amber-400/50 bg-amber-500/15">
                  Provisioning…
                </span>
              ) : null}
            </div>
            <h1 className="truncate text-sm font-bold tracking-tight sm:text-base">
              {fixture}
            </h1>
          </div>
          <div className="text-[10px] text-white/40">
            {user.name} · personal account
          </div>
        </div>
      </header>

      {/* One vertical spine */}
      <main className="mx-auto flex max-w-[820px] flex-col gap-3 px-3 py-4 sm:px-5 sm:py-5">
        {error ? (
          <div className="flex items-center gap-2 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        ) : null}
        {toast ? (
          <div
            className="flex items-center gap-2 rounded border px-3 py-2 text-[12px]"
            style={{
              borderColor: "rgba(126,182,255,0.45)",
              background: "rgba(126,182,255,0.12)",
              color: UR_PALETTE.ice,
            }}
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: UR_PALETTE.accent }} />
            {toast}
          </div>
        ) : null}

        {/* Status spine — vertical */}
        <section className={sectionClass} style={sectionStyle} aria-label="Show status spine">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
              Status spine
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy || statusIdx <= 0}
                onClick={() => setStatus("back")}
                className="inline-flex items-center gap-1 rounded border border-white/15 bg-black/30 px-2.5 py-1.5 text-[11px] font-semibold text-white/70 hover:border-[var(--ur-accent)]/50 disabled:opacity-40"
              >
                <ArrowLeft className="h-3 w-3" />
                Back
              </button>
              <button
                type="button"
                disabled={busy || statusIdx >= UR_SHOW_STATUSES.length - 1}
                onClick={() => setStatus("next")}
                className="inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-[11px] font-bold text-[#0B0F14] disabled:opacity-40"
                style={{ background: UR_PALETTE.accent }}
              >
                Advance
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
          <ol className="flex flex-col gap-1.5">
            {UR_SHOW_STATUSES.map((s, i) => {
              const active = s === board.status;
              const done = i < statusIdx;
              return (
                <li key={s} className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-black",
                      active && "text-[#0B0F14]",
                      !active && done && "bg-white/15 text-white/70",
                      !active && !done && "bg-black/30 text-white/30 ring-1 ring-white/10"
                    )}
                    style={active ? { background: UR_PALETTE.accent } : undefined}
                  >
                    {i + 1}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => jumpStatus(s)}
                    className={cn(
                      "flex-1 rounded-md px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.1em] transition",
                      active &&
                        "shadow-[0_0_0_1px_rgba(126,182,255,0.55),0_0_18px_rgba(126,182,255,0.2)]",
                      !active && done && "bg-white/8 text-white/65",
                      !active && !done && "bg-black/20 text-white/35 ring-1 ring-white/8"
                    )}
                    style={
                      active
                        ? { background: UR_PALETTE.accent, color: UR_PALETTE.deep }
                        : undefined
                    }
                  >
                    {s}
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Match autofill */}
        {board.matchDay ? (
          <section className={sectionClass} style={sectionStyle}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
                Match autofill
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => patch({ action: "refresh-from-match" })}
                className="rounded border border-white/15 bg-black/30 px-2.5 py-1 text-[10px] font-semibold text-white/65 hover:border-[var(--ur-accent)]/50 disabled:opacity-40"
              >
                Refresh from match
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {board.matchDay.homeCrestUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={board.matchDay.homeCrestUrl}
                  alt=""
                  className="h-10 w-10 object-contain"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">
                  {board.matchDay.home} vs {board.matchDay.away}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-white/50">
                  <span>{board.matchDay.competition}</span>
                  {board.matchDay.venue ? <span>{board.matchDay.venue}</span> : null}
                  {board.matchDay.kickoffLondon ? (
                    <span className="font-semibold text-white/70">
                      KO {board.matchDay.kickoffLondon}
                    </span>
                  ) : null}
                  {board.matchDay.afFixtureId ? (
                    <span>AF #{board.matchDay.afFixtureId}</span>
                  ) : null}
                  {board.creativePackKey ? (
                    <span style={{ color: UR_PALETTE.accent }}>
                      pack:{board.creativePackKey}
                    </span>
                  ) : null}
                </div>
              </div>
              {board.matchDay.awayCrestUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={board.matchDay.awayCrestUrl}
                  alt=""
                  className="h-10 w-10 object-contain"
                />
              ) : null}
            </div>
          </section>
        ) : null}

        {/* Provisioning stubs — sticky with destinations */}
        {board.provisioning || board.provisionTasks?.length ? (
          <section
            className={cn(sectionClass, "border-amber-400/30")}
            style={{ background: "rgba(245,158,11,0.08)" }}
          >
            <div className="mb-2 flex items-center gap-2">
              <CircleDot className="h-3.5 w-3.5 text-amber-300" />
              <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-200/90">
                {board.provisioning ? "Provisioning… — U+R desk stubs" : "Provision tasks"}
              </h2>
            </div>
            <ul className="space-y-1.5">
              {(board.provisionTasks || []).map((t) => (
                <li
                  key={t.key}
                  className="flex items-center gap-2 rounded border border-white/10 bg-black/25 px-2.5 py-1.5 text-[11px]"
                >
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[9px] font-black uppercase",
                      t.status === "done"
                        ? "bg-emerald-500/25 text-emerald-300"
                        : "bg-amber-500/20 text-amber-200"
                    )}
                  >
                    {t.status}
                  </span>
                  <span className="text-white/70">{t.label}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-white/40">
              U+R PATCHes destination URLs back to clear provisioning. Write-back:{" "}
              <code className="text-white/55">youtubeWatchUrl</code>,{" "}
              <code className="text-white/55">restreamExternalUrl</code>, creatives via{" "}
              <code className="text-white/55">set-assets</code>.
            </p>
          </section>
        ) : null}

        {/* Destinations + gate — sticky near top of spine */}
        <section
          className={cn(sectionClass, "sticky top-[3.25rem] z-20 shadow-[0_8px_32px_rgba(0,0,0,0.45)]")}
          style={sectionStyle}
        >
          <div className="mb-3 flex items-center gap-2">
            <Link2 className="h-3.5 w-3.5" style={{ color: UR_PALETTE.accent }} />
            <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/55">
              Destinations / URL gate
            </h2>
            <span
              className={cn(
                "ml-auto rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wider",
                board.destinationsGate.pass
                  ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40"
                  : "bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/40"
              )}
            >
              {board.destinationsGate.pass ? "PASS" : "FAIL"}
            </span>
          </div>
          <p className="mb-3 text-[11px] text-white/45">
            YouTube watch URL must equal Restream destination externalUrl. Empty until U+R
            wires on enable_provision — FAIL until both present and equal.
          </p>
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-white/40">
            YouTube watch URL
            <input
              value={ytUrl}
              onChange={(e) => setYtUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
              className="mt-1 w-full rounded border border-white/12 bg-black/35 px-3 py-2 text-[12px] text-[var(--ur-ice)] outline-none focus:border-[var(--ur-accent)]/60"
            />
          </label>
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-white/40">
            Restream externalUrl
            <input
              value={rsUrl}
              onChange={(e) => setRsUrl(e.target.value)}
              placeholder="Must match YouTube watch URL"
              className="mt-1 w-full rounded border border-white/12 bg-black/35 px-3 py-2 text-[12px] text-[var(--ur-ice)] outline-none focus:border-[var(--ur-accent)]/60"
            />
          </label>
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-white/40">
            YT title{" "}
            <span className="normal-case tracking-normal text-white/30">
              ({ytTitle.length}/100)
            </span>
            <input
              value={ytTitle}
              onChange={(e) => setYtTitle(e.target.value)}
              maxLength={100}
              className="mt-1 w-full rounded border border-white/12 bg-black/35 px-3 py-2 text-[12px] outline-none focus:border-[var(--ur-accent)]/60"
            />
          </label>
          <label className="mb-3 block text-[10px] font-semibold uppercase tracking-wider text-white/40">
            YT description
            <textarea
              value={ytDescription}
              onChange={(e) => setYtDescription(e.target.value)}
              rows={5}
              className="mt-1 w-full rounded border border-white/12 bg-black/35 px-3 py-2 text-[12px] outline-none focus:border-[var(--ur-accent)]/60"
            />
          </label>
          <p className="mb-3 text-[11px] text-white/40">{board.destinationsGate.reason}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              patch({
                youtubeWatchUrl: ytUrl,
                restreamExternalUrl: rsUrl,
                ytTitle,
                ytDescription,
              })
            }
            className="rounded px-3 py-2 text-[11px] font-bold text-[#0B0F14] disabled:opacity-40"
            style={{ background: UR_PALETTE.accent }}
          >
            Save destinations
          </button>
          <div className="mt-3 space-y-1 border-t border-white/10 pt-3 text-[10px] text-white/35">
            <div>
              Restream stub:{" "}
              <code className="text-white/55">{board.restreamEventStubId}</code> ({board.restreamApi})
            </div>
            <div>
              YT upcoming stub:{" "}
              <code className="text-white/55">{board.youtubeUpcomingStubId}</code> ({board.youtubeApi})
            </div>
          </div>
        </section>

        {/* GO LIVE — separate from Ready for desk / Enable */}
        <section
          className="rounded-lg border p-3 sm:p-4"
          style={{
            background: "linear-gradient(135deg, #1A2332 0%, #0B0F14 100%)",
            borderColor: board.goLive?.enabled
              ? "rgba(52,211,153,0.45)"
              : "rgba(255,255,255,0.12)",
          }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-emerald-300" />
                <h2 className="text-[12px] font-bold uppercase tracking-[0.12em]">
                  GO LIVE
                </h2>
              </div>
              <p className="mt-1 max-w-xl text-[11px] text-white/50">
                Signal only — starts Restream destinations path + We&apos;re live cadence on
                U+R. CoComms does <strong className="text-white/75">not</strong> start the
                encoder (OBS/U+R owns streaming). Separate from Enable / Ready for desk.
              </p>
              {board.goLive?.softWarn ? (
                <p className="mt-1 text-[10px] font-semibold text-amber-200/90">
                  Soft-warn: {board.goLive.softWarn}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              disabled={busy || !board.goLive?.enabled}
              onClick={goLive}
              title={
                board.goLive?.enabled
                  ? "Send go_live signal to U+R"
                  : board.destinationsGate.reason
              }
              className="inline-flex items-center justify-center gap-2 rounded px-5 py-3 text-[12px] font-black uppercase tracking-[0.08em] text-[#0B0F14] shadow-[0_0_28px_rgba(52,211,153,0.35)] disabled:opacity-35 disabled:shadow-none"
              style={{ background: "#34d399" }}
            >
              <Radio className="h-4 w-4" />
              GO LIVE
            </button>
          </div>
        </section>

        {/* Graphics checklist */}
        <section className={sectionClass} style={sectionStyle}>
          <div className="mb-3 flex items-center gap-2">
            <ListChecks className="h-3.5 w-3.5" style={{ color: UR_PALETTE.accent }} />
            <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/55">
              Graphics checklist
            </h2>
          </div>
          <ul className="space-y-2 text-[12px]">
            <li className="rounded border border-white/10 bg-black/25 px-3 py-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                RFC Studio
              </div>
              <div className="mt-0.5 text-white/75">{board.graphics.rfcStudio.note}</div>
              <a
                href={board.graphics.rfcStudio.localPro}
                className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold"
                style={{ color: UR_PALETTE.accent }}
              >
                {board.graphics.rfcStudio.localPro}
                <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            <li className="rounded border border-white/10 bg-black/25 px-3 py-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                Overlay (pitch OFF)
              </div>
              <div className="mt-0.5 break-all text-[11px] text-white/70">
                {board.graphics.overlayUrl}
              </div>
              <div className="mt-1 text-[10px] text-white/40">
                Params: {board.graphics.overlayParams} · scorebug off · lower flashes
              </div>
              <a
                href={board.graphics.overlayUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold"
                style={{ color: UR_PALETTE.accent }}
              >
                Open overlay
                <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            {board.matchDay?.matchId ? (
              <li className="rounded border border-white/10 bg-black/25 px-3 py-2">
                <Link
                  href={`/match-day/${board.matchDay.matchId}`}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold"
                  style={{ color: UR_PALETTE.accent }}
                >
                  Open match desk
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </li>
            ) : null}
          </ul>
        </section>

        {/* Creatives — consistent grid + crests */}
        <section className={sectionClass} style={sectionStyle}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Megaphone className="h-3.5 w-3.5" style={{ color: UR_PALETTE.accent }} />
            <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/55">
              Creatives approve queue
            </h2>
            {(board.matchDay?.homeCrestUrl || board.matchDay?.awayCrestUrl) && (
              <div className="ml-auto flex items-center gap-1.5">
                {board.matchDay.homeCrestUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={board.matchDay.homeCrestUrl}
                    alt=""
                    className="h-5 w-5 object-contain opacity-80"
                  />
                ) : null}
                {board.matchDay.awayCrestUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={board.matchDay.awayCrestUrl}
                    alt=""
                    className="h-5 w-5 object-contain opacity-80"
                  />
                ) : null}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {board.creatives.map((c) => (
              <article
                key={c.id}
                className="overflow-hidden rounded border border-white/10 bg-black/30"
              >
                <div
                  className="relative aspect-video bg-[#0B0F14]"
                  style={{
                    backgroundImage: c.assetUrl ? `url(${c.assetUrl})` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  {!c.assetUrl ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center text-[10px] uppercase tracking-wider text-white/30">
                      <div className="flex items-center gap-2 opacity-70">
                        {board.matchDay?.homeCrestUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={board.matchDay.homeCrestUrl}
                            alt=""
                            className="h-8 w-8 object-contain"
                          />
                        ) : null}
                        <span className="text-white/20">vs</span>
                        {board.matchDay?.awayCrestUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={board.matchDay.awayCrestUrl}
                            alt=""
                            className="h-8 w-8 object-contain"
                          />
                        ) : null}
                      </div>
                      <span>Awaiting match-specific creatives pack</span>
                    </div>
                  ) : (
                    <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5">
                      {board.matchDay?.homeCrestUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={board.matchDay.homeCrestUrl}
                          alt=""
                          className="h-4 w-4 object-contain"
                        />
                      ) : null}
                      {board.matchDay?.awayCrestUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={board.matchDay.awayCrestUrl}
                          alt=""
                          className="h-4 w-4 object-contain"
                        />
                      ) : null}
                    </div>
                  )}
                  <span
                    className={cn(
                      "absolute left-2 top-2 rounded px-1.5 py-0.5 text-[9px] font-black uppercase",
                      c.status === "approved" && "bg-emerald-500/90 text-[#0B0F14]",
                      c.status === "rejected" && "bg-rose-500/90 text-white",
                      c.status === "pending" && "bg-black/70 text-white/80"
                    )}
                  >
                    {c.status}
                  </span>
                </div>
                <div className="space-y-2 p-2.5">
                  <div className="text-[12px] font-semibold text-[var(--ur-ice)]">
                    {c.label}
                  </div>
                  {c.canvaId ? (
                    <a
                      href={c.canvaUrl || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-semibold"
                      style={{ color: UR_PALETTE.accent }}
                    >
                      Canva {c.canvaId}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  ) : null}
                  {(c.brief || c.placeholder || (!c.assetUrl && !c.canvaId)) && (
                    <div className="rounded border border-white/8 bg-black/35 px-2 py-1.5 text-[10px] leading-snug text-amber-100/75">
                      <span className="mb-0.5 block text-[8px] font-black uppercase tracking-wider text-white/35">
                        {c.kind === "thumb" ? "Thumbnail brief" : "Pack note"}
                      </span>
                      {c.brief ||
                        c.placeholder ||
                        board.thumbnailBrief ||
                        board.creativesPlaceholder ||
                        "Awaiting match-specific creatives pack"}
                    </div>
                  )}
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        patch({ action: "creative", creativeId: c.id, status: "approved" })
                      }
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded bg-emerald-500/20 py-1.5 text-[10px] font-bold uppercase text-emerald-200 ring-1 ring-emerald-400/30 hover:bg-emerald-500/30 disabled:opacity-40"
                    >
                      <Check className="h-3 w-3" />
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        patch({ action: "creative", creativeId: c.id, status: "rejected" })
                      }
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded bg-rose-500/15 py-1.5 text-[10px] font-bold uppercase text-rose-200 ring-1 ring-rose-400/25 hover:bg-rose-500/25 disabled:opacity-40"
                    >
                      <X className="h-3 w-3" />
                      Reject
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Social calendar — one column */}
        <section className={sectionClass} style={sectionStyle}>
          <div className="mb-3 flex items-center gap-2">
            <Radio className="h-3.5 w-3.5" style={{ color: UR_PALETTE.accent }} />
            <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/55">
              Social calendar
            </h2>
            <span className="ml-auto text-[10px] text-white/35">
              T−day · T−1h · We&apos;re live · FT
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {board.socialDrafts.map((s) => (
              <div
                key={s.id}
                className="flex flex-col gap-2 rounded border border-white/10 bg-black/25 p-3"
              >
                <div className="flex items-start gap-3">
                  {s.assetUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.assetUrl}
                      alt=""
                      className="h-14 w-24 shrink-0 rounded object-cover ring-1 ring-white/10"
                    />
                  ) : (
                    <div className="flex h-14 w-24 shrink-0 flex-col items-center justify-center rounded bg-black/40 px-1 text-center text-[8px] uppercase leading-tight text-white/35 ring-1 ring-white/10">
                      Awaiting pack
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12px] font-bold">{s.label}</span>
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white/50">
                        {s.platform}
                      </span>
                      <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase text-white/40 ring-1 ring-white/15">
                        {s.slot}
                      </span>
                      {s.approved ? (
                        <span className="text-[9px] font-bold uppercase text-emerald-300">
                          Scheduled
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-white/55">{s.copy}</p>
                    {s.scheduledAt ? (
                      <div className="mt-0.5 text-[10px] text-white/35">
                        Slot:{" "}
                        {new Date(s.scheduledAt).toLocaleString("en-GB", {
                          timeZone: "Europe/London",
                        })}{" "}
                        PT
                      </div>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    patch({
                      action: "social",
                      slotId: s.id,
                      approved: !s.approved,
                    })
                  }
                  className={cn(
                    "w-full rounded px-3 py-1.5 text-[10px] font-bold uppercase disabled:opacity-40",
                    s.approved ? "bg-white/10 text-white/60" : "text-[#0B0F14]"
                  )}
                  style={!s.approved ? { background: UR_PALETTE.accent } : undefined}
                >
                  {s.approved ? "Unschedule" : "Approve → schedule"}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Ready for desk — separate from GO LIVE */}
        <section
          className="rounded-lg border p-3 sm:p-4"
          style={{
            background: "linear-gradient(135deg, #1A2332 0%, #0B0F14 100%)",
            borderColor: "rgba(126,182,255,0.35)",
          }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <HandMetal className="h-4 w-4" style={{ color: UR_PALETTE.accent }} />
                <h2 className="text-[12px] font-bold uppercase tracking-[0.12em]">
                  Ready for desk handoff
                </h2>
              </div>
              <p className="mt-1 max-w-xl text-[11px] text-white/50">
                Packages AF fixture, overlay, approved creatives/social. Not the same as GO
                LIVE. Optional webhook via{" "}
                <code className="text-white/45">UR_HANDOFF_WEBHOOK_URL</code>.
              </p>
              {board.handoffReadyAt ? (
                <p
                  className="mt-1 text-[10px] font-semibold"
                  style={{ color: UR_PALETTE.accent }}
                >
                  Last handoff:{" "}
                  {new Date(board.handoffReadyAt).toLocaleString("en-GB", {
                    timeZone: "Europe/London",
                  })}{" "}
                  PT
                </p>
              ) : null}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={handoff}
              className="inline-flex items-center justify-center gap-2 rounded px-5 py-3 text-[12px] font-black uppercase tracking-[0.08em] text-[#0B0F14] shadow-[0_0_28px_rgba(126,182,255,0.35)] disabled:opacity-40"
              style={{ background: UR_PALETTE.accent }}
            >
              <HandMetal className="h-4 w-4" />
              Ready for desk
            </button>
          </div>
          {board.handoffLogs?.length ? (
            <div className="mt-4 max-h-48 overflow-y-auto rounded border border-white/10 bg-black/40 p-2">
              <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-white/35">
                In-app handoff log
              </div>
              <ul className="space-y-1.5">
                {board.handoffLogs.map((h) => (
                  <li key={h.id} className="text-[11px] text-white/60">
                    <span className="font-mono text-[10px] text-white/35">
                      {new Date(h.createdAt).toLocaleString("en-GB", {
                        timeZone: "Europe/London",
                      })}
                    </span>{" "}
                    — {h.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
