"use client";

import { NotesPanel, type NoteRow } from "@/components/notes/notes-panel";

export function VenueNotesClient({
  matchId,
  venueId,
  venueLabel,
  initialNotes,
}: {
  matchId: string;
  venueId: string;
  venueLabel: string;
  initialNotes: NoteRow[];
}) {
  return (
    <NotesPanel
      matchId={matchId}
      initialNotes={initialNotes}
      entityType="venue"
      entityId={venueId}
      entityLabel={venueLabel}
      fillHeight
    />
  );
}
