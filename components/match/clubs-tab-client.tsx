"use client";

import { useState } from "react";
import { ClubDossier } from "@/components/match/club-dossier";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [openId, setOpenId] = useState<string | null>(home.id);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Clubs</h2>
        <p className="text-sm text-[var(--muted)]">
          Full club dossiers (AF) — not a squad replica. Open either side.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {[home, away].map((c) => {
          const crest = c.apiFootballTeamId
            ? `https://media.api-sports.io/football/teams/${c.apiFootballTeamId}.png`
            : null;
          const active = openId === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setOpenId(c.id)}
              className={cn(
                "flex items-center gap-3 rounded-[var(--radius-md)] border px-4 py-3 text-left transition focus-ring",
                active
                  ? "border-[var(--border-strong)] bg-[var(--surface)] shadow-xs"
                  : "border-[var(--border)] bg-[var(--surface-muted)] hover:bg-[var(--surface)] hover:border-[var(--border-strong)]"
              )}
            >
              {crest ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={crest} alt="" className="h-12 w-12 object-contain" />
              ) : (
                <span
                  className="h-12 w-12 rounded-full flex items-center justify-center text-white"
                  style={{ backgroundColor: c.primaryColor }}
                >
                  <Building2 className="h-6 w-6" />
                </span>
              )}
              <div>
                <div className="font-bold">{c.name}</div>
                <div className="text-xs text-[var(--muted)]">Open club dossier</div>
              </div>
            </button>
          );
        })}
      </div>

      {openId ? (
        <div className="relative min-h-[70vh] rounded-[var(--radius-md)] border border-[var(--border)] overflow-hidden bg-[var(--surface)]">
          <ClubDossier
            key={openId}
            matchId={matchId}
            clubId={openId}
            onClose={() => setOpenId(null)}
          />
        </div>
      ) : null}
    </div>
  );
}
