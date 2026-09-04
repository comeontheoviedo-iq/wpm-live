"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PRIORITY_COMPETITIONS } from "@/lib/competitions";

type Club = { id: string; name: string; shortName: string; badgeEmoji: string };
type AfFixture = {
  fixture: { id: number; date: string };
  league: { id: number; name: string; season: number };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
};

export default function NewMatchDayPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; avatarInitials: string }>({
    name: "Commentator",
    avatarInitials: "PL",
  });
  const [competition, setCompetition] = useState(PRIORITY_COMPETITIONS[0].name);
  const [customCompetition, setCustomCompetition] = useState("");
  const [clubs, setClubs] = useState<Club[]>([]);
  const [homeClubId, setHomeClubId] = useState("");
  const [awayClubId, setAwayClubId] = useState("");
  const [clubQuery, setClubQuery] = useState("");
  const [kickoff, setKickoff] = useState("");
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [afConfigured, setAfConfigured] = useState(false);
  const [importDate, setImportDate] = useState("");
  const [importLeagueId, setImportLeagueId] = useState<number | "">("");
  const [fixtures, setFixtures] = useState<AfFixture[]>([]);
  const [selectedFixture, setSelectedFixture] = useState<AfFixture | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const effectiveCompetition = customCompetition.trim() || competition;

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((j) => {
        if (j.user) setUser({ name: j.user.name, avatarInitials: j.user.avatarInitials });
      });
    fetch("/api/integrations")
      .then((r) => r.json())
      .then((j) => setAfConfigured(Boolean(j.apiFootball)));
    loadClubs("");
  }, []);

  async function loadClubs(q: string) {
    const res = await fetch(`/api/clubs?q=${encodeURIComponent(q)}`);
    const json = await res.json();
    setClubs(json.clubs || []);
  }

  const filteredClubs = useMemo(() => {
    if (!clubQuery.trim()) return clubs;
    const q = clubQuery.toLowerCase();
    return clubs.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.shortName.toLowerCase().includes(q)
    );
  }, [clubs, clubQuery]);

  async function ensureClubFromAf(name: string, afId: number) {
    const existing = clubs.find(
      (c) => c.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) return existing.id;
    const res = await fetch("/api/clubs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        shortName: name.split(" ").slice(-1)[0],
        apiFootballTeamId: afId,
      }),
    });
    const json = await res.json();
    if (json.club) {
      setClubs((prev) => [...prev, json.club]);
      return json.club.id as string;
    }
    throw new Error("Could not create club");
  }

  async function searchFixtures() {
    setImportMsg(null);
    if (!importDate) {
      setImportMsg("Pick a date");
      return;
    }
    const params = new URLSearchParams({ date: importDate });
    if (importLeagueId) params.set("league", String(importLeagueId));
    const leagueMeta = PRIORITY_COMPETITIONS.find(
      (c) => c.apiFootballLeagueId === importLeagueId
    );
    if (importLeagueId) {
      params.set("season", String(new Date(importDate).getFullYear()));
    }
    void leagueMeta;
    const res = await fetch(`/api/football/fixtures?${params}`);
    const json = await res.json();
    if (!json.configured) {
      setImportMsg(json.message || "API key missing");
      setFixtures([]);
      return;
    }
    setFixtures(json.fixtures || []);
    if (!(json.fixtures || []).length) setImportMsg("No fixtures found");
  }

  async function applyFixture(fx: AfFixture) {
    setSelectedFixture(fx);
    setCompetition(fx.league.name);
    setCustomCompetition("");
    setKickoff(fx.fixture.date.slice(0, 16));
    try {
      const homeId = await ensureClubFromAf(fx.teams.home.name, fx.teams.home.id);
      const awayId = await ensureClubFromAf(fx.teams.away.name, fx.teams.away.id);
      setHomeClubId(homeId);
      setAwayClubId(awayId);
      setTitle(`${fx.teams.home.name} vs ${fx.teams.away.name}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    }
  }

  async function createDesk() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/match-days", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || undefined,
          competition: effectiveCompetition,
          homeClubId,
          awayClubId,
          kickoff: new Date(kickoff).toISOString(),
          apiFootballFixtureId: selectedFixture?.fixture.id,
          featured: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Create failed");
        return;
      }
      router.push(`/match-day/${json.match.id}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen">
      <AppHeader user={user} />
      <main className="mx-auto max-w-3xl px-3 sm:px-4 py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Add Match Desk</h1>
          <p className="text-sm text-slate-500">
            Create a match desk with default checklist and script slots.
          </p>
        </div>

        {afConfigured && (
          <Card>
            <CardHeader>
              <CardTitle>Import from API-Football</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="grid sm:grid-cols-3 gap-2">
                <input
                  type="date"
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-2 text-sm"
                  value={importDate}
                  onChange={(e) => setImportDate(e.target.value)}
                />
                <select
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-2 text-sm"
                  value={importLeagueId}
                  onChange={(e) =>
                    setImportLeagueId(e.target.value ? Number(e.target.value) : "")
                  }
                >
                  <option value="">Any / all leagues</option>
                  {PRIORITY_COMPETITIONS.filter((c) => c.apiFootballLeagueId).map(
                    (c) => (
                      <option key={c.id} value={c.apiFootballLeagueId}>
                        {c.name}
                      </option>
                    )
                  )}
                </select>
                <Button type="button" onClick={searchFixtures}>
                  Search fixtures
                </Button>
              </div>
              {importMsg && (
                <p className="text-xs text-amber-700 dark:text-amber-300">{importMsg}</p>
              )}
              <div className="max-h-48 overflow-y-auto space-y-1">
                {fixtures.map((fx) => (
                  <button
                    key={fx.fixture.id}
                    type="button"
                    onClick={() => applyFixture(fx)}
                    className="w-full text-left rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2 text-sm hover:border-teal-400"
                  >
                    <div className="font-medium">
                      {fx.teams.home.name} vs {fx.teams.away.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {fx.league.name} · {new Date(fx.fixture.date).toLocaleString("en-GB", { timeZone: "Europe/London" })} · #{fx.fixture.id}
                    </div>
                  </button>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        {!afConfigured && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
            API-Football import unavailable — set <code className="font-mono">API_FOOTBALL_KEY</code> in .env. You can still create a desk manually.
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Match details</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <label className="block text-xs font-medium text-slate-500">
              Competition (priority list)
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-2 text-sm"
                value={competition}
                onChange={(e) => setCompetition(e.target.value)}
              >
                {PRIORITY_COMPETITIONS.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name} · {c.country}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Or free-text competition
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-2 text-sm"
                placeholder="Search any competition on demand"
                value={customCompetition}
                onChange={(e) => setCustomCompetition(e.target.value)}
              />
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Filter clubs
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-2 text-sm"
                value={clubQuery}
                onChange={(e) => {
                  setClubQuery(e.target.value);
                  loadClubs(e.target.value);
                }}
                placeholder="Search teams"
              />
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-slate-500">
                Home team
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-2 text-sm"
                  value={homeClubId}
                  onChange={(e) => setHomeClubId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {filteredClubs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.badgeEmoji} {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-500">
                Away team
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-2 text-sm"
                  value={awayClubId}
                  onChange={(e) => setAwayClubId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {filteredClubs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.badgeEmoji} {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-xs font-medium text-slate-500">
              Kick-off
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-2 text-sm"
                value={kickoff}
                onChange={(e) => setKickoff(e.target.value)}
              />
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Desk title (optional)
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-2 text-sm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            {error && (
              <p className="text-sm text-rose-600">{error}</p>
            )}
            <Button
              disabled={pending || !homeClubId || !awayClubId || !kickoff}
              onClick={createDesk}
            >
              {pending ? "Creating…" : "Create match desk"}
            </Button>
          </CardBody>
        </Card>
      </main>
    </div>
  );
}
