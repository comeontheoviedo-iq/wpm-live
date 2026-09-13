/**
 * Goal popup: previous goal excludes current fixture; ordinal/now stay consistent.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildGoalNarrativeHooks,
  findPreviousGoal,
} from "./event-detail";
import { liveAdjustedSeasonStat, seasonOrdinal } from "./season-tally";
import { formatTransferFee } from "./transfer-fee";
import type { PlayerFormRow } from "./api-football";

function row(partial: Partial<PlayerFormRow> & { fixtureId: number }): PlayerFormRow {
  return {
    date: "2026-09-01T15:00:00+00:00",
    opponent: "Nice",
    result: "W",
    homeAway: "H",
    score: "2-0",
    rating: null,
    started: true,
    minutes: 90,
    goals: 0,
    assists: 0,
    yellow: 0,
    red: 0,
    played: true,
    ...partial,
  };
}

describe("findPreviousGoal", () => {
  it("skips the current fixture even when it has goals", () => {
    const form = [
      row({
        fixtureId: 999,
        date: "2026-09-12T15:15:00+00:00",
        opponent: "Monaco",
        goals: 1,
      }),
      row({
        fixtureId: 888,
        date: "2026-08-30T15:00:00+00:00",
        opponent: "Lyon",
        goals: 1,
      }),
    ];
    const prev = findPreviousGoal(form, {
      excludeFixtureId: 999,
      excludeDatePrefix: "2026-09-12",
      asOf: new Date("2026-09-13T12:00:00Z"),
    });
    assert.ok(prev);
    assert.equal(prev!.opponent, "Lyon");
    assert.equal(prev!.date, "2026-08-30");
  });
});

describe("buildGoalNarrativeHooks", () => {
  it("never says sample/sampled", () => {
    const form = [
      row({ fixtureId: 1, goals: 1, opponent: "Monaco" }),
      row({ fixtureId: 2, goals: 1, opponent: "Monaco", date: "2026-08-20T15:00:00Z" }),
      row({ fixtureId: 3, goals: 1, opponent: "Nice", date: "2026-08-10T15:00:00Z" }),
    ];
    const hooks = buildGoalNarrativeHooks({
      form,
      opponentName: "Monaco",
      includeThisGoal: true,
      excludeFixtureId: 99,
    });
    for (const h of hooks) {
      assert.equal(/sample/i.test(h.text), false, h.text);
    }
  });
});

describe("liveAdjustedSeasonStat vs ordinal", () => {
  it("does not double-count when AF caught up past desk baseline", () => {
    // Desk had 2; this match scored 1; fresh AF already 3
    const now = liveAdjustedSeasonStat(3, 1, "Live", { deskBaseline: 2 });
    assert.equal(now, 3);
    const nth = seasonOrdinal(3, 1, 1, "Full Time");
    assert.equal(nth, 3);
  });

  it("adds in-match while AF still lags desk", () => {
    const now = liveAdjustedSeasonStat(2, 1, "Live", { deskBaseline: 2 });
    assert.equal(now, 3);
  });
});

describe("formatTransferFee", () => {
  it("shows AF fee strings and dashes unknowns", () => {
    assert.equal(formatTransferFee("€45M"), "€45m");
    assert.equal(formatTransferFee("Free"), "Free");
    assert.equal(formatTransferFee("N/A"), "—");
    assert.equal(formatTransferFee(null), "—");
    assert.equal(formatTransferFee(""), "—");
  });
});
