"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LiveBannersBar } from "./live-banners";
import { FormH2HStrip } from "./form-h2h-strip";
import { OnAirStrip } from "./on-air-strip";
import { FtPackOffer } from "./ft-pack-offer";
import { SyncAgeChip } from "./sync-age-chip";
import { DeskHotkeyHelp } from "./desk-hotkey-help";
import { deriveLiveBanners, type BannerEvent, type SquadLite } from "@/lib/live-banners";

const BANNER_TTL_MS: Record<string, number> = {
  one_away: 18_000,
  var: 20_000,
  pens: 0, // keep while pens mode
};

function storageKey(matchId: string) {
  return `pitchline.dismissedBanners.${matchId}`;
}

function readDismissed(matchId: string): string[] {
  try {
    const raw = sessionStorage.getItem(storageKey(matchId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeDismissed(matchId: string, ids: string[]) {
  try {
    sessionStorage.setItem(storageKey(matchId), JSON.stringify(ids.slice(-40)));
  } catch {
    /* soft-fail */
  }
}

export function DeskLiveExtras({
  matchId,
  status,
  events,
  squad,
  homeName,
  awayName,
  homeScore,
  awayScore,
  h2hSummary,
  apiFootballFixtureId: _apiFootballFixtureId,
  lastFeedSyncAt,
  pollError,
  onAirMode,
  relevantNotes,
  clockLabel,
  helpOpen,
  onCloseHelp,
  onExpandNotes,
  onOpenEvents,
  onPlayerClick,
  notesDirty: _notesDirty,
}: {
  matchId: string;
  status: string;
  events: BannerEvent[];
  squad: SquadLite[];
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  h2hSummary?: string | null;
  apiFootballFixtureId: number | null;
  lastFeedSyncAt: string | Date | null;
  pollError?: string | null;
  onAirMode: boolean;
  relevantNotes: { id: string; title: string; body: string }[];
  clockLabel: string;
  helpOpen: boolean;
  onCloseHelp: () => void;
  onExpandNotes: () => void;
  onOpenEvents: () => void;
  onPlayerClick?: (playerId: string) => void;
  notesDirty?: boolean;
}) {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const seenBannerAtRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    setDismissedIds(readDismissed(matchId));
  }, [matchId]);

  // One-shot: banners were undismissable before this UX — clear sticky amber/violet
  // once per browser tab so a stuck "one away" (e.g. B. Johnson) drops immediately.
  useEffect(() => {
    const k = "pitchline.bannerDismissUx.v1";
    try {
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, "1");
    } catch {
      return;
    }
    const t = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("pitchline:clear-live-banners"));
    }, 500);
    return () => window.clearTimeout(t);
  }, [matchId]);

  const dismissBanner = useCallback(
    (id: string) => {
      setDismissedIds((prev) => {
        if (prev.includes(id)) return prev;
        const next = [...prev, id];
        writeDismissed(matchId, next);
        return next;
      });
    },
    [matchId]
  );

  // Esc / Clear from match-desk
  useEffect(() => {
    function onClear(e: Event) {
      const detail = (e as CustomEvent<{ ids?: string[] }>).detail;
      const ids = detail?.ids;
      if (ids?.length) {
        setDismissedIds((prev) => {
          const next = Array.from(new Set([...prev, ...ids]));
          writeDismissed(matchId, next);
          return next;
        });
        return;
      }
      // Clear-all: dismiss whatever is currently showing — handled below via ref of visible ids
      const visible = visibleIdsRef.current;
      if (!visible.length) return;
      setDismissedIds((prev) => {
        const next = Array.from(new Set([...prev, ...visible]));
        writeDismissed(matchId, next);
        return next;
      });
    }
    window.addEventListener("pitchline:clear-live-banners", onClear as EventListener);
    return () =>
      window.removeEventListener("pitchline:clear-live-banners", onClear as EventListener);
  }, [matchId]);

  const allBanners = useMemo(
    () =>
      deriveLiveBanners({
        events,
        squad,
        status,
        homeName,
        awayName,
        homeScore,
        awayScore,
      }),
    [events, squad, status, homeName, awayName, homeScore, awayScore]
  );

  const banners = useMemo(
    () => allBanners.filter((b) => !dismissedIds.includes(b.id)),
    [allBanners, dismissedIds]
  );

  const visibleIdsRef = useRef<string[]>([]);
  visibleIdsRef.current = banners.map((b) => b.id);

  // Force shorter TTL on warning banners (one_away / var) so they cannot stick forever
  useEffect(() => {
    const timers: number[] = [];
    const now = Date.now();
    for (const b of banners) {
      const ttl = BANNER_TTL_MS[b.kind] ?? 0;
      if (ttl <= 0) continue;
      if (!seenBannerAtRef.current.has(b.id)) {
        seenBannerAtRef.current.set(b.id, now);
      }
      const shownAt = seenBannerAtRef.current.get(b.id)!;
      const remaining = Math.max(0, ttl - (now - shownAt));
      timers.push(
        window.setTimeout(() => dismissBanner(b.id), remaining || 1) as unknown as number
      );
    }
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [banners, dismissBanner]);

  const lastEvent = events.length ? events[events.length - 1]! : null;

  return (
    <>
      <div className="shrink-0 flex items-center gap-2 px-1">
        <SyncAgeChip lastFeedSyncAt={lastFeedSyncAt} pollError={pollError} />
        <span className="text-[10px] text-slate-400">
          Press <kbd className="font-mono">?</kbd> for hotkeys ·{" "}
          <kbd className="font-mono">O</kbd> On-air mode
        </span>
      </div>

      <LiveBannersBar
        banners={banners}
        onPlayerClick={onPlayerClick}
        onDismiss={dismissBanner}
      />

      <FormH2HStrip
        matchId={matchId}
        h2hSummary={h2hSummary}
        homeName={homeName}
        awayName={awayName}
        visible={status === "Live" || status === "Half Time"}
      />

      <FtPackOffer
        matchId={matchId}
        status={status}
        visible={status === "Full Time"}
      />

      {onAirMode && (
        <div className="px-1">
          <OnAirStrip
            relevantNotes={relevantNotes}
            lastEvent={lastEvent}
            scoreline={`${homeName} ${homeScore}–${awayScore} ${awayName}`}
            clockLabel={clockLabel}
            onExpandNotes={onExpandNotes}
            onOpenEvents={onOpenEvents}
          />
        </div>
      )}

      <DeskHotkeyHelp open={helpOpen} onClose={onCloseHelp} />
    </>
  );
}
