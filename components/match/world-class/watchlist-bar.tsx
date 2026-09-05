"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type LiveFx = {
  id: number;
  status: string;
  elapsed: number | null;
  home: { id: number; name: string; logo?: string };
  away: { id: number; name: string; logo?: string };
  goals: { home: number | null; away: number | null };
};

export function WatchlistBar({
  matchId,
  currentFixtureId,
  visible,
  notesDirty,
}: {
  matchId: string;
  currentFixtureId: number | null;
  visible: boolean;
  /** If mid-edit, confirm before navigating */
  notesDirty?: boolean;
}) {
  const router = useRouter();
  const [live, setLive] = useState<LiveFx[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/matches/${matchId}/league`)
      .then((r) => r.json())
      .then((j) => {
        const list = (j.live || []) as LiveFx[];
        setLive(
          list.filter((fx) => !currentFixtureId || fx.id !== currentFixtureId)
        );
        if (j.message && !list.length) setMsg(j.message);
      })
      .catch(() => setMsg("Watchlist soft-failed"));
  }, [matchId, currentFixtureId]);

  useEffect(() => {
    if (!visible) return;
    load();
    const t = setInterval(load, 45_000);
    return () => clearInterval(t);
  }, [visible, load]);

  if (!visible || (!live.length && !msg)) return null;

  async function openFixture(fx: LiveFx) {
    if (
      notesDirty &&
      !window.confirm(
        "You may have unsaved notes edits. Open / create desk for this fixture anyway?"
      )
    ) {
      return;
    }
    // Hint: League tab already has fixtures — open league with hash, or try create flow
    const go = window.confirm(
      `Open League tab to attach or create a desk for\n${fx.home.name} ${fx.goals.home ?? "–"}–${fx.goals.away ?? "–"} ${fx.away.name}?\n\nOK = League tab · Cancel = stay`
    );
    if (go) {
      router.push(`/match-day/${matchId}/league`);
    }
  }

  return (
    <div className="mx-1 flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
      <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-slate-400 px-1">
        League live
      </span>
      {!live.length && msg ? (
        <span className="text-[10px] text-slate-400 truncate">{msg}</span>
      ) : (
        live.slice(0, 8).map((fx) => (
          <button
            key={fx.id}
            type="button"
            onClick={() => void openFixture(fx)}
            className={cn(
              "shrink-0 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-1.5 py-0.5 text-[10px] tabular-nums hover:border-teal-400"
            )}
            title="Open / create desk hint"
          >
            <span className="font-semibold">
              {fx.home.name.split(" ").slice(-1)[0]}
            </span>{" "}
            <span className="text-teal-700 dark:text-teal-300 font-bold">
              {fx.goals.home ?? "–"}–{fx.goals.away ?? "–"}
            </span>{" "}
            <span className="font-semibold">
              {fx.away.name.split(" ").slice(-1)[0]}
            </span>
            <span className="ml-1 text-slate-400">
              {fx.elapsed != null ? `${fx.elapsed}'` : fx.status}
            </span>
          </button>
        ))
      )}
    </div>
  );
}
