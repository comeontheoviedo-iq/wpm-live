/**
 * One-off: relink Fenerbahçe vs Beşiktaş desk from wrong Slovak Super Liga
 * fixture #1384125 → correct Süper Lig #1584397 and re-sync.
 */
import { prisma } from "../lib/prisma";
import { linkFixtureToMatch, syncMatchFromApiFootball } from "../lib/sync-fixture";

const MATCH_ID = "cmtol75ys0crk1bhyhj7aikkx";
const CORRECT_FIXTURE = 1584397;

async function main() {
  const match = await prisma.match.findUnique({
    where: { id: MATCH_ID },
    include: {
      homeClub: true,
      awayClub: true,
      matchDay: true,
      venue: true,
    },
  });
  if (!match) throw new Error("Match not found: " + MATCH_ID);

  console.log("Before:", {
    matchDay: match.matchDay.title,
    competition: match.matchDay.competition,
    home: `${match.homeClub.name} AF=${match.homeClub.apiFootballTeamId}`,
    away: `${match.awayClub.name} AF=${match.awayClub.apiFootballTeamId}`,
    fixtureId: match.apiFootballFixtureId,
    venue: match.venue?.name,
    score: `${match.homeScore}-${match.awayScore}`,
    status: match.status,
  });

  // Clear polluted live data from the wrong fixture before re-link
  await prisma.matchEvent.deleteMany({ where: { matchId: MATCH_ID } });
  await prisma.statistic.deleteMany({ where: { matchId: MATCH_ID } });
  await prisma.injury.deleteMany({ where: { matchId: MATCH_ID } });
  await prisma.matchOfficial.deleteMany({ where: { matchId: MATCH_ID } });

  await prisma.match.update({
    where: { id: MATCH_ID },
    data: {
      homeScore: 0,
      awayScore: 0,
      minute: 0,
      period: "pre",
      status: "Assigned",
      lineupStatus: "expected",
      venueId: null,
      predictionsAdvice: null,
      predictionsJson: null,
      h2hSummary: null,
      lastFeedSyncAt: null,
    },
  });

  // Validate + link correct fixture (throws if teams/league mismatch)
  await linkFixtureToMatch(MATCH_ID, CORRECT_FIXTURE);
  console.log("Linked fixture", CORRECT_FIXTURE);

  const result = await syncMatchFromApiFootball(MATCH_ID, {
    resetPlacements: true,
  });
  console.log("Sync result:", {
    fixtureHint: CORRECT_FIXTURE,
    lineupStatus: result.lineupStatus,
    venueName: result.venueName,
    squadHome: result.squadHome,
    squadAway: result.squadAway,
    eventCount: result.eventCount,
    status: result.match.status,
    score: `${result.match.homeScore}-${result.match.awayScore}`,
    apiFootballFixtureId: result.match.apiFootballFixtureId,
  });

  // Confirm clubs no longer full of Kosice names
  const homeSample = await prisma.player.findMany({
    where: { clubId: match.homeClubId, isStarter: true },
    select: { name: true, shirtNumber: true, apiFootballPlayerId: true },
    take: 12,
    orderBy: { shirtNumber: "asc" },
  });
  console.log("Home starters sample:", homeSample);

  const after = await prisma.match.findUnique({
    where: { id: MATCH_ID },
    include: { venue: true, matchDay: true, homeClub: true, awayClub: true },
  });
  console.log("After:", {
    competition: after?.matchDay.competition,
    fixtureId: after?.apiFootballFixtureId,
    venue: after?.venue?.name,
    venueCity: after?.venue?.city,
    home: after?.homeClub.name,
    away: after?.awayClub.name,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
