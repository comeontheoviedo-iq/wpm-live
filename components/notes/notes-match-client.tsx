"use client";

import { useMemo, useState } from "react";
import { NotesPanel, type NoteRow } from "@/components/notes/notes-panel";
import { PlayerDossier } from "@/components/match/player-dossier";

export function NotesMatchClient({
  matchId,
  initialNotes,
  playerNameById,
}: {
  matchId: string;
  initialNotes: NoteRow[];
  playerNameById: Record<string, string>;
}) {
  const [dossierId, setDossierId] = useState<string | null>(null);
  const notesForDossier = useMemo(
    () =>
      dossierId
        ? initialNotes.filter((n) => n.entityId === dossierId)
        : [],
    [dossierId, initialNotes]
  );

  return (
    <>
      <NotesPanel
        matchId={matchId}
        initialNotes={initialNotes}
        playerNameById={playerNameById}
        onNotePlayerClick={(pid) => setDossierId(pid)}
      />
      {dossierId ? (
        <PlayerDossier
          matchId={matchId}
          playerId={dossierId}
          initialTab="notes"
          initialNotes={notesForDossier}
          playerName={playerNameById[dossierId]}
          onClose={() => setDossierId(null)}
        />
      ) : null}
    </>
  );
}
