/**
 * Regression: note ↔ player attach must fold Turkish ı/İ the same on both sides.
 * Galatasaray vs Kocaelispor desk: Çakır / Yılmaz missed ASCII research headings;
 * other accents (é, ü, …) already worked via NFD — ı does not decompose.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  lastToken,
  namesLooselyMatch,
  normalizePlayerKey,
} from "./player-name";
import { extractPlayerSections } from "./pack-distribute";
import { organiseNotebookPack } from "./notebook-organise";

describe("normalizePlayerKey — Turkish ı / mixed accents", () => {
  it("folds Çakır (ı) to the same key as ASCII Cakir", () => {
    assert.equal(normalizePlayerKey("Çakır"), "cakir");
    assert.equal(normalizePlayerKey("Cakir"), "cakir");
    assert.equal(normalizePlayerKey("U. Çakır"), normalizePlayerKey("U. Cakir"));
  });

  it("folds Yılmaz (ı) to the same key as Yilmaz", () => {
    assert.equal(normalizePlayerKey("Yılmaz"), "yilmaz");
    assert.equal(normalizePlayerKey("Yilmaz"), "yilmaz");
    assert.equal(normalizePlayerKey("B. Yılmaz"), "b yilmaz");
    assert.equal(
      lastToken("B. Yılmaz"),
      lastToken("Baris Alper Yilmaz")
    );
  });

  it("folds capital İ and ASCII I to i", () => {
    assert.equal(normalizePlayerKey("İcardi"), "icardi");
    assert.equal(normalizePlayerKey("Icardi"), "icardi");
  });

  it("still folds Latin accents that NFD-decompose (é ü ö ç ş ğ)", () => {
    assert.equal(normalizePlayerKey("Ayé"), "aye");
    assert.equal(normalizePlayerKey("Aye"), "aye");
    assert.equal(normalizePlayerKey("F. Ayé"), "f aye");
    assert.equal(normalizePlayerKey("Müllér"), "muller");
    assert.equal(normalizePlayerKey("Özyakup"), "ozyakup");
    assert.equal(normalizePlayerKey("Güvenç"), "guvenc");
    assert.equal(normalizePlayerKey("Şahin"), "sahin");
    assert.equal(normalizePlayerKey("Akgün"), "akgun");
  });

  it("lastToken keeps Yılmaz / Çakır as one surname token", () => {
    assert.equal(lastToken("U. Çakır"), "cakir");
    assert.equal(lastToken("B. Yılmaz"), "yilmaz");
    assert.equal(lastToken("F. Ayé"), "aye");
  });
});

describe("namesLooselyMatch — AF short name ↔ research heading", () => {
  it("matches U. Çakır to ASCII / full research forms", () => {
    assert.equal(namesLooselyMatch("U. Çakır", "Ugurcan Cakir"), true);
    assert.equal(namesLooselyMatch("U. Çakır", "U. Cakir"), true);
    assert.equal(namesLooselyMatch("U. Çakır", "Çakır"), true);
    assert.equal(namesLooselyMatch("U. Çakır", "Cakir"), true);
  });

  it("matches B. Yılmaz to Yilmaz / Baris Alper Yilmaz", () => {
    assert.equal(namesLooselyMatch("B. Yılmaz", "Yilmaz"), true);
    assert.equal(namesLooselyMatch("B. Yılmaz", "Baris Alper Yilmaz"), true);
    assert.equal(namesLooselyMatch("B. Yılmaz", "Barış Alper Yılmaz"), true);
  });

  it("matches F. Ayé to Aye / Florian Aye (short accented surname)", () => {
    assert.equal(namesLooselyMatch("F. Ayé", "Aye"), true);
    assert.equal(namesLooselyMatch("F. Ayé", "Ayé"), true);
    assert.equal(namesLooselyMatch("F. Ayé", "Florian Aye"), true);
    assert.equal(namesLooselyMatch("F. Ayé", "Florian Ayé"), true);
  });

  it("does not false-positive unrelated short tokens", () => {
    assert.equal(namesLooselyMatch("F. Ayé", "Maybe"), false);
    assert.equal(namesLooselyMatch("U. Çakır", "Bakir"), false);
  });
});

describe("extractPlayerSections / organise — mixed accent notes vs AF names", () => {
  const players = [
    { id: "p-cakir", name: "U. Çakır" },
    { id: "p-yilmaz", name: "B. Yılmaz" },
    { id: "p-aye", name: "F. Ayé" },
    { id: "p-icardi", name: "M. Icardi" },
  ];

  const pack = `
## PART IV — Player Profiles

#### 1. Ugurcan Cakir (Goalkeeper)
Galatasaray's shot-stopper; commanding box presence.

#### 53. Baris Alper Yilmaz (Forward)
Direct winger/striker hybrid; constant overlap threat.

#### 97. Florian Aye (Striker)
Kocaelispor centre-forward; penalty-box instincts.

#### 9. Mauro Icardi (Forward)
Clinical finisher; holds the ball up well.
`;

  it("extractPlayerSections attaches bios despite Turkish ı / é mismatch", () => {
    const sections = extractPlayerSections(pack, players);
    const byId = Object.fromEntries(sections.map((s) => [s.player.id, s]));
    assert.ok(byId["p-cakir"], "Çakır should match ASCII Cakir heading");
    assert.ok(byId["p-yilmaz"], "Yılmaz should match ASCII Yilmaz heading");
    assert.ok(byId["p-aye"], "Ayé should match Aye heading");
    assert.ok(byId["p-icardi"], "Icardi still matches");
    assert.match(byId["p-cakir"].body, /shot-stopper/i);
    assert.match(byId["p-yilmaz"].body, /overlap threat/i);
    assert.match(byId["p-aye"].body, /penalty-box/i);
  });

  it("organiseNotebookPack creates player Bio notes for the three miss cases", () => {
    const organised = organiseNotebookPack({
      text: pack,
      matchId: "m1",
      homeClub: { id: "c-gala", name: "Galatasaray" },
      awayClub: { id: "c-koc", name: "Kocaelispor" },
      players,
      coaches: [],
    });
    const bios = organised.notes.filter(
      (n) => n.entityType === "player" && n.category === "Bio"
    );
    const ids = new Set(bios.map((n) => n.entityId));
    assert.ok(ids.has("p-cakir"), "expected Çakır bio");
    assert.ok(ids.has("p-yilmaz"), "expected Yılmaz bio");
    assert.ok(ids.has("p-aye"), "expected Ayé bio");
  });
});
