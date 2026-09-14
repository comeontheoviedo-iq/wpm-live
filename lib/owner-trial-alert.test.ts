import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOwnerTrialAlertEmail,
  formatOwnerTrialPlanLine,
  ownerAlertEmail,
} from "./owner-trial-alert";

describe("formatOwnerTrialPlanLine", () => {
  it("labels Unlimited", () => {
    assert.equal(formatOwnerTrialPlanLine({ plan: "unlimited" }), "Unlimited");
  });

  it("labels Match Desk Pass with credits when known", () => {
    assert.equal(
      formatOwnerTrialPlanLine({ plan: "match_pass", matchPassCredits: 3 }),
      "Match Desk Pass (3 credits)"
    );
    assert.equal(
      formatOwnerTrialPlanLine({ plan: "match_pass", matchPassCredits: 1 }),
      "Match Desk Pass (1 credit)"
    );
  });

  it("labels Match Desk Pass without credits", () => {
    assert.equal(
      formatOwnerTrialPlanLine({ plan: "match_pass" }),
      "Match Desk Pass"
    );
  });
});

describe("buildOwnerTrialAlertEmail", () => {
  it("builds subject and body with name, email, plan, ISO time", () => {
    const unlockedAt = "2026-09-14T08:49:00.000Z";
    const { subject, html, text } = buildOwnerTrialAlertEmail({
      name: "Chris Beaumont",
      email: "newuser@example.com",
      plan: "unlimited",
      unlockedAt,
    });
    assert.equal(subject, "CoComms — new trial: newuser@example.com");
    assert.match(text, /Name: Chris Beaumont/);
    assert.match(text, /Email: newuser@example.com/);
    assert.match(text, /Plan: Unlimited/);
    assert.match(text, /Unlocked at \(ISO\): 2026-09-14T08:49:00\.000Z/);
    assert.match(html, /Chris Beaumont/);
    assert.match(html, /newuser@example\.com/);
  });

  it("includes Match Desk Pass credits in body", () => {
    const { text } = buildOwnerTrialAlertEmail({
      name: "Alex",
      email: "alex@example.com",
      plan: "match_pass",
      matchPassCredits: 2,
      unlockedAt: "2026-09-14T08:49:00.000Z",
    });
    assert.match(text, /Match Desk Pass \(2 credits\)/);
  });
});

describe("ownerAlertEmail", () => {
  it("defaults to chris@ronniedogmedia.com when env unset", () => {
    const prev = process.env.OWNER_ALERT_EMAIL;
    delete process.env.OWNER_ALERT_EMAIL;
    try {
      assert.equal(ownerAlertEmail(), "chris@ronniedogmedia.com");
    } finally {
      if (prev === undefined) delete process.env.OWNER_ALERT_EMAIL;
      else process.env.OWNER_ALERT_EMAIL = prev;
    }
  });
});
