"use client";

import { useState } from "react";
import { ClubDossier } from "@/components/match/club-dossier";
import { Building2 } from "lucide-react";

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
        <h2 className="text-xl font-bold">Clubs</h2>
        <p className="text-sm text-slate-500">
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
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                active
                  ? "border-teal-500 ring-2 ring-teal-500/30 bg-white dark:bg-slate-950"
                  : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 hover:border-slate-300"
              }`}
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
                <div className="text-xs text-slate-500">Open club dossier</div>
              </div>
            </button>
          );
        })}
      </div>

      {openId ? (
        <div className="relative min-h-[70vh] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
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
