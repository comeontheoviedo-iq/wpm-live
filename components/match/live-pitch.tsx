"use client";

import { useMemo, useState } from "react";
import { PitchBoard } from "@/components/match/pitch";
import { NotesPanel, NoteRow } from "@/components/notes/notes-panel";

type Player = {
  id: string;
  name: string;
  shirtNumber: number;
  formationSlot: string | null;
  isCaptain?: boolean;
  isStarter: boolean;
  onPitch?: boolean;
};

type Coach = { name: string; nationality: string; age: number | null };

export function LivePitch({
  matchId,
  homeName,
  awayName,
  homeColor,
  awayColor,
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
  homeFormation: string;
  awayFormation: string;
  homePlayers: Player[];
  awayPlayers: Player[];
  homeCoach?: Coach | null;
  awayCoach?: Coach | null;
  referee?: string;
  lineupStatus: string;
  notes: NoteRow[];
}) {
  const [selected, setSelected] = useState<Player | null>(null);
  const filtered = useMemo(() => {
    if (!selected) return notes;
    return notes.filter((n) => n.entityId === selected.id);
  }, [notes, selected]);

  return (
    <div className="space-y-3">
      <PitchBoard
        homeName={homeName}
        awayName={awayName}
        homeColor={homeColor}
        awayColor={awayColor}
        homeFormation={homeFormation}
        awayFormation={awayFormation}
        homePlayers={homePlayers}
        awayPlayers={awayPlayers}
        homeCoach={homeCoach}
        awayCoach={awayCoach}
        referee={referee}
        lineupStatus={lineupStatus}
        onPlayerClick={(p) => setSelected(p)}
      />
      <NotesPanel
        matchId={matchId}
        initialNotes={selected ? filtered : notes}
        entityType={selected ? "player" : undefined}
        entityId={selected?.id}
        entityLabel={selected ? selected.name : "Match"}
        compact
      />
      {selected && (
        <button
          type="button"
          className="text-xs text-teal-700 dark:text-teal-300 hover:underline"
          onClick={() => setSelected(null)}
        >
          Show all notes
        </button>
      )}
    </div>
  );
}
