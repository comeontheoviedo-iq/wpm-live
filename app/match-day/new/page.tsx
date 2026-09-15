"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PRIORITY_COMPETITIONS, type CompetitionOption } from "@/lib/competitions";
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
    home: { id: number; name: string; logo?: string };
    away: { id: number; name: string; logo?: string };
  };
};

type AfTeamHit = {
  team: {
    id: number;
    name: string;
    country?: string;
    logo?: string;
    national?: boolean;
  };
};

type LeagueSearchHit = {
  id: number;
  apiFootballLeagueId: number;
  name: string;
  country: string;
  type: string | null;
  season: number | null;
};

const LIGUE_1_ID = 61;

export default function NewMatchDayPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; avatarInitials: string; image?: string | null }>({
    name: "Commentator",
    avatarInitials: "PL",
    image: null,
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
  const [pickerCompetitions, setPickerCompetitions] =
    useState<CompetitionOption[]>(PRIORITY_COMPETITIONS);
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(
    PRIORITY_COMPETITIONS[0].apiFootballLeagueId ?? null
  );
  const [findQuery, setFindQuery] = useState("");
  const [findResults, setFindResults] = useState<LeagueSearchHit[]>([]);
  const [findPending, setFindPending] = useState(false);
  const [findMsg, setFindMsg] = useState<string | null>(null);
  const [addPendingId, setAddPendingId] = useState<number | null>(null);

  // Find-by-team typeahead
  const [teamQuery, setTeamQuery] = useState("");
  const [teamHits, setTeamHits] = useState<AfTeamHit[]>([]);
  const [teamSuggestOpen, setTeamSuggestOpen] = useState(false);
  const [teamSearchPending, setTeamSearchPending] = useState(false);
  const [teamUpcomingPending, setTeamUpcomingPending] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<AfTeamHit["team"] | null>(null);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const teamSearchSeq = useRef(0);
  const teamBoxRef = useRef<HTMLDivElement | null>(null);

  const effectiveCompetition = customCompetition.trim() || competition;

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((j) => {
        if (j.user) setUser({ name: j.user.name, avatarInitials: j.user.avatarInitials, image: j.user.image ?? null });
      });
    fetch("/api/integrations")
      .then((r) => r.json())
      .then((j) => {
        setAfConfigured(Boolean(j.apiFootball));
        if (j.hint) setIntegrationsHint(String(j.hint));
      });
    loadClubs("");
    loadPickerCompetitions();
  }, []);

  async function loadPickerCompetitions() {
    try {
      const res = await fetch("/api/competitions");
      const json = await res.json();
      if (Array.isArray(json.competitions) && json.competitions.length) {
        setPickerCompetitions(json.competitions);
      }
    } catch {
      /* keep PRIORITY fallback */
    }
  }

  async function searchLeagues() {
    setFindMsg(null);
    const q = findQuery.trim();
    if (q.length < 2) {
      setFindMsg("Type at least 2 characters");
      return;
    }
    setFindPending(true);
    try {
      const res = await fetch(`/api/football/leagues?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      const list: LeagueSearchHit[] = json.leagues || [];
      setFindResults(list);
      if (!json.configured) {
        setFindMsg(json.message || "Live feed not configured — showing priority matches only");
      } else if (json.message && !list.length) {
        setFindMsg(json.message);
      } else if (!list.length) {
        setFindMsg("No leagues found");
      } else {
        setFindMsg(null);
      }
    } catch (e) {
      setFindMsg(e instanceof Error ? e.message : "Search failed");
      setFindResults([]);
    } finally {
      setFindPending(false);
    }
  }

  async function addCompetitionFromSearch(hit: LeagueSearchHit) {
    setAddPendingId(hit.apiFootballLeagueId || hit.id);
    setFindMsg(null);
    try {
      const res = await fetch("/api/competitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiFootballLeagueId: hit.apiFootballLeagueId || hit.id,
          name: hit.name,
          country: hit.country,
          type: hit.type || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFindMsg(json.error || "Could not add competition");
        return;
      }
      const opt: CompetitionOption = json.competition;
      setPickerCompetitions((prev) => {
        if (prev.some((c) => c.apiFootballLeagueId === opt.apiFootballLeagueId)) {
          return prev.map((c) =>
            c.apiFootballLeagueId === opt.apiFootballLeagueId ? { ...c, ...opt } : c
          );
        }
        return [...prev, opt];
      });
      setCompetition(opt.name);
      setCustomCompetition("");
      if (opt.apiFootballLeagueId) {
        setSelectedLeagueId(opt.apiFootballLeagueId);
        setImportLeagueId(opt.apiFootballLeagueId);
      }
      setSelectedFixture(null);
      setFindMsg(
        json.alreadyPriority
          ? `“${opt.name}” is already in the priority list — selected.`
          : `Added “${opt.name}” · ${opt.country} for your account.`
      );
      setFindResults([]);
      setFindQuery("");
    } catch (e) {
      setFindMsg(e instanceof Error ? e.message : "Add failed");
    } finally {
      setAddPendingId(null);
    }
  }

  async function loadClubs(q: string) {
    const res = await fetch(`/api/clubs?q=${encodeURIComponent(q)}`);
    const json = await res.json();
    setClubs(json.clubs || []);
  }

  // Debounced team typeahead (≈280ms, min 2 chars)
  useEffect(() => {
    const q = teamQuery.trim();
    if (q.length < 2) {
      setTeamHits([]);
      setTeamSearchPending(false);
      setHighlightIdx(0);
      return;
    }
    const seq = ++teamSearchSeq.current;
    setTeamSearchPending(true);
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/football/teams?q=${encodeURIComponent(q)}&limit=12`
        );
        const json = await res.json();
        if (seq !== teamSearchSeq.current) return;
        const list: AfTeamHit[] = Array.isArray(json.teams) ? json.teams : [];
        setTeamHits(list);
        setHighlightIdx(0);
        setTeamSuggestOpen(true);
        if (!json.configured && json.message) {
          setImportMsg(json.message);
        }
      } catch (e) {
        if (seq !== teamSearchSeq.current) return;
        setTeamHits([]);
        setImportMsg(e instanceof Error ? e.message : "Team search failed");
      } finally {
        if (seq === teamSearchSeq.current) setTeamSearchPending(false);
      }
    }, 280);
    return () => window.clearTimeout(t);
  }, [teamQuery]);

  // Close suggestions on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!teamBoxRef.current) return;
      if (!teamBoxRef.current.contains(e.target as Node)) {
        setTeamSuggestOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const loadUpcomingForTeam = useCallback(async (team: AfTeamHit["team"]) => {
    setImportMsg(null);
    setTeamUpcomingPending(true);
    setSelectedFixture(null);
    // Team mode: league filter optional — clear so we don't hide cross-competition fixtures
    setImportLeagueId("");
    try {
      const params = new URLSearchParams({
        team: String(team.id),
        next: "10",
      });
      const res = await fetch(`/api/football/fixtures?${params}`);
      const json = await res.json();
      if (!json.configured) {
        setImportMsg(json.message || json.error || "API key missing");
        setFixtures([]);
        return;
      }
      const list: AfFixture[] = json.fixtures || [];
      setFixtures(list);
      if (!list.length) {
        setImportMsg(
          json.message ||
            json.error ||
            `No upcoming fixtures for ${team.name}.`
        );
      } else {
        setImportMsg(
          `Upcoming for ${team.name}${team.country ? ` · ${team.country}` : ""} — ${list.length} fixture(s). Click one to fill the desk.`
        );
      }
    } catch (e) {
      setFixtures([]);
      setImportMsg(e instanceof Error ? e.message : "Upcoming fixtures failed");
    } finally {
      setTeamUpcomingPending(false);
    }
  }, []);

  async function selectTeamHit(hit: AfTeamHit) {
    setSelectedTeam(hit.team);
    setTeamQuery(hit.team.name);
    setTeamHits([]);
    setTeamSuggestOpen(false);
    await loadUpcomingForTeam(hit.team);
  }

  function onTeamQueryKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      setTeamSuggestOpen(false);
      return;
    }
    if (!teamSuggestOpen || teamHits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, teamHits.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const hit = teamHits[highlightIdx] || teamHits[0];
      if (hit) void selectTeamHit(hit);
    }
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
    if (fx.league?.id) {
      setSelectedLeagueId(fx.league.id);
      setImportLeagueId(fx.league.id);
    }
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
          apiFootballLeagueId: (() => {
            if (selectedFixture?.league?.id) return selectedFixture.league.id;
            if (selectedLeagueId) return selectedLeagueId;
            const fromPicker = pickerCompetitions.find(
              (c) => c.name === effectiveCompetition
            )?.apiFootballLeagueId;
            return fromPicker || undefined;
          })(),
          homeClubId,
          awayClubId,
          kickoff: kickoffDate.toISOString(),
          apiFootballFixtureId: (() => {
            if (!selectedFixture) return undefined;
            const expectedLeague =
              selectedLeagueId ||
              pickerCompetitions.find((c) => c.name === effectiveCompetition)
                ?.apiFootballLeagueId ||
              PRIORITY_COMPETITIONS.find((c) => c.name === effectiveCompetition)
                ?.apiFootballLeagueId;
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
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <AppHeader user={user} />
      <div className="flex min-h-0 w-full items-stretch">
        <AppSidebar />
        <main className="min-w-0 flex-1 px-2 py-2 sm:px-3 sm:py-3">
        <div className="mx-auto max-w-3xl space-y-3">
        <div className="desk-header p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Hub · New desk</p>
          <h1 className="mt-1 text-base font-bold tracking-tight sm:text-lg">Add Match Desk</h1>
          <p className="mt-0.5 text-[11px] text-[var(--muted)]">
            Create a match desk with default checklist and script slots.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Import from live feed</CardTitle>
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
                {afConfigured ? "Live feed configured" : "Live feed not configured"}
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
                Set the live-feed key in .env / .env.local and restart the Next.js
                server. You can still create a desk manually below.
              </div>
            )}
            <div ref={teamBoxRef} className="relative space-y-1">
              <label className="block text-xs font-medium text-slate-500">
                Find by team
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-2 text-sm"
                  placeholder="Type a club or country (e.g. Arsenal, England)…"
                  value={teamQuery}
                  onChange={(e) => {
                    setTeamQuery(e.target.value);
                    setSelectedTeam(null);
                    setTeamSuggestOpen(true);
                  }}
                  onFocus={() => {
                    if (teamHits.length) setTeamSuggestOpen(true);
                  }}
                  onKeyDown={onTeamQueryKeyDown}
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={teamSuggestOpen && teamHits.length > 0}
                  aria-autocomplete="list"
                />
              </label>
              {teamSearchPending && (
                <p className="text-[11px] text-slate-500">Searching teams…</p>
              )}
              {teamSuggestOpen && teamHits.length > 0 && (
                <ul
                  className="absolute z-20 mt-0.5 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-[var(--background)] shadow-lg dark:border-slate-700"
                  role="listbox"
                >
                  {teamHits.map((hit, idx) => (
                    <li key={hit.team.id} role="option" aria-selected={idx === highlightIdx}>
                      <button
                        type="button"
                        className={
                          "flex w-full items-center gap-2 px-3 py-2 text-left text-sm " +
                          (idx === highlightIdx
                            ? "bg-amber-50 dark:bg-amber-950/40"
                            : "hover:bg-amber-50/70 dark:hover:bg-amber-950/30")
                        }
                        onMouseEnter={() => setHighlightIdx(idx)}
                        onClick={() => void selectTeamHit(hit)}
                      >
                        {hit.team.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={hit.team.logo}
                            alt=""
                            className="h-5 w-5 shrink-0 object-contain"
                          />
                        ) : (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] dark:bg-slate-800">
                            ?
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {hit.team.name}
                          </span>
                          <span className="block truncate text-[11px] text-slate-500">
                            {hit.team.country || "—"}
                            {hit.team.national ? " · National" : " · Club"}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {(selectedTeam || teamUpcomingPending) && (
                <p className="text-[11px] text-slate-500">
                  {teamUpcomingPending
                    ? `Loading upcoming for ${selectedTeam?.name || teamQuery}…`
                    : selectedTeam
                      ? `Upcoming for ${selectedTeam.name}`
                      : null}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
              <span>or search by date</span>
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            </div>

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
                {pickerCompetitions.filter((c) => c.apiFootballLeagueId).map(
                  (c) => (
                    <option key={c.id} value={c.apiFootballLeagueId}>
                      {c.name} · {c.country}
                    </option>
                  )
                )}
              </select>
              <Button
                type="button"
                onClick={() => {
                  setSelectedTeam(null);
                  void searchFixtures();
                }}
              >
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
                  className="w-full text-left rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2 text-sm hover:border-amber-400"
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
              Competition (priority + your added)
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-2 text-sm"
                value={competition}
                onChange={(e) => {
                  const name = e.target.value;
                  setCompetition(name);
                  setCustomCompetition("");
                  const leagueId = pickerCompetitions.find((c) => c.name === name)
                    ?.apiFootballLeagueId;
                  if (leagueId) {
                    setSelectedLeagueId(leagueId);
                    setImportLeagueId(leagueId);
                  } else {
                    setSelectedLeagueId(null);
                  }
                  // Manual competition change invalidates a previously imported fixture
                  setSelectedFixture(null);
                }}
              >
                {pickerCompetitions.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name} · {c.country}
                    {c.priority === 50 ? " (added)" : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
              <p className="text-xs font-medium text-slate-500">
                Find a competition
              </p>
              <p className="text-[11px] text-slate-500">
                Search API-Football leagues (e.g. MLS, J1, Brasileirão) and add them for your account — quota-friendly, no full dump.
              </p>
              <div className="flex flex-wrap gap-2">
                <input
                  className="min-w-[12rem] flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-2 text-sm"
                  placeholder="League name or country…"
                  value={findQuery}
                  onChange={(e) => setFindQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      searchLeagues();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={findPending}
                  onClick={searchLeagues}
                >
                  {findPending ? "Searching…" : "Search"}
                </Button>
              </div>
              {findMsg && (
                <p className="text-xs text-amber-700 dark:text-amber-300">{findMsg}</p>
              )}
              {findResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {findResults.map((hit) => {
                    const lid = hit.apiFootballLeagueId || hit.id;
                    const already = pickerCompetitions.some(
                      (c) => c.apiFootballLeagueId === lid
                    );
                    return (
                      <div
                        key={`${lid}-${hit.country}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {hit.name}
                            {hit.type ? (
                              <span className="ml-1 text-[10px] font-normal text-slate-500">
                                {hit.type}
                              </span>
                            ) : null}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {hit.country}
                            {hit.season ? ` · ${hit.season}` : ""} · AF #{lid}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={addPendingId === lid}
                          onClick={() =>
                            already
                              ? (() => {
                                  setCompetition(hit.name);
                                  setCustomCompetition("");
                                  setSelectedLeagueId(lid);
                                  setImportLeagueId(lid);
                                  setSelectedFixture(null);
                                  setFindMsg(`Selected “${hit.name}”.`);
                                  setFindResults([]);
                                  setFindQuery("");
                                })()
                              : addCompetitionFromSearch(hit)
                          }
                        >
                          {addPendingId === lid
                            ? "Adding…"
                            : already
                              ? "Select"
                              : "Add"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <label className="block text-xs font-medium text-slate-500">
              Or free-text competition
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-2 text-sm"
                placeholder="Custom label (no live-feed league id)"
                value={customCompetition}
                onChange={(e) => {
                  setCustomCompetition(e.target.value);
                  setSelectedLeagueId(null);
                }}
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
        </div>
      </main>
      </div>
    </div>
  );
}
