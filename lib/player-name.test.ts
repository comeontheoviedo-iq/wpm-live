/**
 * Regression: note ↔ player attach must fold Turkish ı/İ the same on both sides.
 * Galatasaray vs Kocaelispor desk: Çakır / Yılmaz missed ASCII research headings;
 * other accents (é, ü, …) already worked via NFD — ı does not decompose.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  lastToken,
  matchSquadPlayer,
  namesLooselyMatch,
  normalizePlayerKey,
  stripPlayerRoleDecor,
} from "./player-name";
import { extractPlayerSections, isNameRoleHeading } from "./pack-distribute";
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

describe("Galatasaray desk — exact research headings", () => {
  const BARIS_HEAD = "Barış Alper Yılmaz (Forward / Winger - Starting XI)";
  const AYE_HEAD = "Florian Ayé (Striker - Starting XI)";
  const JANKAT_HEAD = "Jankat Yılmaz (Goalkeeper - Substitute)";
  const players = [
    { id: "p-j", name: "J. Yılmaz" },
    { id: "p-b", name: "B. Yilmaz" },
    { id: "p-a", name: "A. Yilmaz" },
    { id: "p-aye", name: "F. Aye" },
  ];

  it("strips role parens so last token is the surname not xi/striker", () => {
    assert.equal(stripPlayerRoleDecor(BARIS_HEAD), "Barış Alper Yılmaz");
    assert.equal(stripPlayerRoleDecor(AYE_HEAD), "Florian Ayé");
    assert.equal(lastToken(BARIS_HEAD), "yilmaz");
    assert.equal(lastToken(AYE_HEAD), "aye");
    assert.equal(normalizePlayerKey("Barış Alper Yılmaz"), "baris alper yilmaz");
    assert.equal(normalizePlayerKey("B. Yilmaz"), "b yilmaz");
    assert.equal(normalizePlayerKey("Florian Ayé"), "florian aye");
    assert.equal(normalizePlayerKey("F. Aye"), "f aye");
  });

  it("matches Barış heading to B. Yilmaz not A. Yilmaz / J. Yılmaz", () => {
    assert.equal(namesLooselyMatch(BARIS_HEAD, "B. Yilmaz"), true);
    assert.equal(namesLooselyMatch(BARIS_HEAD, "A. Yilmaz"), false);
    assert.equal(namesLooselyMatch(BARIS_HEAD, "J. Yılmaz"), false);
    const hit = matchSquadPlayer(BARIS_HEAD, players);
    assert.equal(hit?.id, "p-b");
  });

  it("matches Florian Ayé heading to F. Aye", () => {
    assert.equal(namesLooselyMatch(AYE_HEAD, "F. Aye"), true);
    const hit = matchSquadPlayer(AYE_HEAD, players);
    assert.equal(hit?.id, "p-aye");
  });

  it("matches Jankat heading to J. Yılmaz not Barış", () => {
    const hit = matchSquadPlayer(JANKAT_HEAD, players);
    assert.equal(hit?.id, "p-j");
  });

  it("does not attach a bare Yılmaz heading when three Yılmaz share the squad", () => {
    assert.equal(matchSquadPlayer("Yılmaz", players), null);
    assert.equal(matchSquadPlayer("Yilmaz", players), null);
  });

  it("treats Name (Role - Starting XI) lines as headings", () => {
    assert.equal(isNameRoleHeading(BARIS_HEAD), true);
    assert.equal(isNameRoleHeading(AYE_HEAD), true);
    assert.equal(isNameRoleHeading("Nightfall arrives over Seyrantepe"), false);
  });

  it("extractPlayerSections + organise attach both from the real pack shape", () => {
    const pack = `
Starting XI

Roland Sallai (Right-Back / Utility Right - Starting XI)
Narrative: Hungarian international.

${BARIS_HEAD}
Narrative: Deployed as the central striker tonight in Osimhen's absence, Yılmaz offers powerful channel running.
Season Metrics: 4 appearances (310 minutes), 6.53 average rating.

${JANKAT_HEAD}
Narrative: Young backup goalkeeper.

${AYE_HEAD}
Narrative: French striker who scored in Kocaelispor's recent victory, leading the line with intelligent movement.
Season Metrics: 2 appearances (113 minutes), 1 goal.
`;
    const squad = [
      { id: "p-sallai", name: "R. Sallai" },
      ...players,
    ];
    const sections = extractPlayerSections(pack, squad);
    const byId = Object.fromEntries(sections.map((s) => [s.player.id, s]));
    assert.ok(byId["p-b"], "Barış must attach to B. Yilmaz");
    assert.ok(byId["p-aye"], "Ayé must attach to F. Aye");
    assert.ok(byId["p-j"], "Jankat must attach to J. Yılmaz");
    assert.equal(byId["p-a"], undefined, "must not steal Barış onto A. Yilmaz");
    assert.match(byId["p-b"].body, /channel running/i);
    assert.match(byId["p-aye"].body, /French striker/i);

    const organised = organiseNotebookPack({
      text: pack,
      matchId: "m1",
      homeClub: { id: "c-gala", name: "Galatasaray" },
      awayClub: { id: "c-koc", name: "Kocaelispor" },
      players: squad,
      coaches: [],
    });
    const bios = organised.notes.filter(
      (n) => n.entityType === "player" && n.category === "Bio"
    );
    const ids = new Set(bios.map((n) => n.entityId));
    assert.ok(ids.has("p-b"), "organise: B. Yilmaz bio");
    assert.ok(ids.has("p-aye"), "organise: F. Aye bio");
    assert.equal(ids.has("p-a"), false, "organise: not A. Yilmaz");
  });
});
