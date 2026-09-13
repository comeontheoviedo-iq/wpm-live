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
  // Preserve single-club desks (missing side) without collapsing the grid.
  const clubs = (
    [
      { side: "home" as const, club: home },
      { side: "away" as const, club: away },
    ] as const
  ).filter(({ club }) => Boolean(club?.id));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Clubs</h2>
        <p className="text-sm text-[var(--muted)]">
          Both club profiles side by side — AF dossiers, not a squad replica.
        </p>
      </div>
      <div
        className={
          clubs.length > 1
            ? "grid gap-3 xl:grid-cols-2"
            : "grid gap-3 grid-cols-1"
        }
      >
        {clubs.map(({ side, club: c }) => (
          <div
            key={`${side}:${c.id}`}
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
