import { PrismaClient } from "@prisma/client";
import {
  searchFixturesSmart,
  isApiFootballConfigured,
} from "../lib/api-football";
import { syncMatchFromApiFootball } from "../lib/sync-fixture";
import { DEFAULT_CHECKLIST, DEFAULT_SCRIPT_SLOTS } from "../lib/defaults";

const prisma = new PrismaClient();

async function ensureClub(name: string, afId: number, shortName?: string) {
  const byAf = await prisma.club.findFirst({ where: { apiFootballTeamId: afId } });
  if (byAf) return byAf;
  const byName = await prisma.club.findFirst({ where: { name } });
  if (byName) {
    if (byName.apiFootballTeamId == null) {
      return prisma.club.update({
        where: { id: byName.id },
        data: { apiFootballTeamId: afId },
      });
    }
    return byName;
  }
  const sn = shortName || name;
  return prisma.club.create({
    data: {
      name,
      shortName: sn,
      abbreviation: sn.slice(0, 3).toUpperCase(),
      primaryColor: name.toLowerCase().includes("ranger") ? "#1B4F9C" : "#7A0019",
      secondaryColor: "#ffffff",
      badgeEmoji: "⚽",
      apiFootballTeamId: afId,
    },
  });
}

async function findFixture() {
  const dates = ["2026-09-05", "2026-09-06", "2026-09-07", "2026-09-04"];
  const seasons = [2025, 2026, 2024];
  for (const date of dates) {
    for (const season of seasons) {
      console.log(`Searching league=179 date=${date} season=${season}`);
      try {
        const result = await searchFixturesSmart({
          date,
          league: 179,
          season,
        });
        console.log(
          `  strategy=${result.strategy} count=${result.fixtures.length} msg=${result.message || ""}`
        );
        const hit = result.fixtures.find((f) => {
          const h = f.teams.home.name.toLowerCase();
          const a = f.teams.away.name.toLowerCase();
          return (
            (h.includes("ranger") && a.includes("motherwell")) ||
            (h.includes("motherwell") && a.includes("ranger"))
          );
        });
        if (hit) return hit;
        // also try date-only
      } catch (e) {
        console.log("  error", e instanceof Error ? e.message : e);
      }
    }
  }
  // broader: team search for Rangers on date
  for (const date of ["2026-09-05", "2026-09-06"]) {
    console.log(`Searching date-only ${date} for Rangers/Motherwell`);
    try {
      const result = await searchFixturesSmart({ date });
      const hit = result.fixtures.find((f) => {
        const h = f.teams.home.name.toLowerCase();
        const a = f.teams.away.name.toLowerCase();
        const league = (f.league.name || "").toLowerCase();
        return (
          ((h.includes("ranger") && a.includes("motherwell")) ||
            (h.includes("motherwell") && a.includes("ranger"))) &&
          (league.includes("premiership") || league.includes("scotland") || f.league.id === 179)
        );
      });
      if (hit) return hit;
      const near = result.fixtures.filter((f) => {
        const n = `${f.teams.home.name} ${f.teams.away.name}`.toLowerCase();
        return n.includes("ranger") || n.includes("motherwell");
      });
      if (near.length) {
        console.log(
          "  nearby:",
          near.map(
            (f) =>
              `${f.fixture.id} ${f.teams.home.name} vs ${f.teams.away.name} ${f.fixture.date} ${f.league.name}`
          )
        );
      }
    } catch (e) {
      console.log("  error", e instanceof Error ? e.message : e);
    }
  }
  return null;
}

async function main() {
  if (!isApiFootballConfigured()) throw new Error("API_FOOTBALL_KEY missing");

  const demo = await prisma.user.findFirst({
    where: { email: "demo@pitchline.app" },
  });
  if (!demo) throw new Error("demo user not found — seed first");

  const fixture = await findFixture();
  if (!fixture) {
    console.log("FIXTURE_NOT_FOUND");
    return;
  }

  console.log(
    "FOUND",
    fixture.fixture.id,
    fixture.teams.home.name,
    "vs",
    fixture.teams.away.name,
    fixture.fixture.date,
    fixture.fixture.status.short,
    fixture.goals,
    "season",
    fixture.league.season
  );

  const existing = await prisma.match.findFirst({
    where: { apiFootballFixtureId: fixture.fixture.id },
  });
  if (existing) {
    console.log("Already linked match", existing.id, "day", existing.matchDayId);
    console.log("Syncing existing…");
    const sync = await syncMatchFromApiFootball(existing.id);
    console.log("SYNC", JSON.stringify(sync).slice(0, 500));
    console.log("URL", `http://localhost:3000/match-day/${existing.id}`);
    return;
  }

  const home = await ensureClub(fixture.teams.home.name, fixture.teams.home.id);
  const away = await ensureClub(fixture.teams.away.name, fixture.teams.away.id);
  const kickoff = new Date(fixture.fixture.date);

  const result = await prisma.$transaction(async (tx) => {
    const matchDay = await tx.matchDay.create({
      data: {
        title: `${home.shortName} vs ${away.shortName}`,
        date: kickoff,
        competition: fixture.league.name || "Scottish Premiership",
        userId: demo.id,
        status: "upcoming",
      },
    });
    const match = await tx.match.create({
      data: {
        matchDayId: matchDay.id,
        homeClubId: home.id,
        awayClubId: away.id,
        kickoff,
        status: "Assigned",
        featured: true,
        apiFootballFixtureId: fixture.fixture.id,
        homeFormation: "4-3-3",
        awayFormation: "4-2-3-1",
      },
    });
    await tx.checklistItem.createMany({
      data: DEFAULT_CHECKLIST.map((c) => ({ ...c, matchId: match.id, done: false })),
    });
    await tx.speak.createMany({
      data: DEFAULT_SCRIPT_SLOTS.map((s) => ({
        ...s,
        matchId: match.id,
        userId: demo.id,
      })),
    });
    await tx.statistic.createMany({
      data: [
        { matchId: match.id, label: "Possession", homeValue: "—", awayValue: "—", order: 1 },
        { matchId: match.id, label: "Shots", homeValue: "0", awayValue: "0", order: 2 },
        { matchId: match.id, label: "Shots on target", homeValue: "0", awayValue: "0", order: 3 },
        { matchId: match.id, label: "Corners", homeValue: "0", awayValue: "0", order: 4 },
        { matchId: match.id, label: "Fouls", homeValue: "0", awayValue: "0", order: 5 },
        { matchId: match.id, label: "Yellow cards", homeValue: "0", awayValue: "0", order: 6 },
      ],
    });
    return { matchDay, match };
  });

  console.log("Created matchDay", result.matchDay.id, "match", result.match.id);
  console.log("Syncing…");
  const sync = await syncMatchFromApiFootball(result.match.id);
  console.log("SYNC", JSON.stringify(sync, null, 2).slice(0, 1200));
  console.log("URL", `http://localhost:3000/match-day/${result.match.id}`);
  console.log("FIXTURE_ID", fixture.fixture.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
