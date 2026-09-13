/**
 * Transfer fee parsing + club history selection.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatTransferFee,
  isMoneyTransferFee,
  parseTransferFeeAmount,
  resolveTransferFeeRaw,
  selectClubTransferHistory,
  transferFeeKind,
} from "./transfer-fee";

describe("formatTransferFee", () => {
  it("normalises money strings for commentators", () => {
    assert.equal(formatTransferFee("€45M"), "€45m");
    assert.equal(formatTransferFee("€ 45M"), "€45m");
    assert.equal(formatTransferFee("€ 45.6M"), "€45.6m");
    assert.equal(formatTransferFee("9M €"), "€9m");
    assert.equal(formatTransferFee("€ 500K"), "€500k");
    assert.equal(formatTransferFee("1.5M €"), "€1.5m");
  });

  it("maps deal labels clearly", () => {
    assert.equal(formatTransferFee("Free"), "Free");
    assert.equal(formatTransferFee("Free agent"), "Free");
    assert.equal(formatTransferFee("Free Transfer"), "Free");
    assert.equal(formatTransferFee("Loan"), "Loan");
    assert.equal(formatTransferFee("Return from loan"), "Loan return");
    assert.equal(formatTransferFee("Back from Loan"), "Loan return");
    assert.equal(formatTransferFee("Transfer"), "Undisclosed");
    assert.equal(formatTransferFee("N/A"), "—");
    assert.equal(formatTransferFee("-"), "—");
    assert.equal(formatTransferFee(null), "—");
    assert.equal(formatTransferFee(""), "—");
  });
});

describe("isMoneyTransferFee / kind", () => {
  it("detects money vs labels", () => {
    assert.equal(isMoneyTransferFee("€ 70M"), true);
    assert.equal(isMoneyTransferFee("Transfer"), false);
    assert.equal(transferFeeKind("Swap"), "undisclosed");
    assert.equal(transferFeeKind("Loan"), "loan");
  });

  it("parses amount magnitudes", () => {
    assert.deepEqual(parseTransferFeeAmount("€ 11.6M"), {
      currency: "€",
      amount: 11.6,
      unit: "m",
    });
  });
});

describe("resolveTransferFeeRaw", () => {
  it("backfills money fee from same from→to sibling", () => {
    const rows = [
      { date: "2026-06-30", type: "Transfer", from: "Everton", to: "Newcastle", player: "A. Gordon" },
      { date: "2023-01-29", type: "€ 45.6M", from: "Everton", to: "Newcastle", player: "A. Gordon" },
    ];
    assert.equal(resolveTransferFeeRaw(rows[0], rows), "€ 45.6M");
    assert.equal(formatTransferFee(resolveTransferFeeRaw(rows[0], rows)), "€45.6m");
  });

  it("does not steal fee from the opposite direction", () => {
    const rows = [
      { date: "2025-09-01", type: "Transfer", from: "Newcastle", to: "Liverpool", player: "A. Isak" },
      { date: "2022-08-26", type: "€ 70M", from: "Real Sociedad", to: "Newcastle", player: "A. Isak" },
    ];
    assert.equal(resolveTransferFeeRaw(rows[0], rows), "Transfer");
    assert.equal(formatTransferFee(resolveTransferFeeRaw(rows[0], rows)), "Undisclosed");
  });
});

describe("selectClubTransferHistory", () => {
  it("keeps money-fee rows that fall outside the recent window", () => {
    const rows = [];
    // Flood recent window with non-money noise
    for (let i = 0; i < 55; i++) {
      const day = String(30 - (i % 28)).padStart(2, "0");
      rows.push({
        date: `2026-08-${day}`,
        type: i % 3 === 0 ? "Loan" : i % 3 === 1 ? "Transfer" : "Free agent",
        player: `Youth ${i}`,
        from: "Newcastle",
        to: "Loan Club",
      });
    }
    rows.push({
      date: "2023-07-03",
      type: "€ 70M",
      player: "S. Tonali",
      from: "AC Milan",
      to: "Newcastle",
    });
    rows.push({
      date: "2023-01-29",
      type: "€ 45.6M",
      player: "A. Gordon",
      from: "Everton",
      to: "Newcastle",
    });

    const picked = selectClubTransferHistory(rows, {
      limit: 60,
      recentWindow: 50,
      moneyLookbackYears: 6,
    });
    const money = picked.filter((r) => /€/.test(r.type || ""));
    assert.ok(money.some((r) => r.player === "S. Tonali"), "Tonali fee kept");
    assert.ok(money.some((r) => r.player === "A. Gordon"), "Gordon fee kept");
    assert.ok(picked.length <= 60);

    // Even when recent noise exceeds the limit, older fees must survive.
    const tight = selectClubTransferHistory(rows, {
      limit: 40,
      recentWindow: 55,
      moneyLookbackYears: 6,
    });
    assert.ok(
      tight.some((r) => r.player === "S. Tonali" && /€/.test(r.type || "")),
      "Tonali survives tight limit"
    );
  });
});
