/**
 * Regression: dossier header / GENERAL / verdict must share one age.
 * Dominik Greif DOB 1997-04-06 → 29 on 2026-09-12 (AF integer was stale 28).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ageFromBirthDate,
  alignAgeMentions,
  resolvePersonAge,
} from "./person-age";

const GREIF_DOB = "1997-04-06";
const TODAY = new Date(Date.UTC(2026, 8, 12)); // 12 Sep 2026

describe("ageFromBirthDate", () => {
  it("Dominik Greif is 29 on 2026-09-12 (birthday 6 Apr)", () => {
    assert.equal(ageFromBirthDate(GREIF_DOB, TODAY), 29);
  });

  it("is still 28 the day before the birthday", () => {
    assert.equal(
      ageFromBirthDate(GREIF_DOB, new Date(Date.UTC(2026, 3, 5))),
      28
    );
  });

  it("ticks over on the birthday (UTC)", () => {
    assert.equal(
      ageFromBirthDate(GREIF_DOB, new Date(Date.UTC(2026, 3, 6))),
      29
    );
  });

  it("accepts a full ISO timestamp", () => {
    assert.equal(ageFromBirthDate("1997-04-06T00:00:00.000Z", TODAY), 29);
  });

  it("returns null for missing / junk", () => {
    assert.equal(ageFromBirthDate(null, TODAY), null);
    assert.equal(ageFromBirthDate("", TODAY), null);
    assert.equal(ageFromBirthDate("not-a-date", TODAY), null);
  });
});

describe("resolvePersonAge", () => {
  it("prefers DOB over a stale AF age integer", () => {
    assert.equal(
      resolvePersonAge({ birthDate: GREIF_DOB, age: 28 }, TODAY),
      29
    );
  });

  it("uses AF birth.date when birthDate is unset (coaches)", () => {
    assert.equal(
      resolvePersonAge({ age: 47, birth: { date: "1978-10-02" } }, TODAY),
      47
    );
    assert.equal(
      resolvePersonAge({ age: 46, birth: { date: "1978-10-02" } }, TODAY),
      47
    );
  });

  it("falls back to stored age when there is no DOB", () => {
    assert.equal(resolvePersonAge({ age: 31 }, TODAY), 31);
    assert.equal(resolvePersonAge({ birthDate: null, age: 31 }, TODAY), 31);
  });

  it("returns null when both are missing", () => {
    assert.equal(resolvePersonAge({}, TODAY), null);
    assert.equal(resolvePersonAge(null, TODAY), null);
  });
});

describe("alignAgeMentions", () => {
  it("rewrites a lagging year-old so verdict matches header", () => {
    assert.equal(
      alignAgeMentions("The 28-year-old Slovak keeper.", 29),
      "The 29-year-old Slovak keeper."
    );
    assert.equal(
      alignAgeMentions("29-year-old already correct.", 29),
      "29-year-old already correct."
    );
  });

  it("handles spaced / en-dash forms", () => {
    assert.equal(alignAgeMentions("a 28 year old midfielder", 29), "a 29 year old midfielder");
    assert.equal(alignAgeMentions("the 28–year-old", 29), "the 29–year-old");
  });

  it("leaves other numbers alone", () => {
    assert.equal(
      alignAgeMentions("8 apps, #1 shirt, 28-year-old", 29),
      "8 apps, #1 shirt, 29-year-old"
    );
  });
});
