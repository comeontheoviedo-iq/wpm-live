"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PitchBoard, type PitchPlayer } from "@/components/match/pitch";
import type { MatchKitColors } from "@/lib/kit-colors";
import { NotesPanel, type NoteRow } from "@/components/notes/notes-panel";
import { PlayerDossier } from "@/components/match/player-dossier";
import { noteMatchesRefereeCard } from "@/lib/notes-buckets";

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
  refereeNationality = null,
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
  refereeNationality?: string | null;
  lineupStatus: string;
  notes: NoteRow[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refereeOpen, setRefereeOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Match main desk: editable even when Official
  const locked = false;

  const noteCountById = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of notes) {
      if (!n.entityId) continue;
      m.set(n.entityId, (m.get(n.entityId) || 0) + 1);
    }
    return m;
  }, [notes]);

  const homeWithNotes = useMemo(
    () =>
      homePlayers.map((p) => ({
        ...p,
        noteCount: noteCountById.get(p.id) || 0,
      })),
    [homePlayers, noteCountById]
  );
  const awayWithNotes = useMemo(
    () =>
      awayPlayers.map((p) => ({
        ...p,
        noteCount: noteCountById.get(p.id) || 0,
      })),
    [awayPlayers, noteCountById]
  );

  const byId = useMemo(() => {
    const m = new Map<string, PitchPlayer & { side: "home" | "away" }>();
    for (const p of homeWithNotes) m.set(p.id, { ...p, side: "home" });
    for (const p of awayWithNotes) m.set(p.id, { ...p, side: "away" });
    return m;
  }, [homeWithNotes, awayWithNotes]);

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
        homePlayers={homeWithNotes}
        awayPlayers={awayWithNotes}
        homeCoach={homeCoach}
        awayCoach={awayCoach}
        referee={referee}
        refereeNationality={refereeNationality}
        lineupStatus={lineupStatus}
        onPlayerClick={(p) => {
          setRefereeOpen(false);
          setSelectedId(p.id);
        }}
        onRefereeClick={
          referee
            ? () => {
                setSelectedId(null);
                setRefereeOpen(true);
              }
            : undefined
        }
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
        playerNameById={Object.fromEntries(
          [...byId.entries()].map(([id, p]) => [id, p.name])
        )}
        onNotePlayerClick={(pid) => setSelectedId(pid)}
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
            initialTab="notes"
            initialNotes={notes.filter((n) => n.entityId === selectedId)}
            onClose={() => setSelectedId(null)}
          />
        </>
      )}
      {refereeOpen && referee && (
        <div
          className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 space-y-2"
          data-referee-dossier="1"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Referee profile
              </div>
              <div className="font-bold text-sm truncate">{referee}</div>
              <p className="text-xs text-slate-500">
                {[refereeNationality, "Match official"].filter(Boolean).join(" · ")}
              </p>
            </div>
            <button
              type="button"
              className="rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs"
              onClick={() => setRefereeOpen(false)}
            >
              Close
            </button>
          </div>
          <NotesPanel
            matchId={matchId}
            entityType="referee"
            entityId="referee"
            entityLabel={referee}
            initialNotes={notes.filter((n) =>
              noteMatchesRefereeCard(n, { refereeName: referee })
            )}
            compact
          />
        </div>
      )}
    </div>
  );
}
