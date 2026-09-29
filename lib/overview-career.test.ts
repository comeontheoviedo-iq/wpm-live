import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOverviewCareerBlock } from "./overview-career";

function club(
  name: string,
  apps: number,
  goals: number,
  assists: number,
  opts?: { nationalTeam?: boolean; seasons?: number[] }
) {
  return {
    teamId: name.length,
    name,
    seasons: opts?.seasons || [2026],
    apps,
    goals,
    assists,
    nationalTeam: opts?.nationalTeam,
  };
}

describe("buildOverviewCareerBlock — club desk", () => {
  it("sums club stints and lists club history; ignores NT rows in totals", () => {
    const block = buildOverviewCareerBlock({
      internationalDesk: false,
      clubs: [
        club("Galatasaray", 40, 12, 5, { seasons: [2026, 2025] }),
        club("AC Milan", 90, 30, 20, { seasons: [2024, 2023] }),
        club("Portugal", 25, 8, 3, { nationalTeam: true }),
      ],
    });
    assert.equal(block.hasData, true);
    assert.equal(block.appsLabel, "Apps");
    assert.equal(block.scopeHint, "club · ex-friendlies");
    assert.equal(block.apps, 130);
    assert.equal(block.goals, 42);
    assert.equal(block.assists, 25);
    assert.equal(block.clubHistory.length, 2);
    assert.equal(block.clubHistory[0].name, "Galatasaray");
    assert.equal(block.clubHistory[1].name, "AC Milan");
  });

  it("returns empty when no club stints (does not invent from player season)", () => {
    const block = buildOverviewCareerBlock({
      internationalDesk: false,
      clubs: [club("Portugal", 10, 2, 1, { nationalTeam: true })],
      playerFallback: { appearances: 10, goals: 2, assists: 1 },
    });
    assert.equal(block.hasData, false);
    assert.equal(block.apps, null);
    assert.equal(block.clubHistory.length, 0);
  });

  it("handles empty clubs", () => {
    const block = buildOverviewCareerBlock({
      internationalDesk: false,
      clubs: [],
    });
    assert.equal(block.hasData, false);
    assert.equal(block.apps, null);
  });
});

describe("buildOverviewCareerBlock — international desk", () => {
  it("sums NT caps and still surfaces club history when present", () => {
    const block = buildOverviewCareerBlock({
      internationalDesk: true,
      clubs: [
        club("Australia", 18, 4, 2, { nationalTeam: true, seasons: [2026, 2025] }),
        club("Bayern Munich", 5, 1, 0, { seasons: [2026] }),
        club("Adelaide United", 40, 12, 6, { seasons: [2024] }),
      ],
    });
    assert.equal(block.hasData, true);
    assert.equal(block.appsLabel, "Caps");
    assert.equal(block.scopeHint, "international · incl. friendlies");
    assert.equal(block.apps, 18);
    assert.equal(block.goals, 4);
    assert.equal(block.assists, 2);
    assert.equal(block.clubHistory.length, 2);
    assert.ok(block.clubHistory.every((c) => !c.nationalTeam));
  });

  it("falls back to Player.* career caps when NT rows missing", () => {
    const block = buildOverviewCareerBlock({
      internationalDesk: true,
      clubs: [club("Bayern Munich", 5, 1, 0)],
      playerFallback: { appearances: 7, goals: 2, assists: 0 },
    });
    assert.equal(block.hasData, true);
    assert.equal(block.apps, 7);
    assert.equal(block.goals, 2);
    assert.equal(block.assists, 0);
    assert.equal(block.clubHistory.length, 1);
  });

  it("does not invent fallback zeros when nothing exists", () => {
    const block = buildOverviewCareerBlock({
      internationalDesk: true,
      clubs: [],
      playerFallback: { appearances: 0, goals: 0, assists: 0 },
    });
    assert.equal(block.hasData, false);
    assert.equal(block.apps, null);
  });

  it("sums multiple NT stints when present", () => {
    const block = buildOverviewCareerBlock({
      internationalDesk: true,
      clubs: [
        club("Portugal", 20, 5, 2, { nationalTeam: true }),
        club("Portugal U21", 8, 3, 1, { nationalTeam: true }),
      ],
    });
    assert.equal(block.apps, 28);
    assert.equal(block.goals, 8);
    assert.equal(block.assists, 3);
    assert.equal(block.clubHistory.length, 0);
  });
});
