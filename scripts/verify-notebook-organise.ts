import { PrismaClient } from "@prisma/client";
import {
  looksLikeNotebookPack,
  organiseNotebookPack,
} from "../lib/notebook-organise";
import { formatDistributeSummary, emptyDistributed } from "../lib/pack-distribute";

const p = new PrismaClient();
const MATCH = "cmtol75ys0crk1bhyhj7aikkx";

async function main() {
  const m = await p.match.findUnique({
    where: { id: MATCH },
    include: {
      homeClub: { include: { players: true, coaches: true } },
      awayClub: { include: { players: true, coaches: true } },
      packSections: true,
    },
  });
  if (!m) throw new Error("no match");
  const research = m.packSections.find((s) => s.templateKey === "research");
  if (!research?.content) throw new Error("no research");
  console.log("looksLike", looksLikeNotebookPack(research.content));
  const organised = organiseNotebookPack({
    text: research.content,
    matchId: MATCH,
    homeClub: { id: m.homeClub.id, name: m.homeClub.name },
    awayClub: { id: m.awayClub.id, name: m.awayClub.name },
    players: [
      ...m.homeClub.players.map((x) => ({ id: x.id, name: x.name })),
      ...m.awayClub.players.map((x) => ({ id: x.id, name: x.name })),
    ],
    coaches: [
      ...m.homeClub.coaches.map((c) => ({
        id: c.id,
        name: c.name,
        clubId: c.clubId,
        side: "home" as const,
      })),
      ...m.awayClub.coaches.map((c) => ({
        id: c.id,
        name: c.name,
        clubId: c.clubId,
        side: "away" as const,
      })),
    ],
  });
  const d = emptyDistributed();
  d.playerNotes = organised.summary.playerNotes;
  d.coachNotes = organised.summary.coachNotes;
  d.hookNotes = organised.summary.hookNotes;
  d.clubNotes = organised.summary.clubNotes;
  d.leagueNotes = organised.summary.leagueNotes;
  d.matchNotes = organised.summary.matchNotes;
  d.intro = organised.summary.intro ? 1 : 0;
  d.lineup = organised.summary.lineup ? 1 : 0;
  console.log("summary", organised.summary);
  console.log("format", formatDistributeSummary(d));
  console.log(
    "speaks",
    organised.speaks.map((s) => ({ t: s.title, len: s.body.length }))
  );
  console.log(
    "players",
    organised.notes
      .filter((n) => n.entityType === "player" && n.category === "Bio")
      .map((n) => n.title)
  );
  console.log(
    "coaches",
    organised.notes.filter((n) => n.entityType === "coach").map((n) => n.title)
  );
  console.log(
    "hooks sample",
    organised.notes
      .filter((n) => n.category === "Hook" && n.entityType === "match")
      .slice(0, 6)
      .map((n) => n.title)
  );
  console.log(
    "match",
    organised.notes
      .filter((n) => n.entityType === "match" && n.category !== "Hook")
      .map((n) => n.title)
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
