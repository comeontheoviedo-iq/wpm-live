import { notFound } from "next/navigation";
import { getMatchFull } from "@/lib/match-data";
import { NotesPanel } from "@/components/notes/notes-panel";

export default async function NotesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatchFull(id);
  if (!match) notFound();

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold">Notes</h2>
        <p className="text-sm text-slate-500">
          Quick-access player, coach, and match notes during live.
        </p>
      </div>
      <NotesPanel
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
      />
    </div>
  );
}
