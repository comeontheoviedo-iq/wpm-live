"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayerDossier } from "@/components/match/player-dossier";
import { FORMATIONS, slotsFor } from "@/lib/formations";

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

const POS_ORDER = [
  "GK",
  "RB",
  "RWB",
  "RCB",
  "CB",
  "LCB",
  "LB",
  "LWB",
  "RDM",
  "CDM",
  "LDM",
  "RCM",
  "CM",
  "LCM",
  "RAM",
  "CAM",
  "LAM",
  "RM",
  "LM",
  "RW",
  "LW",
  "RST",
  "ST",
  "LST",
  "CF",
];

function slotRank(slot: string | null | undefined, formation: string): number {
  if (!slot || slot === "BENCH") return 900;
  const slots = slotsFor(formation);
  const idx = slots.findIndex((s) => s.id === slot);
  if (idx >= 0) return idx;
  const pos = POS_ORDER.indexOf(slot.toUpperCase());
  return pos >= 0 ? 100 + pos : 800;
}

function posRank(position: string | null | undefined): number {
  const p = (position || "").toUpperCase();
  if (p.startsWith("G")) return 0;
  if (p.startsWith("D")) return 1;
  if (p.startsWith("M")) return 2;
  if (p.startsWith("F") || p.startsWith("A") || p.startsWith("S")) return 3;
  return 4;
}

export function SquadPageClient({
  matchId,
  homeName,
  awayName,
  homeColor,
  awayColor,
  status,
  homePlayers,
  awayPlayers,
  homeFormation = "4-3-3",
  awayFormation = "4-2-3-1",
}: {
  matchId: string;
  homeName: string;
  awayName: string;
  homeColor: string;
  awayColor: string;
  status: string;
  homePlayers: Row[];
  awayPlayers: Row[];
  homeFormation?: string;
  awayFormation?: string;
}) {
  const [side, setSide] = useState<"home" | "away">("home");
  const [q, setQ] = useState("");
  const [dossierId, setDossierId] = useState<string | null>(null);
  const players = side === "home" ? homePlayers : awayPlayers;
  const color = side === "home" ? homeColor : awayColor;
  const formation =
    side === "home"
      ? homeFormation in FORMATIONS
        ? homeFormation
        : "4-3-3"
      : awayFormation in FORMATIONS
        ? awayFormation
        : "4-2-3-1";

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return players.filter((p) =>
      !needle
        ? true
        : p.name.toLowerCase().includes(needle) ||
          String(p.shirtNumber).includes(needle) ||
          (p.position || "").toLowerCase().includes(needle) ||
          (p.formationSlot || "").toLowerCase().includes(needle)
    );
  }, [players, q]);

  const xi = useMemo(() => {
    return filtered
      .filter((p) => p.onPitch || p.isStarter)
      .sort((a, b) => {
        const ra = slotRank(a.formationSlot, formation);
        const rb = slotRank(b.formationSlot, formation);
        if (ra !== rb) return ra - rb;
        return a.shirtNumber - b.shirtNumber;
      });
  }, [filtered, formation]);

  const bench = useMemo(() => {
    return filtered
      .filter(
        (p) =>
          !(p.onPitch || p.isStarter) &&
          (p.formationSlot === "BENCH" || p.formationSlot === "bench")
      )
      .sort((a, b) => {
        const pa = posRank(a.position);
        const pb = posRank(b.position);
        if (pa !== pb) return pa - pb;
        return a.shirtNumber - b.shirtNumber;
      });
  }, [filtered]);

  const notInSquad = useMemo(() => {
    return filtered
      .filter(
        (p) =>
          !(p.onPitch || p.isStarter) &&
          p.formationSlot !== "BENCH" &&
          p.formationSlot !== "bench"
      )
      .sort((a, b) => {
        const pa = posRank(a.position);
        const pb = posRank(b.position);
        if (pa !== pb) return pa - pb;
        return a.shirtNumber - b.shirtNumber;
      });
  }, [filtered]);

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
        <span className="text-[10px] uppercase tracking-wide text-slate-400 w-12 text-right">
          {p.formationSlot && p.formationSlot !== "BENCH"
            ? p.formationSlot
            : p.position || "—"}
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
            {status ? ` · ${status}` : ""} — XI in formation order · click for
            profile · place on{" "}
            <Link
              href={`/match-day/${matchId}`}
              className="text-teal-700 dark:text-teal-300 hover:underline"
            >
              Desk
            </Link>
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

      <div className="grid md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="py-2.5">
            <CardTitle className="text-sm flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              Current XI ({xi.length})
              <span className="font-normal text-slate-400">· {formation}</span>
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
            <CardTitle className="text-sm">Bench ({bench.length})</CardTitle>
          </CardHeader>
          <CardBody className="pt-0 space-y-0.5 max-h-[28rem] overflow-y-auto">
            {bench.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">
                No matchday bench listed — Sync after lineups.
              </p>
            ) : (
              bench.map((p) => <PlayerRow key={p.id} p={p} />)
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader className="py-2.5">
            <CardTitle className="text-sm">
              Not in matchday squad ({notInSquad.length})
            </CardTitle>
          </CardHeader>
          <CardBody className="pt-0 space-y-0.5 max-h-[28rem] overflow-y-auto">
            {notInSquad.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">
                Everyone listed is on the matchday squad.
              </p>
            ) : (
              notInSquad.map((p) => <PlayerRow key={p.id} p={p} />)
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
