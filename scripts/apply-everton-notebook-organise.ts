
/**
 * One-shot: re-organise Everton–United Research Notebook paste →
 * Notes + Intro PackSection + Intro Speak (Notebook SoT).
 */
import { PrismaClient } from "@prisma/client";
import { applyPackDistribution } from "../lib/pack-distribute-apply";
import { formatDistributeSummary } from "../lib/pack-distribute";
import { leagueIdForCompetition } from "../lib/competitions";

const p = new PrismaClient();
const MATCH = "cmtots5ds011oa69sd8ewl15x";

async function main() {
  const m = await p.match.findUnique({
    where: { id: MATCH },
    include: {
      matchDay: { select: { competition: true } },
      homeClub: {
        include: {
          players: { select: { id: true, name: true } },
          coaches: { select: { id: true, name: true, clubId: true } },
        },
      },
      awayClub: {
        include: {
          players: { select: { id: true, name: true } },
          coaches: { select: { id: true, name: true, clubId: true } },
        },
      },
      packSections: true,
      speaks: true,
    },
  });
  if (!m) throw new Error("match not found");
  const research = m.packSections.find((s) => s.templateKey === "research");
  if (!research?.content?.trim()) throw new Error("no research content");

  const user =
    (await p.user.findFirst({ where: { email: "demo@pitchline.app" } })) ||
    (await p.user.findFirst());
  if (!user) throw new Error("no user");

  const beforeIntro = m.packSections.find((s) => s.templateKey === "intro");
  const beforeSpeak = m.speaks.find((s) => /intro/i.test(s.title));
  console.log("before", {
    researchLen: research.content.length,
    introPackLen: beforeIntro?.content?.length ?? 0,
    introSpeakLen: beforeSpeak?.body?.length ?? 0,
    introSpeakTitle: beforeSpeak?.title,
  });

  const distributed = await applyPackDistribution({
    matchId: MATCH,
    userId: user.id,
    templateKey: "research",
    templateTitle: research.title || "Research pack",
    content: research.content,
    homeClub: { id: m.homeClub.id, name: m.homeClub.name },
    awayClub: { id: m.awayClub.id, name: m.awayClub.name },
    allPlayers: [
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
    competition: m.matchDay.competition,
    leagueEntityId: (() => {
      const lid = leagueIdForCompetition(m.matchDay.competition);
      return lid != null ? String(lid) : m.matchDay.competition;
    })(),
  });

  console.log("distributed", formatDistributeSummary(distributed), distributed);

  const after = await p.match.findUnique({
    where: { id: MATCH },
    include: { packSections: true, speaks: true },
  });
  const introPack = after!.packSections.find((s) => s.templateKey === "intro");
  const introSpeak = after!.speaks.find((s) => /intro/i.test(s.title));
  const researchText = research.content;
  const s1 = researchText.indexOf("## SECTION 1:");
  const s2 = researchText.indexOf("## SECTION 2:");
  const section1 = s1 >= 0 && s2 > s1 ? researchText.slice(s1, s2) : "";

  function overlap(a: string, b: string) {
    const needle = "Good afternoon from the banks of the River Mersey";
    return {
      aHas: a.includes(needle),
      bHas: b.includes(needle),
      aHasColdOpen: /## Cold open/i.test(a),
      bLen: b.length,
      aLen: a.length,
      sharedPrefix: a.slice(0, 60) === b.slice(0, 60),
    };
  }

  console.log("after intro pack", {
    len: introPack?.content?.length,
    status: introPack?.status,
    head: introPack?.content?.slice(0, 100),
  });
  console.log("after intro speak", {
    title: introSpeak?.title,
    len: introSpeak?.body?.length,
    head: introSpeak?.body?.slice(0, 100),
  });
  console.log(
    "overlap pack vs SECTION1",
    overlap(introPack?.content || "", section1)
  );
  console.log(
    "overlap speak vs SECTION1",
    overlap(introSpeak?.body || "", section1)
  );
  console.log(
    "NOT old gemini cold open",
    !(introSpeak?.body || "").includes("Welcome in to Merseyside, where the waterfront")
  );

  const notes = await p.note.findMany({
    where: { matchId: MATCH },
    select: { title: true, entityType: true, entityId: true, category: true },
  });
  const club = notes.filter((n) => n.entityType === "club");
  const league = notes.filter((n) => n.entityType === "league");
  console.log("club/league note counts", {
    club: club.length,
    league: league.length,
    everton: club.filter((n) => n.entityId === m.homeClub.id).length,
    united: club.filter((n) => n.entityId === m.awayClub.id).length,
    clubTitles: club.map((n) => n.title),
    leagueTitles: league.map((n) => n.title),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
