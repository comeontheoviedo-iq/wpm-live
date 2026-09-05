"use client";

import { useMemo } from "react";
import { LiveBannersBar } from "./live-banners";
import { FormH2HStrip } from "./form-h2h-strip";
import { WatchlistBar } from "./watchlist-bar";
import { OnAirStrip } from "./on-air-strip";
import { FtPackOffer } from "./ft-pack-offer";
import { SyncAgeChip } from "./sync-age-chip";
import { DeskHotkeyHelp } from "./desk-hotkey-help";
import { deriveLiveBanners, type BannerEvent, type SquadLite } from "@/lib/live-banners";

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
  apiFootballFixtureId,
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
  notesDirty,
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
  const isLiveish =
    status === "Live" || status === "Half Time" || status === "Full Time";

  const banners = useMemo(
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

      <WatchlistBar
        matchId={matchId}
        currentFixtureId={apiFootballFixtureId}
        visible={isLiveish}
        notesDirty={notesDirty}
      />

      <LiveBannersBar banners={banners} onPlayerClick={onPlayerClick} />

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
