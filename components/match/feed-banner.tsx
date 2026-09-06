"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCw, Link2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

function statusLabel(lineupStatus: string) {
  if (lineupStatus === "confirmed") return "Official";
  if (lineupStatus === "predicted") return "Your predicted XI";
  if (lineupStatus === "expected") return "Expected (last XI)";
  return lineupStatus;
}

export function FeedBanner({
  matchId,
  apiFootballFixtureId,
  lineupStatus,
  lastFeedSyncAt,
  status,
}: {
  matchId: string;
  apiFootballFixtureId: number | null;
  lineupStatus: string;
  lastFeedSyncAt: string | Date | null;
  status: string;
}) {
  const router = useRouter();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/integrations")
      .then((r) => r.json())
      .then((j) => setConfigured(Boolean(j.apiFootball)))
      .catch(() => setConfigured(false));
  }, []);

  // AF diet: Live/HT 45s, pre-match 90s; pause when tab hidden.
  useEffect(() => {
    if (!configured || !apiFootballFixtureId) return;
    if (status === "Full Time" || status === "Finished") return;
    const intervalMs =
      status === "Live" || status === "Half Time" ? 45_000 : 90_000;
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      void sync(true);
    };
    const t = setInterval(tick, intervalMs);
    const onVis = () => {
      if (document.visibilityState === "visible") void sync(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, apiFootballFixtureId, status]);

  async function sync(silent = false) {
    if (!apiFootballFixtureId) {
      setMsg("Link an API-Football fixture first.");
      return;
    }
    setBusy(true);
    if (!silent) setMsg(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: silent ? "live" : "full" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(json.error || "Sync failed");
      } else {
        const news = (json.newEvents || []) as { minute: number; description: string }[];
        if (news.length) {
          setFlash(`${news.length} new · ${news.slice(0, 2).map((e: {minute:number;description:string}) => `${e.minute}' ${e.description}`).join(" · ")}`);
          setTimeout(() => setFlash(null), 8000);
        }
        setMsg(
          silent
            ? null
            : `Synced · ${statusLabel(json.lineupStatus)} · ${json.eventCount} events`
        );
        router.refresh();
      }
    } catch {
      setMsg("Sync failed");
    } finally {
      setBusy(false);
    }
  }

  if (configured === null) return null;

  if (!configured) {
    return (
      <div className="rounded-xl border border-amber-300/70 bg-amber-50 dark:bg-amber-950/40 px-3 py-2.5 text-sm text-amber-900 dark:text-amber-100 flex gap-2 items-start">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <div className="font-semibold">API-Football key missing</div>
          <p className="text-xs opacity-90 mt-0.5">
            Set <code className="font-mono">API_FOOTBALL_KEY</code> in{" "}
            <code className="font-mono">.env</code> to sync squads, Expected /
            Official lineups, injuries and predictions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-teal-200 dark:border-teal-900 bg-teal-50/70 dark:bg-teal-950/30 px-3 py-2.5 text-sm flex flex-col sm:flex-row sm:items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-teal-900 dark:text-teal-100">
          Live feed · {statusLabel(lineupStatus)}
          {apiFootballFixtureId ? ` · fixture #${apiFootballFixtureId}` : " · not linked"}
        </div>
        <div className="text-xs text-teal-800/80 dark:text-teal-200/70">
          {lastFeedSyncAt
            ? `Last sync ${new Date(lastFeedSyncAt).toLocaleTimeString("en-GB", { timeZone: "Europe/London" })} PT`
            : "Not synced yet"}
          {msg ? ` · ${msg}` : ""}
          {flash ? ` · ⚡ ${flash}` : ""}
        </div>
      </div>
      <div className="flex gap-2">
        {!apiFootballFixtureId && (
          <Link
            href={`/match-day/${matchId}/prep`}
            className="inline-flex items-center gap-1 rounded-lg border border-teal-300 px-2.5 py-1.5 text-xs"
          >
            <Link2 className="h-3.5 w-3.5" /> Link fixture
          </Link>
        )}
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => sync(false)}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${busy ? "animate-spin" : ""}`} />
          Sync now
        </Button>
      </div>
    </div>
  );
}
