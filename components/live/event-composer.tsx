"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  EVENT_SHORTCUTS,
  EventType,
  suggestCommentary,
} from "@/lib/commentary";
import { cn } from "@/lib/utils";
import { Keyboard, Sparkles, Send } from "lucide-react";

type PlayerOpt = {
  id: string;
  name: string;
  shirtNumber: number;
  side: "home" | "away";
  team: string;
};

export function EventComposer({
  matchId,
  homeName,
  awayName,
  homeScore,
  awayScore,
  minute: initialMinute,
  players,
  compact,
}: {
  matchId: string;
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  minute: number;
  players: PlayerOpt[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [type, setType] = useState<EventType>("goal");
  const [minute, setMinute] = useState(initialMinute || 1);
  const [playerId, setPlayerId] = useState("");
  const [teamSide, setTeamSide] = useState<"home" | "away">("home");
  const [description, setDescription] = useState("");
  const [commentary, setCommentary] = useState("");
  const [pending, setPending] = useState(false);
  const [showKeys, setShowKeys] = useState(false);

  const selected = players.find((p) => p.id === playerId);

  const suggestions = useMemo(() => {
    const score =
      type === "goal" || type === "penalty_goal" || type === "own_goal"
        ? teamSide === "home"
          ? `${homeScore + 1}-${awayScore}`
          : `${homeScore}-${awayScore + 1}`
        : `${homeScore}-${awayScore}`;
    return suggestCommentary(type, {
      player: selected?.name || "the attacker",
      team: teamSide === "home" ? homeName : awayName,
      home: homeName,
      away: awayName,
      minute,
      score,
    });
  }, [
    type,
    selected,
    teamSide,
    homeName,
    awayName,
    minute,
    homeScore,
    awayScore,
  ]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const hit = EVENT_SHORTCUTS.find((s) => s.key === e.key.toLowerCase());
      if (hit) {
        e.preventDefault();
        setType(hit.type);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function submit() {
    setPending(true);
    try {
      const res = await fetch(`/api/matches/${matchId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          minute,
          playerId: playerId || null,
          teamSide,
          description:
            description ||
            `${type.replace("_", " ")} — ${selected?.name || teamSide}`,
          commentary: commentary || suggestions[0],
        }),
      });
      if (!res.ok) throw new Error("fail");
      setDescription("");
      setCommentary("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-teal-200 dark:border-teal-900 bg-gradient-to-br from-teal-50/80 to-white dark:from-teal-950/40 dark:to-slate-900 shadow-sm",
        compact ? "p-3" : "p-4"
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
          </span>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Live event composer
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setShowKeys((v) => !v)}
          className="text-xs text-slate-500 flex items-center gap-1 hover:text-teal-600"
        >
          <Keyboard className="h-3.5 w-3.5" />
          Shortcuts
        </button>
      </div>

      {showKeys && (
        <div className="mb-3 flex flex-wrap gap-1.5 text-[11px]">
          {EVENT_SHORTCUTS.map((s) => (
            <span
              key={s.key}
              className="rounded border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-slate-600 dark:text-slate-300"
            >
              <kbd className="font-mono font-bold text-teal-700 dark:text-teal-300">
                {s.key.toUpperCase()}
              </kbd>{" "}
              {s.label}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mb-3">
        {EVENT_SHORTCUTS.map((s) => (
          <button
            key={s.type}
            type="button"
            onClick={() => setType(s.type)}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-medium border transition",
              type === s.type
                ? "bg-teal-600 text-white border-teal-600"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <label className="text-xs text-slate-500">
          Minute
          <input
            type="number"
            min={0}
            max={120}
            value={minute}
            onChange={(e) => setMinute(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-slate-500">
          Side
          <select
            value={teamSide}
            onChange={(e) => setTeamSide(e.target.value as "home" | "away")}
            className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-sm"
          >
            <option value="home">{homeName}</option>
            <option value="away">{awayName}</option>
          </select>
        </label>
        <label className="text-xs text-slate-500 col-span-2">
          Player
          <select
            value={playerId}
            onChange={(e) => {
              setPlayerId(e.target.value);
              const p = players.find((x) => x.id === e.target.value);
              if (p) setTeamSide(p.side);
            }}
            className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-sm"
          >
            <option value="">— optional —</option>
            {players
              .filter((p) => p.side === teamSide)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.shirtNumber} {p.name}
                </option>
              ))}
          </select>
        </label>
      </div>

      <textarea
        placeholder="Event description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm mb-2"
      />

      <div className="mb-2">
        <div className="flex items-center gap-1 text-xs text-teal-700 dark:text-teal-300 mb-1">
          <Sparkles className="h-3.5 w-3.5" />
          AI commentary templates
        </div>
        <div className="flex flex-col gap-1">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCommentary(s)}
              className="text-left text-xs rounded-lg border border-teal-100 dark:border-teal-900 bg-white/70 dark:bg-slate-950/60 px-2 py-1.5 hover:border-teal-400 transition"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <textarea
        placeholder="Commentary line"
        value={commentary}
        onChange={(e) => setCommentary(e.target.value)}
        rows={2}
        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm mb-3"
      />

      <Button onClick={submit} disabled={pending} className="w-full sm:w-auto">
        <Send className="h-3.5 w-3.5" />
        Log event
      </Button>
    </div>
  );
}
