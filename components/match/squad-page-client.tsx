"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayerDossier } from "@/components/match/player-dossier";

type Row = {
  id: string;
  name: string;
  shirtNumber: number;
  position?: string | null;
  nationality?: string | null;
  isStarter: boolean;
  onPitch?: boolean | null;
  formationSlot?: string | null;
  side: "home" | "away";
  team: string;
};

export function SquadPageClient({
  matchId,
  homeName,
  awayName,
  homeColor,
  awayColor,
  status,
  homePlayers,
  awayPlayers,
}: {
  matchId: string;
  homeName: string;
  awayName: string;
  homeColor: string;
  awayColor: string;
  status: string;
  homePlayers: Row[];
  awayPlayers: Row[];
}) {
  const [side, setSide] = useState<"home" | "away">("home");
  const [q, setQ] = useState("");
  const [dossierId, setDossierId] = useState<string | null>(null);
  const players = side === "home" ? homePlayers : awayPlayers;
  const color = side === "home" ? homeColor : awayColor;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return players
      .filter((p) =>
        !needle
          ? true
          : p.name.toLowerCase().includes(needle) ||
            String(p.shirtNumber).includes(needle) ||
            (p.position || "").toLowerCase().includes(needle) ||
            (p.formationSlot || "").toLowerCase().includes(needle)
      )
      .sort((a, b) => {
        const aOn = a.onPitch || a.isStarter ? 0 : 1;
        const bOn = b.onPitch || b.isStarter ? 0 : 1;
        if (aOn !== bOn) return aOn - bOn;
        return a.shirtNumber - b.shirtNumber;
      });
  }, [players, q]);

  const xi = filtered.filter((p) => p.onPitch || p.isStarter);
  const bench = filtered.filter((p) => !(p.onPitch || p.isStarter));
  const dossierPlayer = [...homePlayers, ...awayPlayers].find(
    (p) => p.id === dossierId
  );

  function PlayerRow({ p }: { p: Row }) {
    return (
      <button
        type="button"
        onClick={() => setDossierId(p.id)}
        className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-900 text-left"
        title={`Open ${p.name} profile`}
      >
        <span className="w-7 text-right tabular-nums font-bold text-slate-500">
          {p.shirtNumber}
        </span>
        <span className="min-w-0 flex-1 font-medium truncate text-teal-800 dark:text-teal-300 hover:underline">
          {p.name}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-slate-400 w-10 text-right">
          {p.formationSlot || p.position || "—"}
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold">Squad</h2>
          <p className="text-sm text-slate-500">
            {homeName} & {awayName}
            {status ? ` · ${status}` : ""} — click a name for profile · place XI
            on{" "}
            <Link
              href={`/match-day/${matchId}`}
              className="text-teal-700 dark:text-teal-300 hover:underline"
            >
              Desk
            </Link>
            {["Live", "Half Time", "Full Time"].includes(status)
              ? " (rail hidden during LIVE/FT)"
              : ""}
          </p>
        </div>
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          {(
            [
              ["home", homeName, homeColor],
              ["away", awayName, awayColor],
            ] as const
          ).map(([key, label, c]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSide(key)}
              className={cn(
                "px-3 py-1.5 text-sm font-semibold transition",
                side === key
                  ? "text-white"
                  : "bg-transparent text-slate-600 dark:text-slate-300"
              )}
              style={side === key ? { backgroundColor: c } : undefined}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Filter ${side === "home" ? homeName : awayName}…`}
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent pl-8 pr-3 py-2 text-sm"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="py-2.5">
            <CardTitle className="text-sm flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              Current XI ({xi.length})
            </CardTitle>
          </CardHeader>
          <CardBody className="pt-0 space-y-0.5">
            {xi.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">No XI set.</p>
            ) : (
              xi.map((p) => <PlayerRow key={p.id} p={p} />)
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader className="py-2.5">
            <CardTitle className="text-sm">Bench / squad ({bench.length})</CardTitle>
          </CardHeader>
          <CardBody className="pt-0 space-y-0.5 max-h-[28rem] overflow-y-auto">
            {bench.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">
                No bench listed.
              </p>
            ) : (
              bench.map((p) => <PlayerRow key={p.id} p={p} />)
            )}
          </CardBody>
        </Card>
      </div>

      {dossierId && (
        <PlayerDossier
          matchId={matchId}
          playerId={dossierId}
          playerName={dossierPlayer?.name}
          onClose={() => setDossierId(null)}
          initialTab="profile"
        />
      )}
    </div>
  );
}
