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
    id: "demo-npl",
    name: "Northern Premier Demo League",
    country: "England",
    broadcastName: "Northern Premier Demo League",
    priority: 99,
  },
];

export function findCompetition(q: string) {
  const needle = q.trim().toLowerCase();
  return PRIORITY_COMPETITIONS.find(
    (c) =>
      c.id === needle ||
      c.name.toLowerCase() === needle ||
      c.broadcastName.toLowerCase() === needle
  );
}

export function broadcastLabelFor(competitionName: string): string {
  const found = PRIORITY_COMPETITIONS.find(
    (c) =>
      c.name.toLowerCase() === competitionName.toLowerCase() ||
      c.id === competitionName.toLowerCase()
  );
  return found?.broadcastName || competitionName;
}
