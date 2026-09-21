import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isPitchFormationSlot,
  resolveInheritedSlot,
  isSubAlreadyApplied,
} from "./sub-apply";

describe("sub-apply idempotency", () => {
  const valid = ["GK", "CB1", "CB2", "LB", "RB", "CM1", "CM2", "CM3", "LW", "RW", "ST"];

  it("rejects BENCH as a pitch slot", () => {
    assert.equal(isPitchFormationSlot("BENCH", valid), false);
    assert.equal(isPitchFormationSlot(null, valid), false);
    assert.equal(isPitchFormationSlot("ST", valid), true);
  });

  it("never inherits BENCH", () => {
    assert.equal(resolveInheritedSlot("BENCH", valid), null);
    assert.equal(resolveInheritedSlot("CM1", valid), "CM1");
  });

  it("detects already-applied sub", () => {
    assert.equal(
      isSubAlreadyApplied({
        outOnPitch: false,
        outSlot: "BENCH",
        inOnPitch: true,
        inSlot: "CM1",
        validSlotIds: valid,
      }),
      true
    );
  });

  it("does not skip when out still on pitch", () => {
    assert.equal(
      isSubAlreadyApplied({
        outOnPitch: true,
        outSlot: "CM1",
        inOnPitch: false,
        inSlot: "BENCH",
        validSlotIds: valid,
      }),
      false
    );
  });

  it("scramble case: both on BENCH is NOT already applied", () => {
    assert.equal(
      isSubAlreadyApplied({
        outOnPitch: false,
        outSlot: "BENCH",
        inOnPitch: true,
        inSlot: "BENCH",
        validSlotIds: valid,
      }),
      false
    );
  });
});
