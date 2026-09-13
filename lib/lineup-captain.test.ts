import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  afLineupCaptainPlayerIds,
  isAfLineupCaptain,
  planCaptainWrites,
} from "./lineup-captain";
import { mapAfFixturePlayersToRows } from "./live-stat-triggers";

describe("isAfLineupCaptain", () => {
  it("is true only for explicit AF true on row or player", () => {
    assert.equal(isAfLineupCaptain(null), false);
    assert.equal(isAfLineupCaptain({}), false);
    assert.equal(isAfLineupCaptain({ player: { id: 1 } }), false);
    assert.equal(isAfLineupCaptain({ captain: false, player: { captain: false } }), false);
    assert.equal(isAfLineupCaptain({ captain: true, player: { id: 1 } }), true);
    assert.equal(isAfLineupCaptain({ player: { id: 1, captain: true } }), true);
  });
});

describe("afLineupCaptainPlayerIds", () => {
  it("collects AF ids from startXI and bench", () => {
    assert.deepEqual(
      afLineupCaptainPlayerIds({
        startXI: [
          { player: { id: 10, captain: false } },
          { player: { id: 22, captain: true } },
        ],
        substitutes: [{ captain: true, player: { id: 99 } }],
      }),
      [22, 99]
    );
  });

  it("returns empty when AF omitted captain", () => {
    assert.deepEqual(
      afLineupCaptainPlayerIds({
        startXI: [{ player: { id: 1 } }, { player: { id: 2 } }],
      }),
      []
    );
  });
});

describe("planCaptainWrites", () => {
  it("does not invent when AF sent no captain field", () => {
    assert.deepEqual(
      planCaptainWrites([
        { playerId: "a", captain: false },
        { playerId: "b" },
      ]),
      { apply: false, playerIds: [] }
    );
  });

  it("writes mapped captains and allows a clear-all when AF said nobody", () => {
    assert.deepEqual(
      planCaptainWrites([
        { playerId: "a", captain: true, captainKnown: true },
        { playerId: "b", captain: false, captainKnown: true },
      ]),
      { apply: true, playerIds: ["a"] }
    );
    assert.deepEqual(
      planCaptainWrites([
        { playerId: "a", captain: false, captainKnown: true },
        { playerId: "b", captain: false, captainKnown: true },
      ]),
      { apply: true, playerIds: [] }
    );
  });

  it("does not wipe when the only captain failed to map", () => {
    assert.deepEqual(
      planCaptainWrites([
        { playerId: null, captain: true, captainKnown: true },
        { playerId: "b", captain: false, captainKnown: true },
      ]),
      { apply: false, playerIds: [] }
    );
  });
});


describe("mapAfFixturePlayersToRows captain", () => {
  it("extracts games.captain without inventing", () => {
    const rows = mapAfFixturePlayersToRows({
      homeAfTeamId: 1,
      awayAfTeamId: 2,
      localByAfId: new Map([[10, "local-a"], [20, "local-b"]]),
      teams: [
        {
          team: { id: 1, name: "Home" },
          players: [
            {
              player: { id: 10, name: "Cap" },
              statistics: [{ games: { captain: true, minutes: 90 } }],
            },
            {
              player: { id: 11, name: "Other" },
              statistics: [{ games: { captain: false, minutes: 90 } }],
            },
          ],
        },
        {
          team: { id: 2, name: "Away" },
          players: [
            {
              player: { id: 20, name: "AwayCap" },
              statistics: [{ games: { minutes: 90 } }],
            },
          ],
        },
      ],
    });
    const homeCap = rows.find((r) => r.name === "Cap");
    const homeOther = rows.find((r) => r.name === "Other");
    const away = rows.find((r) => r.name === "AwayCap");
    assert.equal(homeCap?.captain, true);
    assert.equal(homeCap?.captainKnown, true);
    assert.equal(homeCap?.playerId, "local-a");
    assert.equal(homeOther?.captain, false);
    assert.equal(homeOther?.captainKnown, true);
    assert.equal(away?.captain, false);
    assert.equal(away?.captainKnown, false);
  });
});
