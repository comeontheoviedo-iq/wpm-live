import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { organiseNotebookPack } from "./notebook-organise";

const homeClub = { id: "club-aus", name: "Australia" };
const awayClub = { id: "club-bra", name: "Brazil" };
const coaches = [
  {
    id: "coach-popovic",
    name: "Tony Popovic",
    clubId: "club-aus",
    side: "home" as const,
  },
  {
    id: "coach-ancelotti",
    name: "Carlo Ancelotti",
    clubId: "club-bra",
    side: "away" as const,
  },
];

describe("organiseNotebookPack — international coach notes", () => {
  it("attaches Manager Profile: Name headings to coach entities", () => {
    const text = `
## Manager Profile: Tony Popovic
Australia manager since 2024. Compact block, high press. World Cup prep.

## Manager Profile: Carlo Ancelotti
Brazil head coach. Calm touchline presence. Rotates midfield carefully.
`;
    const organised = organiseNotebookPack({
      text,
      matchId: "m1",
      homeClub,
      awayClub,
      players: [],
      coaches,
    });
    const coachNotes = organised.notes.filter((n) => n.entityType === "coach");
    assert.ok(
      coachNotes.some(
        (n) => n.entityId === "coach-popovic" && /Popovic/i.test(n.title)
      ),
      `expected Popovic coach note, got ${JSON.stringify(coachNotes.map((n) => n.title + "|" + n.entityId))}`
    );
    assert.ok(
      coachNotes.some(
        (n) => n.entityId === "coach-ancelotti" && /Ancelotti/i.test(n.title)
      ),
      `expected Ancelotti coach note, got ${JSON.stringify(coachNotes.map((n) => n.title + "|" + n.entityId))}`
    );
  });

  it("attaches bare person headings under Manager Profiles to coaches (intl dump)", () => {
    // Notebook often uses a container + bare coach names (no "manager" in child heading)
    const text = `
## Manager Profiles
Shared intro for both dugouts.

### Tony Popovic
Australia manager. Compact 4-2-3-1, presses from the front. Caps note filler here.

### Carlo Ancelotti
Brazil head coach. Experienced tournament operator. Squad rotation plans.
`;
    const organised = organiseNotebookPack({
      text,
      matchId: "m1",
      homeClub,
      awayClub,
      players: [],
      coaches,
    });
    const coachNotes = organised.notes.filter((n) => n.entityType === "coach");
    assert.ok(
      coachNotes.some((n) => n.entityId === "coach-popovic"),
      `Popovic missing: ${JSON.stringify(coachNotes)}`
    );
    assert.ok(
      coachNotes.some((n) => n.entityId === "coach-ancelotti"),
      `Ancelotti missing: ${JSON.stringify(coachNotes)}`
    );
  });

  it("synthesises side coach notes when coach rows are missing (pre-sync)", () => {
    const text = `
### Tony Popovic
Australia manager. High press, set-piece focus, World Cup cycle notes here.

### Carlo Ancelotti
Brazil head coach. Calm presence, manages minutes across the tournament.
`;
    const organised = organiseNotebookPack({
      text,
      matchId: "m1",
      homeClub,
      awayClub,
      players: [],
      coaches: [],
    });
    const coachNotes = organised.notes.filter((n) => n.entityType === "coach");
    assert.ok(
      coachNotes.some(
        (n) =>
          (n.entityId === "home-coach" || /Popovic/i.test(n.title + n.body)) &&
          /Popovic|Australia manager/i.test(n.title + n.body)
      ),
      `expected home/Popovic synthetic, got ${JSON.stringify(coachNotes)}`
    );
    assert.ok(
      coachNotes.some(
        (n) =>
          (n.entityId === "away-coach" || /Ancelotti/i.test(n.title + n.body)) &&
          /Ancelotti|Brazil head coach/i.test(n.title + n.body)
      ),
      `expected away/Ancelotti synthetic, got ${JSON.stringify(coachNotes)}`
    );
  });
});
