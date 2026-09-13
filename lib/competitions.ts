/** Priority competitions for Add Match Desk + fixture search. */

export type CompetitionOption = {
  id: string;
  name: string;
  country: string;
  /** Friendly on-air label (country top flight / UEFA round) */
  broadcastName: string;
  apiFootballLeagueId?: number;
  priority: number;
};

/** Persisted on User.addedCompetitions (JSON). */
export type UserAddedCompetition = {
  apiFootballLeagueId: number;
  name: string;
  country: string;
  broadcastName?: string;
  type?: string;
};

export const PRIORITY_COMPETITIONS: CompetitionOption[] = [
  {
    id: "ligue-1",
    name: "Ligue 1",
    country: "France",
    broadcastName: "French top flight",
    apiFootballLeagueId: 61,
    priority: 1,
  },
  {
    id: "scottish-prem",
    name: "Scottish Premiership",
    country: "Scotland",
    broadcastName: "Scottish top flight",
    apiFootballLeagueId: 179,
    priority: 2,
  },
  {
    id: "super-lig",
    name: "Süper Lig",
    country: "Turkey",
    broadcastName: "Turkish top flight",
    apiFootballLeagueId: 203,
    priority: 3,
  },
  {
    id: "premier-league",
    name: "Premier League",
    country: "England",
    broadcastName: "English top flight",
    apiFootballLeagueId: 39,
    priority: 4,
  },
  {
    id: "la-liga",
    name: "La Liga",
    country: "Spain",
    broadcastName: "Spanish top flight",
    apiFootballLeagueId: 140,
    priority: 5,
  },
  {
    id: "serie-a",
    name: "Serie A",
    country: "Italy",
    broadcastName: "Italian top flight",
    apiFootballLeagueId: 135,
    priority: 6,
  },
  {
    id: "bundesliga",
    name: "Bundesliga",
    country: "Germany",
    broadcastName: "German top flight",
    apiFootballLeagueId: 78,
    priority: 7,
  },
  {
    id: "ucl",
    name: "UEFA Champions League",
    country: "Europe",
    broadcastName: "Champions League",
    apiFootballLeagueId: 2,
    priority: 8,
  },
  {
    id: "uel",
    name: "UEFA Europa League",
    country: "Europe",
    broadcastName: "Europa League",
    apiFootballLeagueId: 3,
    priority: 9,
  },
  {
    id: "uecl",
    name: "UEFA Europa Conference League",
    country: "Europe",
    broadcastName: "Conference League",
    apiFootballLeagueId: 848,
    priority: 10,
  },
  {
    id: "mls",
    name: "Major League Soccer",
    country: "USA",
    broadcastName: "MLS",
    apiFootballLeagueId: 253,
    priority: 11,
  },
  {
    id: "eredivisie",
    name: "Eredivisie",
    country: "Netherlands",
    broadcastName: "Dutch top flight",
    apiFootballLeagueId: 88,
    priority: 12,
  },
  {
    id: "liga-portugal",
    name: "Primeira Liga",
    country: "Portugal",
    broadcastName: "Portuguese top flight",
    apiFootballLeagueId: 94,
    priority: 13,
  },
  {
    id: "brasileirao",
    name: "Brasileirão",
    country: "Brazil",
    broadcastName: "Brasileirão",
    apiFootballLeagueId: 71,
    priority: 14,
  },
  {
    id: "championship",
    name: "Championship",
    country: "England",
    broadcastName: "English Championship",
    apiFootballLeagueId: 40,
    priority: 15,
  },
  {
    id: "j1",
    name: "J1 League",
    country: "Japan",
    broadcastName: "J1 League",
    apiFootballLeagueId: 98,
    priority: 16,
  },
  {
    id: "demo-npl",
    name: "CoComms Demo League",
    country: "England",
    broadcastName: "CoComms Demo League",
    priority: 99,
  },
];

export function slugForCompetition(name: string, country: string, leagueId: number): string {
  const base = `${name}-${country}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `af-${leagueId}-${base || "league"}`;
}

export function userAddedToOption(c: UserAddedCompetition): CompetitionOption {
  return {
    id: slugForCompetition(c.name, c.country, c.apiFootballLeagueId),
    name: c.name,
    country: c.country,
    broadcastName: c.broadcastName || c.name,
    apiFootballLeagueId: c.apiFootballLeagueId,
    priority: 50,
  };
}

export function parseAddedCompetitions(raw: string | null | undefined): UserAddedCompetition[] {
  if (!raw || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: UserAddedCompetition[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const id = Number(r.apiFootballLeagueId);
      const name = typeof r.name === "string" ? r.name.trim() : "";
      const country = typeof r.country === "string" ? r.country.trim() : "";
      if (!Number.isFinite(id) || id <= 0 || !name) continue;
      out.push({
        apiFootballLeagueId: id,
        name,
        country: country || "Unknown",
        broadcastName:
          typeof r.broadcastName === "string" && r.broadcastName.trim()
            ? r.broadcastName.trim()
            : undefined,
        type: typeof r.type === "string" ? r.type : undefined,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export function serializeAddedCompetitions(list: UserAddedCompetition[]): string {
  return JSON.stringify(list);
}

export function mergeCompetitionOptions(
  added: UserAddedCompetition[] = []
): CompetitionOption[] {
  const priorityIds = new Set(
    PRIORITY_COMPETITIONS.map((c) => c.apiFootballLeagueId).filter(
      (id): id is number => typeof id === "number"
    )
  );
  const extras = added
    .filter((c) => !priorityIds.has(c.apiFootballLeagueId))
    .map(userAddedToOption);
  return [...PRIORITY_COMPETITIONS, ...extras];
}

export function findCompetition(
  q: string,
  extras: CompetitionOption[] | UserAddedCompetition[] = []
) {
  const needle = q.trim().toLowerCase();
  const extraOpts: CompetitionOption[] = extras.map((c) =>
    "id" in c && "priority" in c
      ? (c as CompetitionOption)
      : userAddedToOption(c as UserAddedCompetition)
  );
  const list = [...PRIORITY_COMPETITIONS, ...extraOpts];
  return list.find(
    (c) =>
      c.id === needle ||
      c.name.toLowerCase() === needle ||
      c.broadcastName.toLowerCase() === needle ||
      `${c.name} · ${c.country}`.toLowerCase() === needle
  );
}

export function broadcastLabelFor(competitionName: string): string {
  const found = findCompetition(competitionName);
  return found?.broadcastName || competitionName;
}

/** AF league id for a priority / known competition name, or null if unknown / free-text. */
export function leagueIdForCompetition(
  competitionName: string,
  extras: CompetitionOption[] | UserAddedCompetition[] = []
): number | null {
  const found = findCompetition(competitionName, extras);
  return found?.apiFootballLeagueId ?? null;
}

/** Prefer stored MatchDay AF league id, then name lookup. */
export function leagueIdForMatchDay(md: {
  competition: string;
  apiFootballLeagueId?: number | null;
}): number | null {
  if (
    typeof md.apiFootballLeagueId === "number" &&
    Number.isFinite(md.apiFootballLeagueId) &&
    md.apiFootballLeagueId > 0
  ) {
    return md.apiFootballLeagueId;
  }
  return leagueIdForCompetition(md.competition);
}
