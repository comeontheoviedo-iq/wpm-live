/**
 * Regression: AF provisional startXI (null formation/grids) must not
 * confirm Official or map pitch slots by array order.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isUsableOfficialLineup,
  planLineupApply,
} from "./lineup-gate";
import { assignSlotsFromStartXI, type AfLineupPlayer } from "./api-football";

function xi(
  rows: { name: string; pos: string; grid?: string | null; number?: number }[]
): AfLineupPlayer[] {
  return rows.map((r, i) => ({
    player: {
      id: 1000 + i,
      name: r.name,
      number: r.number ?? i + 1,
      pos: r.pos,
      grid: r.grid ?? null,
    },
  }));
}

/** Typical AF pre-match dump: 11 names, pos set, formation+grids null. Forwards first. */
const PROVISIONAL_FWD_FIRST = xi([
  { name: "Embolo", pos: "F" },
  { name: "Balogun", pos: "F" },
  { name: "Minamino", pos: "F" },
  { name: "Zakaria", pos: "M" },
  { name: "Camara", pos: "M" },
  { name: "Golovin", pos: "M" },
  { name: "Henrichs", pos: "D" },
  { name: "Kehrer", pos: "D" },
  { name: "Salisu", pos: "D" },
  { name: "Caio Henrique", pos: "D" },
  { name: "Majecki", pos: "G" },
]);

const OFFICIAL_433 = xi([
  { name: "Majecki", pos: "G", grid: "1:1" },
  { name: "Henrichs", pos: "D", grid: "2:4" },
  { name: "Kehrer", pos: "D", grid: "2:3" },
  { name: "Salisu", pos: "D", grid: "2:2" },
  { name: "Caio Henrique", pos: "D", grid: "2:1" },
  { name: "Zakaria", pos: "M", grid: "3:3" },
  { name: "Camara", pos: "M", grid: "3:2" },
  { name: "Golovin", pos: "M", grid: "3:1" },
  { name: "Embolo", pos: "F", grid: "4:3" },
  { name: "Balogun", pos: "F", grid: "4:2" },
  { name: "Minamino", pos: "F", grid: "4:1" },
]);

describe("isUsableOfficialLineup", () => {
  it("rejects null formation + null grids even with 11 startXI", () => {
    assert.equal(
      isUsableOfficialLineup({
        formation: null,
        startXI: PROVISIONAL_FWD_FIRST,
      }),
      false
    );
  });

  it("rejects empty formation string + empty grids", () => {
    assert.equal(
      isUsableOfficialLineup({
        formation: "",
        startXI: PROVISIONAL_FWD_FIRST,
      }),
      false
    );
  });

  it("rejects one-sided short XI", () => {
    assert.equal(
      isUsableOfficialLineup({
        formation: "4-3-3",
        startXI: PROVISIONAL_FWD_FIRST.slice(0, 8),
      }),
      false
    );
  });

  it("accepts formation + real grids", () => {
    assert.equal(
      isUsableOfficialLineup({
        formation: "4-3-3",
        startXI: OFFICIAL_433,
      }),
      true
    );
  });

  it("accepts 10+ grids even if formation lags", () => {
    assert.equal(
      isUsableOfficialLineup({
        formation: null,
        startXI: OFFICIAL_433,
      }),
      true
    );
  });
});

describe("planLineupApply — do not confirm Official from provisional", () => {
  const provisional = {
    homeOfficial: false,
    awayOfficial: false,
  };

  it("does not confirm when only names arrive (both sides unusable)", () => {
    const plan = planLineupApply({
      ...provisional,
      currentStatus: "expected",
      isLiveSync: false,
      isPreOrNs: true,
    });
    assert.notEqual(plan.action, "confirm");
    assert.notEqual(plan.lineupStatus, "confirmed");
  });

  it("does not confirm when only one side is official", () => {
    const plan = planLineupApply({
      homeOfficial: true,
      awayOfficial: false,
      currentStatus: "expected",
      isLiveSync: false,
      isPreOrNs: true,
    });
    assert.notEqual(plan.action, "confirm");
    assert.notEqual(plan.lineupStatus, "confirmed");
  });

  it("confirms only when both sides are usable Official", () => {
    const plan = planLineupApply({
      homeOfficial: true,
      awayOfficial: true,
      currentStatus: "expected",
      isLiveSync: true,
      isPreOrNs: false,
    });
    assert.equal(plan.action, "confirm");
    assert.equal(plan.lineupStatus, "confirmed");
  });

  it("keeps a live/FT Official board when AF later dumps null grids", () => {
    const plan = planLineupApply({
      ...provisional,
      currentStatus: "confirmed",
      isLiveSync: false,
      isPreOrNs: false,
    });
    assert.equal(plan.action, "keep");
    assert.equal(plan.lineupStatus, "confirmed");
  });

  it("NS full sync falls back to last XI instead of confirming the dump", () => {
    const plan = planLineupApply({
      ...provisional,
      currentStatus: "expected",
      isLiveSync: false,
      isPreOrNs: true,
    });
    assert.equal(plan.action, "fallback_last_xi");
    assert.notEqual(plan.lineupStatus, "confirmed");
  });

  it("live poll without Official keeps prior expected board (no last-XI hunt)", () => {
    const plan = planLineupApply({
      ...provisional,
      currentStatus: "expected",
      isLiveSync: true,
      isPreOrNs: true,
    });
    assert.equal(plan.action, "keep");
    assert.equal(plan.lineupStatus, "expected");
  });

  it("preserves a predicted board", () => {
    const plan = planLineupApply({
      ...provisional,
      currentStatus: "predicted",
      isLiveSync: false,
      isPreOrNs: true,
    });
    assert.equal(plan.action, "keep_predicted");
    assert.equal(plan.lineupStatus, "predicted");
  });
});

describe("assignSlotsFromStartXI — no array-order scramble", () => {
  it("places by pos-band, not startXI index, when grids are null", () => {
    const slots = assignSlotsFromStartXI(PROVISIONAL_FWD_FIRST, "4-3-3");
    // Array order would put Embolo (index 0, F) on GK. That is the scramble.
    assert.notEqual(slots[0], "GK", "forward listed first must not take GK");
    const gkIdx = PROVISIONAL_FWD_FIRST.findIndex((r) => r.player.pos === "G");
    assert.equal(slots[gkIdx], "GK");

    const defSlots = new Set(["RB", "RCB", "LCB", "LB"]);
    const fwdSlots = new Set(["RW", "ST", "LW"]);
    const midSlots = new Set(["RCM", "CM", "LCM"]);

    for (let i = 0; i < PROVISIONAL_FWD_FIRST.length; i++) {
      const pos = PROVISIONAL_FWD_FIRST[i].player.pos;
      const slot = slots[i];
      if (pos === "F") {
        assert.equal(
          fwdSlots.has(slot),
          true,
          `${PROVISIONAL_FWD_FIRST[i].player.name} (${pos}) got ${slot}`
        );
      }
      if (pos === "D") {
        assert.equal(
          defSlots.has(slot),
          true,
          `${PROVISIONAL_FWD_FIRST[i].player.name} (${pos}) got ${slot}`
        );
      }
      if (pos === "M") {
        assert.equal(
          midSlots.has(slot),
          true,
          `${PROVISIONAL_FWD_FIRST[i].player.name} (${pos}) got ${slot}`
        );
      }
    }
  });
});
