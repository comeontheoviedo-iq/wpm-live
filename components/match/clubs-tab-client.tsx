"use client";

import { ClubDossier } from "@/components/match/club-dossier";

type ClubChip = {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string;
  apiFootballTeamId: number | null;
};

export function ClubsTabClient({
  matchId,
  home,
  away,
}: {
  matchId: string;
  home: ClubChip;
  away: ClubChip;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Clubs</h2>
        <p className="text-sm text-[var(--muted)]">
          Both club profiles side by side — AF dossiers, not a squad replica.
        </p>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {[home, away].map((c) => (
          <div
            key={c.id}
            className="relative min-h-[70vh] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]"
          >
            <ClubDossier
              matchId={matchId}
              clubId={c.id}
              embedded
              onClose={() => undefined}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
