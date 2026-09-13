import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildWelcomeEmail, isAlreadyOnLiveTrial } from "./welcome-email";

describe("buildWelcomeEmail", () => {
  it("uses CoComms branding and allowed copy", () => {
    const { subject, html, text } = buildWelcomeEmail({
      name: "Chris Beaumont",
      plan: "unlimited",
    });
    assert.match(subject, /CoComms/i);
    assert.match(text, /Hi Chris/);
    assert.match(text, /14 days/);
    assert.match(text, /3 desks/);
    assert.match(text, /Scripts and Notes/);
    assert.match(text, /Bring your notes\. We file them where you need them\./);
    assert.match(text, /https:\/\/www\.cocomms\.online/);
    assert.match(text, /\/training/);
    assert.match(text, /Unlimited/);
    assert.match(html, /Official XI/);
    for (const forbidden of [
      "Gemini",
      "OBS",
      "BYO Notebook",
      "Speaks",
      "generic SaaS shell",
    ]) {
      assert.equal(text.includes(forbidden), false, `text has ${forbidden}`);
      assert.equal(html.includes(forbidden), false, `html has ${forbidden}`);
    }
  });

  it("soft-mentions Match Desk Pass when known", () => {
    const { text } = buildWelcomeEmail({ name: "Alex", plan: "match_pass" });
    assert.match(text, /Match Desk Pass/);
  });
});

describe("isAlreadyOnLiveTrial", () => {
  it("true only for trial with future end", () => {
    assert.equal(
      isAlreadyOnLiveTrial({
        billingStatus: "trial",
        trialEndsAt: new Date(Date.now() + 86400000),
      }),
      true
    );
    assert.equal(
      isAlreadyOnLiveTrial({
        billingStatus: "trial",
        trialEndsAt: new Date(Date.now() - 1000),
      }),
      false
    );
    assert.equal(
      isAlreadyOnLiveTrial({
        billingStatus: "active",
        trialEndsAt: new Date(Date.now() + 86400000),
      }),
      false
    );
  });
});
