import { test } from "node:test";
import assert from "node:assert/strict";
import { countryFromHeaders, currencyForCountry, isFoundingOpen, normalizePromo } from "./region-pricing";

test("maps countries to currency", () => {
  assert.equal(currencyForCountry("GB"), "gbp");
  assert.equal(currencyForCountry("IE"), "eur");
  assert.equal(currencyForCountry("US"), "usd");
  assert.equal(currencyForCountry("CA"), "usd");
  assert.equal(currencyForCountry("NZ"), "usd");
  assert.equal(currencyForCountry(null), "gbp");
});
test("reads netlify geo headers", () => {
  assert.equal(countryFromHeaders(new Headers({ "x-country": "us" })), "US");
  const geo = Buffer.from(JSON.stringify({ country: { code: "IE" } })).toString("base64");
  assert.equal(countryFromHeaders(new Headers({ "x-nf-geo": geo })), "IE");
  assert.equal(countryFromHeaders(new Headers()), null);
});
test("normalizes promo + deadline", () => {
  assert.equal(normalizePromo(" founding50 "), "FOUNDING50");
  assert.equal(normalizePromo("bad code!"), null);
  assert.equal(isFoundingOpen(new Date("2026-10-31T12:00:00Z")), true);
  assert.equal(isFoundingOpen(new Date("2026-11-01T00:00:01Z")), false);
});
