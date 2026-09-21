import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveLineupSourceKind,
  lineupSourceBadgeLabel,
  lineupSourceBadgeClass,
  deriveLineupSourceFromPlan,
  pitchGrassBackground,
  PITCH_GRASS_OFFICIAL,
  PITCH_GRASS_PREDICTED,
} from "./lineup-source";

describe("lineup source badge", () => {
  it("maps confirmed → official", () => {
    assert.equal(
      resolveLineupSourceKind({ lineupStatus: "confirmed" }),
      "official"
    );
  });

  it("never styles predicted/last_xi like official", () => {
    assert.notEqual(
      lineupSourceBadgeClass("predicted"),
      lineupSourceBadgeClass("official")
    );
    assert.notEqual(
      lineupSourceBadgeClass("last_xi"),
      lineupSourceBadgeClass("official")
    );
    assert.match(lineupSourceBadgeClass("official"), /emerald/);
    assert.match(lineupSourceBadgeClass("last_xi"), /amber/);
  });

  it("formats Last XI with competition + date", () => {
    const label = lineupSourceBadgeLabel({
      kind: "last_xi",
      meta: {
        competitionShort: "Serie A",
        dateIso: "2026-09-13T18:00:00.000Z",
      },
    });
    assert.match(label, /Last XI/);
    assert.match(label, /Serie A/);
    assert.match(label, /Sep/);
  });

  it("derive from confirm / last xi plan", () => {
    assert.equal(
      deriveLineupSourceFromPlan({
        action: "confirm",
        lineupStatus: "confirmed",
      }).lineupSource,
      "official"
    );
    assert.equal(
      deriveLineupSourceFromPlan({
        action: "fallback_last_xi",
        lineupStatus: "expected",
        appliedLastXi: true,
      }).lineupSource,
      "last_xi"
    );
  });

  it("shows Live when official + liveAfterSubs meta", () => {
    assert.equal(
      resolveLineupSourceKind({
        lineupSource: "official",
        lineupStatus: "confirmed",
        meta: { liveAfterSubs: true },
      }),
      "live"
    );
    assert.equal(
      deriveLineupSourceFromPlan({
        action: "confirm",
        lineupStatus: "confirmed",
        liveAfterSubs: true,
      }).lineupSource,
      "live"
    );
    assert.equal(lineupSourceBadgeLabel({ kind: "live" }), "Live");
    assert.match(lineupSourceBadgeClass("live"), /violet/);
    assert.notEqual(
      lineupSourceBadgeClass("live"),
      lineupSourceBadgeClass("official")
    );
  });
});

describe("pitch grass by lineup source", () => {
  it("Official and Live use green grass", () => {
    assert.equal(pitchGrassBackground("official"), PITCH_GRASS_OFFICIAL);
    assert.equal(pitchGrassBackground("live"), PITCH_GRASS_OFFICIAL);
    assert.match(PITCH_GRASS_OFFICIAL, /#176f38/);
  });

  it("Predicted and Last XI use distinct non-green pitch", () => {
    assert.equal(pitchGrassBackground("predicted"), PITCH_GRASS_PREDICTED);
    assert.equal(pitchGrassBackground("last_xi"), PITCH_GRASS_PREDICTED);
    assert.notEqual(PITCH_GRASS_PREDICTED, PITCH_GRASS_OFFICIAL);
    assert.doesNotMatch(PITCH_GRASS_PREDICTED, /#176f38|#1c8240/);
    assert.match(PITCH_GRASS_PREDICTED, /#1a3a5c/);
  });
});
