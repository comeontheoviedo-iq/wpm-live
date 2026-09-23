import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatNameByFormat,
  formatPitchCardName,
} from "./player-name";

describe("formatNameByFormat", () => {
  it("surname = last token (default / Barry current behaviour)", () => {
    assert.equal(formatNameByFormat("João Silva", "surname"), "Silva");
    assert.equal(formatNameByFormat("João Pedro Silva", "surname"), "Silva");
    assert.equal(formatNameByFormat("Silva", "surname"), "Silva");
  });

  it("initial_last = first initial + last token", () => {
    assert.equal(formatNameByFormat("João Silva", "initial_last"), "J. Silva");
    assert.equal(
      formatNameByFormat("João Pedro Silva", "initial_last"),
      "J. Silva"
    );
    assert.equal(formatNameByFormat("J. Silva", "initial_last"), "J. Silva");
  });

  it("first_last = first token + last token", () => {
    assert.equal(formatNameByFormat("João Silva", "first_last"), "João Silva");
    assert.equal(
      formatNameByFormat("João Pedro Silva", "first_last"),
      "João Silva"
    );
    assert.equal(formatNameByFormat("Silva", "first_last"), "Silva");
  });

  it("defaults to surname when format omitted", () => {
    assert.equal(formatNameByFormat("João Silva"), "Silva");
  });

  it("handles empty / whitespace", () => {
    assert.equal(formatNameByFormat("", "surname"), "");
    assert.equal(formatNameByFormat("   ", "first_last"), "");
  });
});

describe("formatPitchCardName", () => {
  it("manual displayName / Card name overrides format", () => {
    assert.equal(
      formatPitchCardName(
        { name: "João Silva", displayName: "Jota" },
        "surname"
      ),
      "Jota"
    );
    assert.equal(
      formatPitchCardName(
        { name: "João Silva", displayName: "Jota" },
        "first_last"
      ),
      "Jota"
    );
  });

  it("formats name when no displayName", () => {
    assert.equal(
      formatPitchCardName({ name: "João Silva" }, "initial_last"),
      "J. Silva"
    );
    assert.equal(
      formatPitchCardName({ name: "João Silva", displayName: null }, "surname"),
      "Silva"
    );
    assert.equal(
      formatPitchCardName({ name: "João Silva", displayName: "  " }, "first_last"),
      "João Silva"
    );
  });
});
