import { notFound } from "next/navigation";
import { getMatchFull } from "@/lib/match-data";
import { ChecklistClient } from "@/components/match/checklist";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_FLOW } from "@/lib/utils";
import { LinkFixtureCard } from "@/components/match/link-fixture";
import { NotesPanel } from "@/components/notes/notes-panel";

export default async function PrepPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatchFull(id);
  if (!match) notFound();
  const done = match.checklistItems.filter((c) => c.done).length;

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <div>
          <h2 className="text-xl font-bold">Match prep</h2>
          <p className="text-sm text-slate-500">
            {done}/{match.checklistItems.length} checklist items complete ·
            status {match.status}
          </p>
        </div>
        <ChecklistClient matchId={match.id} items={match.checklistItems} />
      </div>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Status pipeline</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {STATUS_FLOW.map((s) => (
              <div
                key={s}
                className={`rounded-lg px-3 py-2 text-sm ${
                  s === match.status
                    ? "bg-teal-600 text-white font-semibold"
                    : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                }`}
              >
                {s}
              </div>
            ))}
          </CardBody>
        </Card>
        <LinkFixtureCard
          matchId={match.id}
          currentFixtureId={match.apiFootballFixtureId}
        />
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
          compact
        />
      </div>
    </div>
  );
}
