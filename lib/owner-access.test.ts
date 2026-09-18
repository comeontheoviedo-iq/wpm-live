import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isOwnerEmail, ownerEmailAllowlist, OWNER_FLOOR_EMAILS } from "./owner-access";

describe("owner-access", () => {
  it("includes floor emails", () => {
    const list = ownerEmailAllowlist();
    for (const e of OWNER_FLOOR_EMAILS) {
      assert.ok(list.includes(e), e);
    }
  });

  it("isOwnerEmail accepts floor and rejects others", () => {
    assert.equal(isOwnerEmail("chris@ronniedogmedia.com"), true);
    assert.equal(isOwnerEmail("ComeOnTheOviedo@gmail.com"), true);
    assert.equal(isOwnerEmail({ email: "chris@ronniedogmedia.com" }), true);
    assert.equal(isOwnerEmail("demo@pitchline.app"), false);
    assert.equal(isOwnerEmail(null), false);
  });
});
