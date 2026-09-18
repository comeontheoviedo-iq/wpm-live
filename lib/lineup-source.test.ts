import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveLineupSourceKind,
  lineupSourceBadgeLabel,
  lineupSourceBadgeClass,
  deriveLineupSourceFromPlan,
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
});
