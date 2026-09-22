import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyFotMobLineup,
  withinFotMobApplyWindow,
  withinFotMobPollWindow,
  compareStarterSurnames,
  sidesMatchOfficial,
  buildVerifyResult,
  normalizeFotMobMatchDetails,
  mapFotMobStartersToClubPlayers,
  scoreFotMobDateMatch,
  isActiveCommentaryDesk,
  surnameKey,
  FOTMOB_APPLY_WINDOW_MIN,
} from "./fotmob-lineup";

describe("classifyFotMobLineup", () => {
  it("treats standard + enetpulse as confirmed", () => {
    assert.equal(
      classifyFotMobLineup({
        lineupType: "standard",
        source: "enetpulse",
        homeStarters: 11,
        awayStarters: 11,
      }),
      "confirmed"
    );
  });

  it("treats lastStarting11 as predicted", () => {
    assert.equal(
      classifyFotMobLineup({
        lineupType: "lastStarting11",
        source: "lastStartingLineups",
        homeStarters: 11,
        awayStarters: 11,
      }),
      "predicted"
    );
  });

  it("returns none when empty", () => {
    assert.equal(
      classifyFotMobLineup({
        lineupType: null,
        source: null,
        homeStarters: 0,
        awayStarters: 0,
      }),
      "none"
    );
  });
});

describe("T−30 Apply gate", () => {
  const ko = new Date("2026-09-22T18:00:00.000Z");

  it("allows Apply at T−30", () => {
    assert.equal(
      withinFotMobApplyWindow(ko, new Date("2026-09-22T17:30:00.000Z")),
      true
    );
  });

  it("allows Apply at T−1", () => {
    assert.equal(
      withinFotMobApplyWindow(ko, new Date("2026-09-22T17:59:00.000Z")),
      true
    );
  });

  it("rejects Apply at T−31", () => {
    assert.equal(
      withinFotMobApplyWindow(ko, new Date("2026-09-22T17:29:00.000Z")),
      false
    );
  });

  it("rejects Apply after kickoff", () => {
    assert.equal(
      withinFotMobApplyWindow(ko, new Date("2026-09-22T18:00:01.000Z")),
      false
    );
  });

  it("poll window is wider than apply", () => {
    assert.equal(FOTMOB_APPLY_WINDOW_MIN, 30);
    assert.equal(
      withinFotMobPollWindow(ko, new Date("2026-09-22T15:30:00.000Z")),
      true
    );
    assert.equal(
      withinFotMobApplyWindow(ko, new Date("2026-09-22T15:30:00.000Z")),
      false
    );
  });
});

describe("surname compare", () => {
  it("matches accented surnames", () => {
    const diff = compareStarterSurnames(
      ["Glódís Viggósdóttir", "Alex Greenwood"],
      ["Glodis Viggósdóttir", "A. Greenwood"]
    );
    assert.equal(diff.matched.length, 2);
    assert.equal(diff.onlyOurs.length, 0);
    assert.equal(diff.onlyFotmob.length, 0);
  });

  it("flags mismatch starters", () => {
    const diff = compareStarterSurnames(
      ["Will Norris", "Adam Smith"],
      ["Will Norris", "Jane Doe"]
    );
    assert.ok(diff.onlyOurs.some((n) => /Smith/.test(n)));
    assert.ok(diff.onlyFotmob.some((n) => /Doe/.test(n)));
  });

  it("surnameKey folds accents", () => {
    assert.equal(surnameKey("Çakır"), surnameKey("Cakir"));
  });
});

describe("buildVerifyResult gates", () => {
  const kickoff = new Date("2026-09-22T18:00:00.000Z");
  const nowInWindow = new Date("2026-09-22T17:45:00.000Z");
  const names11 = (prefix: string) =>
    Array.from({ length: 11 }, (_, i) => `${prefix} Player${i}`);

  it("canApply only when confirmed + T−30 + desk active + mismatch/predicted ours", () => {
    const fotmob = normalizeFotMobMatchDetails(
      {
        content: {
          lineup: {
            lineupType: "standard",
            source: "enetpulse",
            homeTeam: {
              name: "Home",
              formation: "4-3-3",
              starters: names11("H").map((name) => ({ name })),
            },
            awayTeam: {
              name: "Away",
              formation: "4-3-3",
              starters: names11("A").map((name) => ({ name })),
            },
          },
        },
      },
      12345,
      nowInWindow
    );
    assert.equal(fotmob.classification, "confirmed");

    const r = buildVerifyResult({
      deskActive: true,
      kickoff,
      ourLineupSourceKind: "predicted",
      ourHomeStarters: names11("H"),
      ourAwayStarters: names11("A"),
      fotmob,
      now: nowInWindow,
    });
    assert.equal(r.fotmobConfirmed, true);
    assert.equal(r.canApply, true);
    assert.equal(r.status, "fotmob_official_ours_predicted");
  });

  it("hides Apply when FotMob is predicted lastStarting11", () => {
    const fotmob = normalizeFotMobMatchDetails(
      {
        content: {
          lineup: {
            lineupType: "lastStarting11",
            source: "lastStartingLineups",
            homeTeam: {
              formation: "4-3-3",
              starters: names11("H").map((name) => ({ name })),
            },
            awayTeam: {
              formation: "4-3-3",
              starters: names11("A").map((name) => ({ name })),
            },
          },
        },
      },
      99,
      nowInWindow
    );
    const r = buildVerifyResult({
      deskActive: true,
      kickoff,
      ourLineupSourceKind: "predicted",
      ourHomeStarters: names11("X"),
      ourAwayStarters: names11("Y"),
      fotmob,
      now: nowInWindow,
    });
    assert.equal(r.fotmobConfirmed, false);
    assert.equal(r.canApply, false);
    assert.equal(r.status, "fotmob_pending");
  });

  it("canApply false outside T−30 even if confirmed mismatch", () => {
    const early = new Date("2026-09-22T16:00:00.000Z");
    const fotmob = normalizeFotMobMatchDetails(
      {
        content: {
          lineup: {
            lineupType: "standard",
            source: "enetpulse",
            homeTeam: {
              formation: "4-3-3",
              starters: names11("H").map((name) => ({ name })),
            },
            awayTeam: {
              formation: "4-3-3",
              starters: names11("A").map((name) => ({ name })),
            },
          },
        },
      },
      1,
      early
    );
    const r = buildVerifyResult({
      deskActive: true,
      kickoff,
      ourLineupSourceKind: "predicted",
      ourHomeStarters: names11("Z"),
      ourAwayStarters: names11("Q"),
      fotmob,
      now: early,
    });
    assert.equal(r.withinApplyWindow, false);
    assert.equal(r.canApply, false);
  });

  it("matches when Official surnames align", () => {
    const home = names11("Home");
    const away = names11("Away");
    const fotmob = normalizeFotMobMatchDetails(
      {
        content: {
          lineup: {
            lineupType: "standard",
            source: "enetpulse",
            homeTeam: {
              formation: "4-3-3",
              starters: home.map((name) => ({ name })),
            },
            awayTeam: {
              formation: "4-3-3",
              starters: away.map((name) => ({ name })),
            },
          },
        },
      },
      2,
      nowInWindow
    );
    const r = buildVerifyResult({
      deskActive: true,
      kickoff,
      ourLineupSourceKind: "official",
      ourHomeStarters: home,
      ourAwayStarters: away,
      fotmob,
      now: nowInWindow,
    });
    assert.equal(r.status, "matches");
    assert.equal(r.canApply, false);
  });
});

describe("mapFotMobStartersToClubPlayers", () => {
  it("maps by fuzzy name and lists unmapped", () => {
    const club = [
      { id: "1", name: "Will Norris", shirtNumber: 1 },
      { id: "2", name: "Tom Scarr", shirtNumber: 5 },
      { id: "3", name: "Someone Else", shirtNumber: 9 },
    ];
    const { mapped, unmapped } = mapFotMobStartersToClubPlayers({
      starters: [
        { name: "W. Norris", shirtNumber: 1 },
        { name: "Thomas Scarr", shirtNumber: 5 },
        { name: "Unknown Striker", shirtNumber: 99 },
      ],
      formation: "4-3-3",
      fallbackFormation: "4-3-3",
      clubPlayers: club,
    });
    assert.equal(mapped.length, 2);
    assert.equal(unmapped.length, 1);
    assert.match(unmapped[0].fotmobName, /Unknown/);
  });
});

describe("desk + date score helpers", () => {
  it("active desks include Preparation and Live", () => {
    assert.equal(isActiveCommentaryDesk("Preparation"), true);
    assert.equal(isActiveCommentaryDesk("Live"), true);
    assert.equal(isActiveCommentaryDesk("Full Time"), false);
  });

  it("scores home+away name hits highly", () => {
    const score = scoreFotMobDateMatch(
      {
        id: 1,
        homeName: "Salford City",
        awayName: "Sheffield Wednesday",
        utcTime: "2026-09-22T18:00:00.000Z",
        leagueName: "EFL Trophy",
      },
      ["Salford City", "Salford"],
      ["Sheffield Wednesday", "Sheff Wed"],
      new Date("2026-09-22T18:00:00.000Z")
    );
    assert.ok(score >= 100);
  });
});

describe("sidesMatchOfficial", () => {
  it("requires strong overlap both sides", () => {
    const good = compareStarterSurnames(
      Array.from({ length: 11 }, (_, i) => `A Sur${i}`),
      Array.from({ length: 11 }, (_, i) => `A Sur${i}`)
    );
    assert.equal(sidesMatchOfficial(good, good), true);
    const bad = compareStarterSurnames(
      Array.from({ length: 11 }, (_, i) => `A Sur${i}`),
      Array.from({ length: 11 }, (_, i) => `B Other${i}`)
    );
    assert.equal(sidesMatchOfficial(bad, good), false);
  });
});
