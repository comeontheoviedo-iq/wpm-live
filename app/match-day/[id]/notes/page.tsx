import { notFound } from "next/navigation";
import { getMatchFull } from "@/lib/match-data";
import { NotesMatchClient } from "@/components/notes/notes-match-client";

export default async function NotesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatchFull(id);
  if (!match) notFound();

  const playerNameById: Record<string, string> = {};
  for (const p of match.homeClub?.players || []) {
    if (p?.id && p?.name) playerNameById[p.id] = p.name;
  }
  for (const p of match.awayClub?.players || []) {
    if (p?.id && p?.name) playerNameById[p.id] = p.name;
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold">Notes</h2>
        <p className="text-sm text-slate-500">
          Call-queue notes for live — open a player dossier from any player note.
          Notes stay here and in dossiers, not under pitch tokens.
        </p>
      </div>
      <NotesMatchClient
        matchId={match.id}
        initialNotes={match.notes.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          category: n.category,
          entityType: n.entityType,
          entityId: n.entityId,
          pinned: n.pinned,
        }))}
        playerNameById={playerNameById}
      />
    </div>
  );
}
