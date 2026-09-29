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

describe("buildOverviewCareerBlock — international desk (canonical Player.*)", () => {
  it("uses Player.* CAPS/G/A even when NT career rows differ (no sum)", () => {
    const card = { appearances: 18, goals: 6, assists: 1 };
    const block = buildOverviewCareerBlock({
      internationalDesk: true,
      clubs: [
        // Divergent / incomplete NT row — must NOT win over Player.*
        club("Australia", 18, 4, 2, { nationalTeam: true, seasons: [2026, 2025] }),
        club("Bayern Munich", 5, 1, 0, { seasons: [2026] }),
        club("Adelaide United", 40, 12, 6, { seasons: [2024] }),
      ],
      playerFallback: card,
    });
    assert.equal(block.hasData, true);
    assert.equal(block.appsLabel, "Caps");
    assert.equal(block.scopeHint, "international · incl. friendlies");
    assert.equal(block.apps, card.appearances);
    assert.equal(block.goals, card.goals);
    assert.equal(block.assists, card.assists);
    assert.equal(block.clubHistory.length, 2);
    assert.ok(block.clubHistory.every((c) => !c.nationalTeam));
  });

  it("does not double-count youth / other NT stints — Player.* wins", () => {
    const card = { appearances: 20, goals: 5, assists: 2 };
    const block = buildOverviewCareerBlock({
      internationalDesk: true,
      clubs: [
        club("Portugal", 20, 5, 2, { nationalTeam: true }),
        club("Portugal U21", 8, 3, 1, { nationalTeam: true }),
      ],
      playerFallback: card,
    });
    // Must be 20/5/2 (senior card), NOT 28/8/3
    assert.equal(block.apps, 20);
    assert.equal(block.goals, 5);
    assert.equal(block.assists, 2);
    assert.equal(block.clubHistory.length, 0);
  });

  it("profile Career totals === pitch card totals (Rayan Brazil 7/2)", () => {
    const card = { appearances: 7, goals: 2, assists: 1 };
    // Incomplete /players?id= Brazil row (WC only) — old Overview would show 4/0
    const block = buildOverviewCareerBlock({
      internationalDesk: true,
      clubs: [
        club("Brazil", 4, 0, 1, { nationalTeam: true }),
        club("Vasco DA Gama", 34, 14, 1),
      ],
      playerFallback: card,
    });
    assert.equal(block.apps, 7);
    assert.equal(block.goals, 2);
    assert.equal(block.assists, 1);
    assert.equal(block.apps, card.appearances);
    assert.equal(block.goals, card.goals);
    assert.equal(block.assists, card.assists);
  });

  it("profile Career totals === pitch card totals (Irankunda Australia 18/6)", () => {
    const card = { appearances: 18, goals: 6, assists: 0 };
    const block = buildOverviewCareerBlock({
      internationalDesk: true,
      clubs: [
        club("Australia", 18, 4, 2, { nationalTeam: true, seasons: [2026, 2025] }),
        club("Bayern Munich", 5, 1, 0),
      ],
      playerFallback: card,
    });
    assert.equal(block.apps, 18);
    assert.equal(block.goals, 6);
    assert.equal(block.assists, 0);
    assert.equal(block.apps, card.appearances);
    assert.equal(block.goals, card.goals);
    assert.equal(block.assists, card.assists);
  });

  it("surfaces club history when Player.* provided with zeros", () => {
    const block = buildOverviewCareerBlock({
      internationalDesk: true,
      clubs: [club("Bayern Munich", 5, 1, 0)],
      playerFallback: { appearances: 0, goals: 0, assists: 0 },
    });
    assert.equal(block.hasData, true);
    assert.equal(block.apps, 0);
    assert.equal(block.goals, 0);
    assert.equal(block.assists, 0);
    assert.equal(block.clubHistory.length, 1);
  });

  it("null totals when no Player.* and no club history", () => {
    const block = buildOverviewCareerBlock({
      internationalDesk: true,
      clubs: [],
      playerFallback: null,
    });
    assert.equal(block.hasData, false);
    assert.equal(block.apps, null);
  });

  it("ignores NT career rows when Player.* absent (no divergent invent)", () => {
    const block = buildOverviewCareerBlock({
      internationalDesk: true,
      clubs: [club("Australia", 18, 6, 0, { nationalTeam: true })],
      playerFallback: null,
    });
    assert.equal(block.hasData, false);
    assert.equal(block.apps, null);
    assert.equal(block.goals, null);
    assert.equal(block.assists, null);
  });
});
