"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

export function LinkFixtureCard({
  matchId,
  currentFixtureId,
}: {
  matchId: string;
  currentFixtureId: number | null;
}) {
  const router = useRouter();
  const [fixtureId, setFixtureId] = useState(
    currentFixtureId ? String(currentFixtureId) : ""
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function link() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/link-fixture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixtureId: Number(fixtureId) }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(json.error || "Link failed");
        return;
      }
      setMsg(`Linked fixture #${fixtureId}`);
      const sync = await fetch(`/api/matches/${matchId}/sync`, { method: "POST" });
      const syncJson = await sync.json();
      if (!sync.ok) {
        setMsg(`Linked, but sync: ${syncJson.error || "failed (key missing?)"}`);
      } else {
        setMsg(`Linked + synced (${syncJson.lineupStatus})`);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>API-Football fixture</CardTitle>
      </CardHeader>
      <CardBody className="space-y-2">
        <p className="text-xs text-slate-500">
          Paste a fixture ID from API-Football (or import when creating a desk).
          Sync pulls lineups, goals, and subs onto the board.
        </p>
        <input
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-2 text-sm"
          placeholder="Fixture ID"
          value={fixtureId}
          onChange={(e) => setFixtureId(e.target.value)}
        />
        <Button size="sm" disabled={busy || !fixtureId} onClick={link}>
          {busy ? "Linking…" : "Link & sync"}
        </Button>
        {msg && <p className="text-xs text-slate-500">{msg}</p>}
      </CardBody>
    </Card>
  );
}
