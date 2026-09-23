import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  planDirectSlotSwap,
  resolveSlotOverrideAssignments,
} from "./pitch-swap";

describe("planDirectSlotSwap", () => {
  it("swaps occupied slot 2-way: placer↔occupant only", () => {
    const plan = planDirectSlotSwap({
      placerId: "cm",
      targetSlot: "CD",
      placerPrevSlot: "CM",
      occupantId: "cd",
    });
    assert.equal(plan.targetSlot, "CD");
    assert.equal(plan.occupantId, "cd");
    assert.equal(plan.occupantToSlot, "CM");
  });

  it("benches occupant when placer had no previous slot", () => {
    const plan = planDirectSlotSwap({
      placerId: "bench",
      targetSlot: "CD",
      placerPrevSlot: null,
      occupantId: "cd",
    });
    assert.equal(plan.occupantId, "cd");
    assert.equal(plan.occupantToSlot, null);
  });

  it("empty target: no occupant move", () => {
    const plan = planDirectSlotSwap({
      placerId: "cm",
      targetSlot: "CD",
      placerPrevSlot: "CM",
      occupantId: null,
    });
    assert.equal(plan.occupantId, null);
    assert.equal(plan.occupantToSlot, null);
  });
});

describe("resolveSlotOverrideAssignments — no 3-way rotate", () => {
  it("mutual A↔B swap stays 2-way", () => {
    const current = new Map<string, string | null>([
      ["cm", "CM"],
      ["cd", "CD"],
      ["lb", "LB"],
    ]);
    const intended = new Map([
      ["cm", "CD"],
      ["cd", "CM"],
    ]);
    const out = resolveSlotOverrideAssignments(current, intended);
    assert.equal(out.get("cm"), "CD");
    assert.equal(out.get("cd"), "CM");
    assert.equal(out.get("lb"), "LB", "third player must not move");
  });

  it("does not rotate a third body when prev home is also override-claimed", () => {
    // Stale: lb override still claims CD while cm also wants CD (Barry cascade)
    const current = new Map<string, string | null>([
      ["cm", "CM"],
      ["cd", "CD"],
      ["lb", "LB"],
    ]);
    const intended = new Map([
      ["cm", "CD"],
      ["lb", "CD"], // conflicting stale claim
    ]);
    const out = resolveSlotOverrideAssignments(current, intended);
    // Invariant: never produce the 3-cycle CM→CD, CD→LB, LB→CM/CD
    assert.notEqual(out.get("cd"), "LB", "cd must not be shoved to LB");
    assert.notEqual(out.get("lb"), "CM", "lb must not be shoved to CM");
    // At most one claimant occupies CD
    const onCd = ["cm", "cd", "lb"].filter((id) => out.get(id) === "CD");
    assert.ok(onCd.length <= 1, `only one player on CD, got ${onCd.join(",")}`);
  });

  it("single override displaces occupant to placer prev only", () => {
    const current = new Map<string, string | null>([
      ["cm", "CM"],
      ["cd", "CD"],
      ["lb", "LB"],
    ]);
    const intended = new Map([["cm", "CD"]]);
    const out = resolveSlotOverrideAssignments(current, intended);
    assert.equal(out.get("cm"), "CD");
    assert.equal(out.get("cd"), "CM");
    assert.equal(out.get("lb"), "LB");
  });
});
