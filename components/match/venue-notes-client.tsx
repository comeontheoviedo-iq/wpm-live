"use client";

import { useState } from "react";
import { NotesPanel, type NoteRow } from "@/components/notes/notes-panel";
import { cn } from "@/lib/utils";

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
  const [tab, setTab] = useState<"overview" | "notes">("overview");

  return (
    <div className="space-y-2" data-venue-notes="1">
      <div className="flex gap-1" role="tablist" aria-label="Venue notes">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "overview"}
          className={cn(
            "rounded-[2px] px-2 py-1 text-[10px] font-bold uppercase tracking-wide",
            tab === "overview"
              ? "bg-teal-600/20 text-teal-300"
              : "text-slate-500 hover:text-slate-300"
          )}
          onClick={() => setTab("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "notes"}
          className={cn(
            "rounded-[2px] px-2 py-1 text-[10px] font-bold uppercase tracking-wide",
            tab === "notes"
              ? "bg-teal-600/20 text-teal-300"
              : "text-slate-500 hover:text-slate-300"
          )}
          onClick={() => setTab("notes")}
        >
          Notes{initialNotes.length ? ` (${initialNotes.length})` : ""}
        </button>
      </div>
      {tab === "overview" ? (
        initialNotes.length === 0 ? (
          <p className="text-xs text-slate-500">No venue notes linked yet.</p>
        ) : (
          <NotesPanel
            matchId={matchId}
            initialNotes={initialNotes}
            entityType="venue"
            entityId={venueId}
            entityLabel={venueLabel}
            readOnly
          />
        )
      ) : (
        <NotesPanel
          matchId={matchId}
          initialNotes={initialNotes}
          entityType="venue"
          entityId={venueId}
          entityLabel={venueLabel}
          fillHeight
        />
      )}
    </div>
  );
}
