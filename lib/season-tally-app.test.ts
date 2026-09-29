import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateClubSeasonTotals,
  aggregateForIngest,
  liveAdjustedSeasonStat,
  matchHasStarted,
  isInternationalCompetition,
  isNationalTeamCareerStint,
  aggregateTeamSeasonTotals,
  aggregateInternationalCareerTotals,
  looksLikeClubTeamName,
} from "./season-tally";

type Stat = Parameters<typeof aggregateClubSeasonTotals>[0];

function row(
  teamId: number,
  teamName: string,
  leagueId: number,
  leagueName: string,
  apps: number,
  goals = 0,
  assists = 0
) {
  return {
    team: { id: teamId, name: teamName },
    league: { id: leagueId, name: leagueName, season: 2026 },
    games: { appearences: apps },
    goals: { total: goals, assists },
  };
}

describe("matchHasStarted", () => {
  it("is false for prematch desk statuses", () => {
    assert.equal(matchHasStarted("Assigned"), false);
    assert.equal(matchHasStarted("Scheduled"), false);
    assert.equal(matchHasStarted("NS"), false);
    assert.equal(matchHasStarted("Not Started"), false);
  });
  it("is true once live or finished", () => {
    assert.equal(matchHasStarted("Live"), true);
    assert.equal(matchHasStarted("1H"), true);
    assert.equal(matchHasStarted("Half Time"), true);
    assert.equal(matchHasStarted("Full Time"), true);
    assert.equal(matchHasStarted("FT"), true);
  });
});

describe("aggregateClubSeasonTotals — no prior-club dump", () => {
  it("sums Galatasaray comps only (excludes Portugal NT + friendlies)", () => {
    const stats = [
      row(27, "Portugal", 1, "World Cup", 5, 1, 1),
      row(27, "Portugal", 10, "Friendlies", 1, 0, 0),
      row(645, "Galatasaray", 2, "UEFA Champions League", 1, 0, 0),
      row(645, "Galatasaray", 203, "Süper Lig", 1, 0, 0),
    ] as Stat;
    const t = aggregateClubSeasonTotals(stats, 645);
    assert.equal(t.apps, 2);
    assert.equal(t.goals, 0);
    assert.equal(t.rowCount, 2);
  });

  it("returns zeros when teamAfId has no rows — never Milan fallback", () => {
    // Leão 2025 Milan season shape — must NOT become Galatasaray APP
    const milan2025 = [
      row(489, "AC Milan", 135, "Serie A", 29, 10, 8),
      row(489, "AC Milan", 137, "Coppa Italia", 1, 0, 0),
    ] as Stat;
    const t = aggregateClubSeasonTotals(milan2025, 645);
    assert.equal(t.apps, 0);
    assert.equal(t.rowCount, 0);
    assert.equal(t.apps, 0);
  });

  it("aggregateForIngest allApps matches club season apps", () => {
    const stats = [
      row(27, "Portugal", 1, "World Cup", 5),
      row(645, "Galatasaray", 2, "UEFA Champions League", 1),
      row(645, "Galatasaray", 203, "Süper Lig", 1),
    ] as Stat;
    const agg = aggregateForIngest(stats, 203, 645);
    assert.equal(agg.leagueApps, 1);
    assert.equal(agg.allApps, 2);
  });
});

describe("liveAdjustedSeasonStat APP contract", () => {
  it("prematch: Official XI must not +1 (inMatchCount 0)", () => {
    assert.equal(liveAdjustedSeasonStat(2, 0, "Assigned", { forceExcludeToday: true }), 2);
  });
  it("live on pitch: AF snapshot + 1", () => {
    assert.equal(liveAdjustedSeasonStat(2, 1, "Live", { forceExcludeToday: true }), 3);
  });
  it("FT trusts AF snapshot when it includes today", () => {
    assert.equal(liveAdjustedSeasonStat(3, 1, "Full Time", { forceExcludeToday: true }), 3);
  });
});


describe("isInternationalCompetition", () => {
  it("detects Nations League / World Cup / Euro / NT friendlies", () => {
    assert.equal(
      isInternationalCompetition({ name: "UEFA Nations League", country: "World" }),
      true
    );
    assert.equal(
      isInternationalCompetition({ name: "World Cup - Qualification Europe", country: "World" }),
      true
    );
    assert.equal(
      isInternationalCompetition({ name: "Euro Championship", country: "World" }),
      true
    );
    assert.equal(
      isInternationalCompetition({ name: "Friendlies", country: "World" }),
      true
    );
    assert.equal(
      isInternationalCompetition({ name: "Africa Cup of Nations", country: "World" }),
      true
    );
  });

  it("does not treat club desks / UCL / club friendlies as international", () => {
    assert.equal(
      isInternationalCompetition({ name: "Premier League", country: "England" }),
      false
    );
    assert.equal(
      isInternationalCompetition({ name: "UEFA Champions League", country: "World" }),
      false
    );
    assert.equal(
      isInternationalCompetition({ name: "UEFA Europa League", country: "World" }),
      false
    );
    assert.equal(
      isInternationalCompetition({ name: "Friendlies Clubs", country: "World" }),
      false
    );
    assert.equal(
      isInternationalCompetition({ name: "Ligue 1", country: "France" }),
      false
    );
  });
});

describe("international caps aggregation (incl. friendlies)", () => {
  it("aggregateTeamSeasonTotals includes friendlies when opted in", () => {
    const stats = [
      row(27, "Portugal", 1, "World Cup", 5, 2, 1),
      row(27, "Portugal", 10, "Friendlies", 2, 1, 0),
      row(645, "Galatasaray", 203, "Süper Lig", 10, 4, 2),
    ] as Stat;
    const club = aggregateTeamSeasonTotals(stats, 27, { includeFriendlies: false });
    assert.equal(club.apps, 5);
    assert.equal(club.goals, 2);
    const caps = aggregateTeamSeasonTotals(stats, 27, { includeFriendlies: true });
    assert.equal(caps.apps, 7);
    assert.equal(caps.goals, 3);
  });

  it("aggregateInternationalCareerTotals sums NT seasons incl. friendlies", () => {
    const blocks = [
      {
        statistics: [
          row(27, "Portugal", 1, "World Cup", 5, 2, 1),
          row(27, "Portugal", 10, "Friendlies", 1, 0, 0),
        ] as Stat,
      },
      {
        statistics: [
          row(27, "Portugal", 5, "UEFA Nations League", 4, 1, 1),
          row(27, "Portugal", 10, "Friendlies", 2, 1, 0),
        ] as Stat,
      },
    ];
    const career = aggregateInternationalCareerTotals(blocks, 27);
    assert.equal(career.apps, 12); // 5+1+4+2
    assert.equal(career.goals, 4); // 2+0+1+1
    assert.equal(career.assists, 2); // 1+0+1+0
    assert.equal(career.seasons, 2);
  });

  it("isNationalTeamCareerStint true for Portugal World Cup rows", () => {
    assert.equal(looksLikeClubTeamName("Portugal"), false);
    assert.equal(looksLikeClubTeamName("Manchester United"), true);
    assert.equal(
      isNationalTeamCareerStint("Portugal", [
        { league: { name: "World Cup", country: "World" } },
      ]),
      true
    );
    assert.equal(
      isNationalTeamCareerStint("Galatasaray", [
        { league: { name: "Süper Lig", country: "Turkey" } },
      ]),
      false
    );
  });

  it("live +1 still bumps career caps once LIVE and on (same spirit as APP)", () => {
    // Prematch: show career so far (this match not counted)
    assert.equal(liveAdjustedSeasonStat(42, 0, "Assigned", { forceExcludeToday: true }), 42);
    // Live + on: career + 1
    assert.equal(liveAdjustedSeasonStat(42, 1, "Live", { forceExcludeToday: true }), 43);
  });
});
