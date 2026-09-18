import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSupportPingAlertEmail,
  parseSupportPingType,
} from "./support-ping-alert";

describe("support-ping-alert", () => {
  it("parses UI type labels", () => {
    assert.equal(parseSupportPingType("Ask"), "ask");
    assert.equal(parseSupportPingType("XI wrong"), "xi_wrong");
    assert.equal(parseSupportPingType("xi-wrong"), "xi_wrong");
    assert.equal(parseSupportPingType("billing"), "billing");
    assert.equal(parseSupportPingType("nope"), null);
  });

  it("builds [CoComms Ask/Report] subject", () => {
    const { subject, text } = buildSupportPingAlertEmail({
      pingId: "ping_test",
      type: "bug",
      message: "XI swapped",
      userName: "Chris",
      userEmail: "chris@example.com",
      context: { matchTitle: "NUFC vs ARS", afFixtureId: 123 },
    });
    assert.match(subject, /^\[CoComms Ask\/Report\] Bug/);
    assert.match(subject, /NUFC vs ARS/);
    assert.match(text, /ping_test/);
    assert.match(text, /AF fixture id: 123/);
  });
});
