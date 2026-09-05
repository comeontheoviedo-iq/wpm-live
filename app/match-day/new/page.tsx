"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PRIORITY_COMPETITIONS } from "@/lib/competitions";
import { todayDateInput } from "@/lib/season";

type Club = {
  id: string;
  name: string;
  shortName: string;
  badgeEmoji: string;
  apiFootballTeamId?: number | null;
};
type AfFixture = {
  fixture: { id: number; date: string };
  league: { id: number; name: string; season: number };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
};

const LIGUE_1_ID = 61;

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
  const [integrationsHint, setIntegrationsHint] = useState<string | null>(null);
  const [importDate, setImportDate] = useState(() => todayDateInput("Europe/London"));
  const [importLeagueId, setImportLeagueId] = useState<number | "">(LIGUE_1_ID);
  const [fixtures, setFixtures] = useState<AfFixture[]>([]);
  const [selectedFixture, setSelectedFixture] = useState<AfFixture | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusPending, setStatusPending] = useState(false);

  const effectiveCompetition = customCompetition.trim() || competition;

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((j) => {
        if (j.user) setUser({ name: j.user.name, avatarInitials: j.user.avatarInitials });
      });
    fetch("/api/integrations")
      .then((r) => r.json())
      .then((j) => {
        setAfConfigured(Boolean(j.apiFootball));
        if (j.hint) setIntegrationsHint(String(j.hint));
      });
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
      (c) =>
        c.apiFootballTeamId === afId ||
        c.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      // If found by name only, still POST so server can attach apiFootballTeamId
      if (existing.apiFootballTeamId === afId) return existing.id;
    }
    const res = await fetch("/api/clubs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        shortName: name.split(" ").slice(-1)[0],
        apiFootballTeamId: afId,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (json.club?.id) {
      setClubs((prev) => {
        if (prev.some((c) => c.id === json.club.id)) {
          return prev.map((c) => (c.id === json.club.id ? { ...c, ...json.club } : c));
        }
        return [...prev, json.club];
      });
      return json.club.id as string;
    }
    throw new Error(
      json.error || `Could not ensure club "${name}" (AF #${afId})`
    );
  }

  async function testConnection() {
    setStatusPending(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/football/status");
      const json = await res.json();
      setAfConfigured(Boolean(json.configured));
      setStatusMsg(json.message || (json.ok ? "Connection OK" : "Connection failed"));
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : "Connection test failed");
    } finally {
      setStatusPending(false);
    }
  }

  async function searchFixtures() {
    setImportMsg(null);
    if (!importDate) {
      setImportMsg("Pick a date");
      return;
    }
    // Pass league so server never returns Super Liga / Czech fixtures for Süper Lig.
    const params = new URLSearchParams({ date: importDate });
    if (importLeagueId) params.set("league", String(importLeagueId));
    const home = clubs.find((c) => c.id === homeClubId);
    const away = clubs.find((c) => c.id === awayClubId);
    if (home?.apiFootballTeamId && away?.apiFootballTeamId) {
      params.set("homeTeam", String(home.apiFootballTeamId));
      params.set("awayTeam", String(away.apiFootballTeamId));
    }
    const res = await fetch(`/api/football/fixtures?${params}`);
    const json = await res.json();
    if (!json.configured) {
      setImportMsg(json.message || json.error || "API key missing");
      setFixtures([]);
      return;
    }
    let list: AfFixture[] = json.fixtures || [];
    // Defence in depth — never show another league when one is selected
    if (importLeagueId) {
      list = list.filter((fx) => fx.league?.id === importLeagueId);
    }
    if (home?.apiFootballTeamId && away?.apiFootballTeamId) {
      list = list.filter(
        (fx) =>
          fx.teams.home.id === home.apiFootballTeamId &&
          fx.teams.away.id === away.apiFootballTeamId
      );
    }
    setFixtures(list);
    if (json.planSeasonBlocked || json.code === "plan_season") {
      setImportMsg(
        json.message ||
          json.error ||
          "Free plan cannot access this season — upgrade to Pro for current league+season, or search by date only."
      );
      return;
    }
    if (!list.length) {
      const base =
        json.message ||
        json.error ||
        "No fixtures found — check key / date (Free plan: date-only works; current seasons need Pro).";
      setImportMsg(
        importLeagueId
          ? `${base} (no matches for selected league after date-wide search)`
          : base
      );
    } else if (json.message) {
      setImportMsg(json.message);
    } else if (importLeagueId) {
      setImportMsg(
        `Showing ${list.length} fixture(s) for selected league (date-only search).`
      );
    } else {
      setImportMsg(null);
    }
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

  function parseKickoffLocal(value: string): Date | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // datetime-local is typically YYYY-MM-DDTHH:mm (optionally with :ss)
    let normalized = trimmed;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
      normalized = `${trimmed}:00`;
    }
    const d = new Date(normalized);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  async function createDesk() {
    setError(null);
    if (!homeClubId || !awayClubId) {
      setError("Select home and away teams");
      return;
    }
    if (homeClubId === awayClubId) {
      setError("Home and away teams must differ");
      return;
    }
    if (!kickoff) {
      setError("Pick a kick-off time");
      return;
    }
    const kickoffDate = parseKickoffLocal(kickoff);
    if (!kickoffDate) {
      setError("Invalid kick-off date/time — use the date picker or YYYY-MM-DDTHH:mm");
      return;
    }

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
          kickoff: kickoffDate.toISOString(),
          apiFootballFixtureId: (() => {
            if (!selectedFixture) return undefined;
            const expectedLeague = PRIORITY_COMPETITIONS.find(
              (c) => c.name === effectiveCompetition
            )?.apiFootballLeagueId;
            if (
              expectedLeague &&
              selectedFixture.league?.id &&
              selectedFixture.league.id !== expectedLeague
            ) {
              return undefined; // never attach wrong-league fixture
            }
            const home = clubs.find((c) => c.id === homeClubId);
            const away = clubs.find((c) => c.id === awayClubId);
            if (
              home?.apiFootballTeamId &&
              away?.apiFootballTeamId &&
              (selectedFixture.teams.home.id !== home.apiFootballTeamId ||
                selectedFixture.teams.away.id !== away.apiFootballTeamId)
            ) {
              return undefined;
            }
            return selectedFixture.fixture.id;
          })(),
          homeApiFootballTeamId:
            selectedFixture?.teams.home.id ??
            clubs.find((c) => c.id === homeClubId)?.apiFootballTeamId,
          awayApiFootballTeamId:
            selectedFixture?.teams.away.id ??
            clubs.find((c) => c.id === awayClubId)?.apiFootballTeamId,
          homeTeamName: selectedFixture?.teams.home.name,
          awayTeamName: selectedFixture?.teams.away.name,
          featured: true,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const raw = typeof json.error === "string" ? json.error : "";
        const short =
          raw && raw.length < 180 && !raw.includes("Invalid `")
            ? raw
            : "Could not create match desk. Please try again.";
        setError(short);
        return;
      }
      if (!json.match?.id) {
        setError(
          json.error ||
            `Create succeeded without match id: ${JSON.stringify(json)}`
        );
        return;
      }
      router.push(`/match-day/${json.match.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
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

        <Card>
          <CardHeader>
            <CardTitle>Import from API-Football</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={
                  afConfigured
                    ? "rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 px-2 py-0.5 font-medium"
                    : "rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100 px-2 py-0.5 font-medium"
                }
              >
                {afConfigured ? "API-Football configured" : "API-Football not configured"}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={statusPending}
                onClick={testConnection}
              >
                {statusPending ? "Testing…" : "Test connection"}
              </Button>
            </div>
            {statusMsg && (
              <p className="text-xs text-slate-600 dark:text-slate-300">{statusMsg}</p>
            )}
            {integrationsHint && !afConfigured && (
              <p className="text-xs text-amber-700 dark:text-amber-300">{integrationsHint}</p>
            )}
            {!afConfigured && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
                Set <code className="font-mono">API_FOOTBALL_KEY</code> in .env /
                .env.local and restart the Next.js server. You can still create a
                desk manually below.
              </div>
            )}
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
                    {fx.league.name} ·{" "}
                    {new Date(fx.fixture.date).toLocaleString("en-GB", {
                      timeZone: "Europe/London",
                    })}{" "}
                    · #{fx.fixture.id}
                  </div>
                </button>
              ))}
            </div>
          </CardBody>
        </Card>

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
                onChange={(e) => {
                  const name = e.target.value;
                  setCompetition(name);
                  const leagueId = PRIORITY_COMPETITIONS.find((c) => c.name === name)
                    ?.apiFootballLeagueId;
                  if (leagueId) setImportLeagueId(leagueId);
                  // Manual competition change invalidates a previously imported fixture
                  setSelectedFixture(null);
                }}
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
                  onChange={(e) => {
                    setHomeClubId(e.target.value);
                    setSelectedFixture(null);
                  }}
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
                  onChange={(e) => {
                    setAwayClubId(e.target.value);
                    setSelectedFixture(null);
                  }}
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
            {error && <p className="text-sm text-rose-600">{error}</p>}
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
