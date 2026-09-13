import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateClubSeasonTotals,
  aggregateForIngest,
  liveAdjustedSeasonStat,
  matchHasStarted,
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
