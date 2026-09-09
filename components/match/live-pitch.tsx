"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PitchBoard, type PitchPlayer } from "@/components/match/pitch";
import type { MatchKitColors } from "@/lib/kit-colors";
import { NotesPanel, type NoteRow } from "@/components/notes/notes-panel";
import { PlayerDossier } from "@/components/match/player-dossier";

type Coach = {
  name: string;
  nationality: string;
  age: number | null;
  photoUrl?: string | null;
};

export function LivePitch({
  matchId,
  homeName,
  awayName,
  homeColor,
  awayColor,
  homeKit = null,
  awayKit = null,
  homeFormation,
  awayFormation,
  homePlayers,
  awayPlayers,
  homeCoach,
  awayCoach,
  referee,
  lineupStatus,
  notes,
}: {
  matchId: string;
  homeName: string;
  awayName: string;
  homeColor: string;
  awayColor: string;
  homeKit?: MatchKitColors | null;
  awayKit?: MatchKitColors | null;
  homeFormation: string;
  awayFormation: string;
  homePlayers: PitchPlayer[];
  awayPlayers: PitchPlayer[];
  homeCoach?: Coach | null;
  awayCoach?: Coach | null;
  referee?: string;
  lineupStatus: string;
  notes: NoteRow[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Match main desk: editable even when Official
  const locked = false;

  const byId = useMemo(() => {
    const m = new Map<string, PitchPlayer & { side: "home" | "away" }>();
    for (const p of homePlayers) m.set(p.id, { ...p, side: "home" });
    for (const p of awayPlayers) m.set(p.id, { ...p, side: "away" });
    return m;
  }, [homePlayers, awayPlayers]);

  const filtered = useMemo(() => {
    if (!selectedId) return notes;
    return notes.filter((n) => n.entityId === selectedId);
  }, [notes, selectedId]);

  const lineupAction = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      try {
        const res = await fetch(`/api/matches/${matchId}/lineup`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok) setMsg(json.error || "Lineup update failed");
        else {
          setMsg(null);
          router.refresh();
        }
      } finally {
        setBusy(false);
      }
    },
    [matchId, router]
  );

  async function onSlotDrop(args: {
    side: "home" | "away";
    slotId: string;
    playerId: string;
  }) {
    const player = byId.get(args.playerId);
    if (!player) return;
    if (player.side !== args.side) {
      setMsg("Players can only be placed on their own team half.");
      return;
    }
    await lineupAction({
      action: "place",
      playerId: args.playerId,
      formationSlot: args.slotId,
    });
  }

  async function onSlotClick(args: {
    side: "home" | "away";
    slotId: string;
    occupantId?: string | null;
  }) {
    // Without placing mode on live page, click opens dossier via onPlayerClick
    void args;
  }

  async function onClearSlot(args: {
    side: "home" | "away";
    slotId: string;
    playerId: string;
  }) {
    await lineupAction({ action: "clear", playerId: args.playerId });
  }

  return (
    <div className="space-y-3">
      {msg && <p className="text-xs text-amber-700">{msg}</p>}
      <PitchBoard
        homeName={homeName}
        awayName={awayName}
        homeColor={homeColor}
        awayColor={awayColor}
        homeKit={homeKit}
        awayKit={awayKit}
        homeFormation={homeFormation}
        awayFormation={awayFormation}
        homePlayers={homePlayers}
        awayPlayers={awayPlayers}
        homeCoach={homeCoach}
        awayCoach={awayCoach}
        referee={referee}
        lineupStatus={lineupStatus}
        onPlayerClick={(p) => setSelectedId(p.id)}
        onSlotDrop={busy ? undefined : onSlotDrop}
        onSlotClick={onSlotClick}
        onClearSlot={onClearSlot}
        locked={locked}
      />
      <NotesPanel
        matchId={matchId}
        initialNotes={selectedId ? filtered : notes}
        entityType={selectedId ? "player" : undefined}
        entityId={selectedId || undefined}
        entityLabel={
          selectedId ? byId.get(selectedId)?.name || "Player" : "Match"
        }
        compact
      />
      {selectedId && (
        <>
          <button
            type="button"
            className="text-xs text-teal-700 dark:text-teal-300 hover:underline"
            onClick={() => setSelectedId(null)}
          >
            Clear player filter
          </button>
          <PlayerDossier
            matchId={matchId}
            playerId={selectedId}
            onClose={() => setSelectedId(null)}
          />
        </>
      )}
    </div>
  );
}
