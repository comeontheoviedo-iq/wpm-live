import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const FORMATION_433 = ["GK", "RB", "RCB", "LCB", "LB", "RCM", "CM", "LCM", "RW", "ST", "LW"];
const FORMATION_4231 = ["GK", "RB", "RCB", "LCB", "LB", "RDM", "LDM", "RAM", "CAM", "LAM", "ST"];

type SquadPlayer = {
  name: string;
  shirtNumber: number;
  position: string;
  nationality?: string;
  age?: number;
  isCaptain?: boolean;
  isStarter?: boolean;
  formationSlot?: string;
  goals?: number;
  assists?: number;
  appearances?: number;
  cleanSheets?: number;
};

function makeSquad(
  starters: SquadPlayer[],
  bench: SquadPlayer[]
): SquadPlayer[] {
  return [...starters, ...bench];
}

async function main() {
  // Wipe in dependency order
  await prisma.penaltyRecord.deleteMany();
  await prisma.seasonKeeper.deleteMany();
  await prisma.seasonScorer.deleteMany();
  await prisma.statistic.deleteMany();
  await prisma.injury.deleteMany();
  await prisma.matchEvent.deleteMany();
  await prisma.checklistItem.deleteMany();
  await prisma.speak.deleteMany();
  await prisma.note.deleteMany();
  await prisma.matchOfficial.deleteMany();
  await prisma.match.deleteMany();
  await prisma.matchDay.deleteMany();
  await prisma.official.deleteMany();
  await prisma.coach.deleteMany();
  await prisma.player.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.club.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("demo1234", 10);
  const user = await prisma.user.create({
    data: {
      email: "demo@pitchline.app",
      passwordHash,
      name: "Chris Beaumont",
      role: "commentator",
      avatarInitials: "CB",
      theme: "system",
    },
  });

  const clubsData = [
    {
      name: "Oviedo Athletic",
      shortName: "Oviedo",
      abbreviation: "OVA",
      primaryColor: "#0d9488",
      secondaryColor: "#f0fdfa",
      founded: 1903,
      city: "Oviedo",
      stadiumName: "Estadio Norte",
      nickname: "Los Verdes",
      fansApprox: 12400,
      badgeEmoji: "🟢",
    },
    {
      name: "Whitby Mariners",
      shortName: "Whitby",
      abbreviation: "WHM",
      primaryColor: "#1d4ed8",
      secondaryColor: "#dbeafe",
      founded: 1881,
      city: "Whitby",
      stadiumName: "Harbour Road",
      nickname: "The Mariners",
      fansApprox: 4800,
      badgeEmoji: "⚓",
    },
    {
      name: "Scarborough Cliffs",
      shortName: "Scarborough",
      abbreviation: "SBC",
      primaryColor: "#b45309",
      secondaryColor: "#ffedd5",
      founded: 1879,
      city: "Scarborough",
      stadiumName: "Cliffside Park",
      nickname: "The Cliffs",
      fansApprox: 6200,
      badgeEmoji: "🏔️",
    },
    {
      name: "York Minster FC",
      shortName: "York",
      abbreviation: "YMF",
      primaryColor: "#7c3aed",
      secondaryColor: "#ede9fe",
      founded: 1922,
      city: "York",
      stadiumName: "Minster Meadows",
      nickname: "The Bells",
      fansApprox: 9100,
      badgeEmoji: "🔔",
    },
    {
      name: "Harrogate Spa",
      shortName: "Harrogate",
      abbreviation: "HSP",
      primaryColor: "#be123c",
      secondaryColor: "#ffe4e6",
      founded: 1914,
      city: "Harrogate",
      stadiumName: "Spa Ground",
      nickname: "The Waters",
      fansApprox: 5500,
      badgeEmoji: "💧",
    },
    {
      name: "Darlington Quakers",
      shortName: "Darlington",
      abbreviation: "DAQ",
      primaryColor: "#0f766e",
      secondaryColor: "#ccfbf1",
      founded: 1883,
      city: "Darlington",
      stadiumName: "Quaker Arena",
      nickname: "The Quakers",
      fansApprox: 7200,
      badgeEmoji: "🖤",
    },
    {
      name: "Middlesbrough North",
      shortName: "MB North",
      abbreviation: "MBN",
      primaryColor: "#dc2626",
      secondaryColor: "#fee2e2",
      founded: 1951,
      city: "Middlesbrough",
      stadiumName: "Northbank",
      nickname: "The Bank",
      fansApprox: 8300,
      badgeEmoji: "🔴",
    },
    {
      name: "Hull Dockers",
      shortName: "Hull",
      abbreviation: "HDC",
      primaryColor: "#ca8a04",
      secondaryColor: "#fef9c3",
      founded: 1904,
      city: "Hull",
      stadiumName: "Dockside",
      nickname: "The Dockers",
      fansApprox: 10100,
      badgeEmoji: "🚢",
    },
  ];

  const clubs = [];
  for (const c of clubsData) {
    clubs.push(await prisma.club.create({ data: c }));
  }
  const [oviedo, whitby, scarborough, york, harrogate, darlington, mbNorth, hull] =
    clubs;

  // Full squads for featured match: Oviedo vs Whitby
  const oviedoStarters: SquadPlayer[] = [
    { name: "Mateo Ruiz", shirtNumber: 1, position: "GK", nationality: "ESP", age: 29, isStarter: true, formationSlot: "GK", cleanSheets: 8, appearances: 18 },
    { name: "Callum Briggs", shirtNumber: 2, position: "RB", nationality: "ENG", age: 24, isStarter: true, formationSlot: "RB", appearances: 17 },
    { name: "Iker Navarro", shirtNumber: 5, position: "CB", nationality: "ESP", age: 31, isCaptain: true, isStarter: true, formationSlot: "RCB", appearances: 18 },
    { name: "Tom Ashford", shirtNumber: 4, position: "CB", nationality: "ENG", age: 27, isStarter: true, formationSlot: "LCB", appearances: 16 },
    { name: "Luis Ortega", shirtNumber: 3, position: "LB", nationality: "ESP", age: 25, isStarter: true, formationSlot: "LB", appearances: 15, assists: 4 },
    { name: "Danny Croft", shirtNumber: 8, position: "CM", nationality: "ENG", age: 26, isStarter: true, formationSlot: "RCM", goals: 3, assists: 5, appearances: 18 },
    { name: "Pablo Serra", shirtNumber: 6, position: "CM", nationality: "ESP", age: 28, isStarter: true, formationSlot: "CM", goals: 2, appearances: 17 },
    { name: "Jamie Vale", shirtNumber: 10, position: "CM", nationality: "WAL", age: 23, isStarter: true, formationSlot: "LCM", goals: 6, assists: 7, appearances: 18 },
    { name: "Noah Ellison", shirtNumber: 7, position: "RW", nationality: "ENG", age: 22, isStarter: true, formationSlot: "RW", goals: 8, assists: 3, appearances: 16 },
    { name: "Diego Marín", shirtNumber: 9, position: "ST", nationality: "ESP", age: 30, isStarter: true, formationSlot: "ST", goals: 14, assists: 2, appearances: 18 },
    { name: "Sam Okoro", shirtNumber: 11, position: "LW", nationality: "NGA", age: 24, isStarter: true, formationSlot: "LW", goals: 7, assists: 6, appearances: 17 },
  ];
  const oviedoBench: SquadPlayer[] = [
    { name: "Ben Hartley", shirtNumber: 13, position: "GK", age: 21, appearances: 2 },
    { name: "Ryan Moss", shirtNumber: 12, position: "CB", age: 20, appearances: 6 },
    { name: "Elliot Quinn", shirtNumber: 14, position: "CM", age: 19, appearances: 8, goals: 1 },
    { name: "Marcus Doyle", shirtNumber: 15, position: "ST", age: 27, appearances: 12, goals: 4 },
    { name: "Finn O'Shea", shirtNumber: 16, position: "RW", nationality: "IRL", age: 22, appearances: 10, goals: 2 },
    { name: "Adam Percival", shirtNumber: 17, position: "LB", age: 25, appearances: 7 },
    { name: "Kai Nakamura", shirtNumber: 18, position: "CAM", nationality: "JPN", age: 23, appearances: 11, goals: 3, assists: 4 },
  ];

  const whitbyStarters: SquadPlayer[] = [
    { name: "Harry Salt", shirtNumber: 1, position: "GK", age: 32, isStarter: true, formationSlot: "GK", cleanSheets: 6, appearances: 18 },
    { name: "Joe Redpath", shirtNumber: 22, position: "RB", age: 26, isStarter: true, formationSlot: "RB", appearances: 15 },
    { name: "Craig Dunne", shirtNumber: 5, position: "CB", nationality: "SCO", age: 33, isCaptain: true, isStarter: true, formationSlot: "RCB", appearances: 17 },
    { name: "Will Fenwick", shirtNumber: 6, position: "CB", age: 28, isStarter: true, formationSlot: "LCB", appearances: 18 },
    { name: "Kyle Shore", shirtNumber: 3, position: "LB", age: 24, isStarter: true, formationSlot: "LB", appearances: 16, assists: 2 },
    { name: "Pete Langley", shirtNumber: 4, position: "CDM", age: 29, isStarter: true, formationSlot: "RDM", appearances: 18, goals: 1 },
    { name: "Omar Hassan", shirtNumber: 8, position: "CDM", nationality: "EGY", age: 27, isStarter: true, formationSlot: "LDM", appearances: 14, assists: 3 },
    { name: "Reece Dalton", shirtNumber: 7, position: "RM", age: 23, isStarter: true, formationSlot: "RAM", goals: 5, assists: 4, appearances: 17 },
    { name: "Leo Park", shirtNumber: 10, position: "CAM", nationality: "KOR", age: 25, isStarter: true, formationSlot: "CAM", goals: 9, assists: 8, appearances: 18 },
    { name: "Connor Blythe", shirtNumber: 11, position: "LM", age: 22, isStarter: true, formationSlot: "LAM", goals: 4, assists: 5, appearances: 16 },
    { name: "Jamie Garside", shirtNumber: 9, position: "ST", age: 28, isStarter: true, formationSlot: "ST", goals: 11, assists: 1, appearances: 17 },
  ];
  const whitbyBench: SquadPlayer[] = [
    { name: "Luke Fenby", shirtNumber: 21, position: "GK", age: 20, appearances: 1 },
    { name: "Dan Cotter", shirtNumber: 14, position: "CB", age: 24, appearances: 9 },
    { name: "Tyrese Cole", shirtNumber: 16, position: "CM", age: 21, appearances: 10, goals: 1 },
    { name: "Aaron Pike", shirtNumber: 18, position: "ST", age: 26, appearances: 13, goals: 5 },
    { name: "Seb North", shirtNumber: 19, position: "RW", age: 19, appearances: 7, goals: 1 },
    { name: "Mitch Avery", shirtNumber: 15, position: "LB", age: 27, appearances: 8 },
    { name: "Hugo Klein", shirtNumber: 20, position: "CAM", nationality: "GER", age: 24, appearances: 11, assists: 3 },
  ];

  async function createPlayers(clubId: string, squad: SquadPlayer[]) {
    const created = [];
    for (const p of squad) {
      created.push(
        await prisma.player.create({
          data: {
            clubId,
            name: p.name,
            shirtNumber: p.shirtNumber,
            position: p.position,
            nationality: p.nationality || "ENG",
            age: p.age,
            isCaptain: p.isCaptain || false,
            isStarter: p.isStarter || false,
            formationSlot: p.formationSlot,
            goals: p.goals || 0,
            assists: p.assists || 0,
            appearances: p.appearances || 0,
            cleanSheets: p.cleanSheets || 0,
          },
        })
      );
    }
    return created;
  }

  const oviedoPlayers = await createPlayers(
    oviedo.id,
    makeSquad(oviedoStarters, oviedoBench)
  );
  const whitbyPlayers = await createPlayers(
    whitby.id,
    makeSquad(whitbyStarters, whitbyBench)
  );

  // Lighter squads for other clubs (for scorers/keepers tables)
  async function lightSquad(
    clubId: string,
    names: { name: string; pos: string; no: number; goals?: number; cs?: number }[]
  ) {
    const out = [];
    for (const n of names) {
      out.push(
        await prisma.player.create({
          data: {
            clubId,
            name: n.name,
            shirtNumber: n.no,
            position: n.pos,
            goals: n.goals || 0,
            cleanSheets: n.cs || 0,
            appearances: 14,
            isStarter: true,
          },
        })
      );
    }
    return out;
  }

  const scarboroughPlayers = await lightSquad(scarborough.id, [
    { name: "Greg Holt", pos: "ST", no: 9, goals: 12 },
    { name: "Ian Preece", pos: "GK", no: 1, cs: 5 },
    { name: "Ned Waller", pos: "CM", no: 8, goals: 4 },
  ]);
  const yorkPlayers = await lightSquad(york.id, [
    { name: "Oliver Kent", pos: "ST", no: 9, goals: 10 },
    { name: "Max Ridley", pos: "GK", no: 1, cs: 7 },
    { name: "Chris Bell", pos: "RW", no: 7, goals: 6 },
  ]);
  const harrogatePlayers = await lightSquad(harrogate.id, [
    { name: "Jake Rivers", pos: "ST", no: 10, goals: 9 },
    { name: "Paul Sykes", pos: "GK", no: 1, cs: 4 },
  ]);
  const darlingtonPlayers = await lightSquad(darlington.id, [
    { name: "Stevie Quinn", pos: "ST", no: 9, goals: 8 },
    { name: "Neil Booth", pos: "GK", no: 1, cs: 6 },
  ]);
  const mbPlayers = await lightSquad(mbNorth.id, [
    { name: "Ryan Frost", pos: "ST", no: 9, goals: 7 },
    { name: "Alex Dunn", pos: "GK", no: 1, cs: 3 },
  ]);
  const hullPlayers = await lightSquad(hull.id, [
    { name: "Tony Drake", pos: "ST", no: 9, goals: 13 },
    { name: "Sam Wylie", pos: "GK", no: 1, cs: 5 },
  ]);

  await prisma.coach.createMany({
    data: [
      { clubId: oviedo.id, name: "Héctor Valdés", nationality: "ESP", age: 48, role: "Head Coach" },
      { clubId: whitby.id, name: "Mick Harland", nationality: "ENG", age: 55, role: "Head Coach" },
      { clubId: scarborough.id, name: "Dave Cullen", nationality: "ENG", age: 51 },
      { clubId: york.id, name: "Sarah Lindley", nationality: "ENG", age: 42 },
      { clubId: harrogate.id, name: "Phil Garside", nationality: "ENG", age: 49 },
      { clubId: darlington.id, name: "Alan Crowe", nationality: "ENG", age: 57 },
      { clubId: mbNorth.id, name: "Tony Vickers", nationality: "ENG", age: 46 },
      { clubId: hull.id, name: "Marco Silva Jr", nationality: "POR", age: 44 },
    ],
  });

  const venue = await prisma.venue.create({
    data: {
      name: "Estadio Norte",
      city: "Oviedo",
      capacity: 14200,
      surface: "Hybrid grass",
      opened: 1958,
      address: "Avenida del Norte 12, Oviedo",
      pitchLength: 105,
      pitchWidth: 68,
      notes:
        "Steep main stand; away fans in North End. Strong wind corridor from west side. Broadcast gantry above West Stand.",
    },
  });

  await prisma.venue.createMany({
    data: [
      { name: "Harbour Road", city: "Whitby", capacity: 5200, surface: "Grass", opened: 1920 },
      { name: "Cliffside Park", city: "Scarborough", capacity: 6800, surface: "Grass", opened: 1898 },
      { name: "Minster Meadows", city: "York", capacity: 9800, surface: "Hybrid grass", opened: 2007 },
    ],
  });

  const officials = await Promise.all([
    prisma.official.create({ data: { name: "Rebecca Shaw", role: "Referee", age: 36 } }),
    prisma.official.create({ data: { name: "Tom Hargreaves", role: "Assistant", age: 41 } }),
    prisma.official.create({ data: { name: "Priya Patel", role: "Assistant", age: 33 } }),
    prisma.official.create({ data: { name: "Ian Crooks", role: "Fourth Official", age: 45 } }),
  ]);

  const kickoff = new Date();
  kickoff.setHours(kickoff.getHours() + 3);
  kickoff.setMinutes(0, 0, 0);

  const matchDay = await prisma.matchDay.create({
    data: {
      title: "Matchday 19 — Northern Premier Demo League",
      date: kickoff,
      competition: "Northern Premier Demo League",
      userId: user.id,
      status: "upcoming",
    },
  });

  const featured = await prisma.match.create({
    data: {
      matchDayId: matchDay.id,
      homeClubId: oviedo.id,
      awayClubId: whitby.id,
      venueId: venue.id,
      kickoff,
      status: "Preparation",
      homeFormation: "4-3-3",
      awayFormation: "4-2-3-1",
      weatherSummary: "Partly cloudy, brisk westerly",
      weatherTempC: 14,
      weatherWindKph: 22,
      weatherHumidity: 68,
      attendance: null,
      featured: true,
    },
  });

  // Additional fixtures same matchday
  const otherFixtures = [
    [scarborough, york],
    [harrogate, darlington],
    [mbNorth, hull],
  ] as const;
  for (const [h, a] of otherFixtures) {
    const t = new Date(kickoff);
    t.setHours(t.getHours() + 1);
    await prisma.match.create({
      data: {
        matchDayId: matchDay.id,
        homeClubId: h.id,
        awayClubId: a.id,
        kickoff: t,
        status: "Assigned",
        weatherSummary: "Clear",
        weatherTempC: 13,
        weatherWindKph: 12,
        weatherHumidity: 60,
      },
    });
  }

  // Second matchday upcoming
  const later = new Date(kickoff);
  later.setDate(later.getDate() + 7);
  const md2 = await prisma.matchDay.create({
    data: {
      title: "Matchday 20 — Northern Premier Demo League",
      date: later,
      competition: "Northern Premier Demo League",
      userId: user.id,
    },
  });
  await prisma.match.create({
    data: {
      matchDayId: md2.id,
      homeClubId: whitby.id,
      awayClubId: york.id,
      kickoff: later,
      status: "Assigned",
    },
  });

  for (const o of officials) {
    await prisma.matchOfficial.create({
      data: {
        matchId: featured.id,
        officialId: o.id,
        role: o.role,
      },
    });
  }

  // Speaks
  const speaks = [
    {
      title: "Open — League context",
      timing: "pre-match",
      order: 1,
      body: "Welcome to Estadio Norte. Oviedo Athletic sit third in the Northern Premier Demo League, two points off the summit. Whitby Mariners arrive in sixth after three straight draws. Tonight's fixture often decides who stays in the promotion conversation.",
    },
    {
      title: "Team news — Oviedo",
      timing: "pre-match",
      order: 2,
      body: "Héctor Valdés names an unchanged XI. Diego Marín leads the line on 14 goals; Noah Ellison and Sam Okoro stretch the flanks in a classic 4-3-3. Iker Navarro captains from centre-half.",
    },
    {
      title: "Team news — Whitby",
      timing: "pre-match",
      order: 3,
      body: "Mick Harland sticks with 4-2-3-1. Leo Park is the creative hub — 9 goals, 8 assists. Jamie Garside the focal point up top. Watch the double pivot of Langley and Hassan screening the back four.",
    },
    {
      title: "Key battle",
      timing: "pre-match",
      order: 4,
      body: "Jamie Vale vs Leo Park in midfield. Vale's late runs into the box have been Oviedo's secret weapon; Park's through-balls unlock Whitby's counters.",
    },
    {
      title: "Kick-off cue",
      timing: "kickoff",
      order: 5,
      body: "Referee Rebecca Shaw ready. Estadio Norte under lights. Oviedo in teal, Whitby in navy. Away support packed into the North End — roughly 800 travelling Mariners tonight.",
    },
    {
      title: "Half-time package",
      timing: "half-time",
      order: 6,
      body: "Recap xG if available, note set-piece counts, and remind listeners of Marín's penalty duties. Flag any yellow cards that put players on a tightrope.",
    },
    {
      title: "Closing template",
      timing: "full-time",
      order: 7,
      body: "Confirm final score, scorers, and next fixtures. Mention attendance once announced. Tease Matchday 20.",
    },
  ];
  for (const s of speaks) {
    await prisma.speak.create({
      data: { ...s, matchId: featured.id, userId: user.id },
    });
  }

  // Checklist
  const checklist = [
    { label: "Confirm starting XIs with both clubs", category: "prep", order: 1, done: true },
    { label: "Load speaks & timing cues", category: "prep", order: 2, done: true },
    { label: "Review injury list & late changes", category: "prep", order: 3, done: true },
    { label: "Check referee & officials board", category: "prep", order: 4, done: true },
    { label: "Weather & pitch report from groundstaff", category: "prep", order: 5, done: false },
    { label: "Test headset & backup mic", category: "tech", order: 6, done: true },
    { label: "Sync live event composer shortcuts", category: "tech", order: 7, done: false },
    { label: "Print squad sheets (A4)", category: "export", order: 8, done: false },
    { label: "Confirm sponsor reads", category: "on-air", order: 9, done: false },
    { label: "Ready for Go Live", category: "on-air", order: 10, done: false },
  ];
  for (const c of checklist) {
    await prisma.checklistItem.create({
      data: { ...c, matchId: featured.id },
    });
  }

  await prisma.note.createMany({
    data: [
      {
        matchId: featured.id,
        userId: user.id,
        title: "Wind note",
        body: "Westerly 22 kph — expect long balls to hold up toward the West Stand first half.",
        category: "venue",
      },
      {
        matchId: featured.id,
        userId: user.id,
        title: "Form guide",
        body: "Oviedo: WWDWL. Whitby: DDDWL. Whitby unbeaten in 5 but scoring drought (1 goal in 3).",
        category: "form",
      },
    ],
  });

  // Injuries
  const marin = oviedoPlayers.find((p) => p.name === "Diego Marín")!;
  const ortega = oviedoPlayers.find((p) => p.name === "Luis Ortega")!;
  const salt = whitbyPlayers.find((p) => p.name === "Harry Salt")!;
  const blythe = whitbyPlayers.find((p) => p.name === "Connor Blythe")!;
  const moss = oviedoPlayers.find((p) => p.name === "Ryan Moss")!;

  await prisma.injury.createMany({
    data: [
      {
        matchId: featured.id,
        clubId: oviedo.id,
        playerId: ortega.id,
        status: "fit",
        injuryType: "Ankle sprain",
        expectedReturn: "Available",
        notes: "Returned to full training Wednesday. Starts.",
      },
      {
        matchId: featured.id,
        clubId: oviedo.id,
        playerId: moss.id,
        status: "out",
        injuryType: "Hamstring",
        expectedReturn: "2–3 weeks",
        notes: "Ruled out. On bench only as emergency.",
      },
      {
        matchId: featured.id,
        clubId: whitby.id,
        playerId: blythe.id,
        status: "doubtful",
        injuryType: "Knee knock",
        expectedReturn: "Matchday decision",
        notes: "Travelled; late fitness test passed — starts.",
      },
      {
        matchId: featured.id,
        clubId: whitby.id,
        playerId: salt.id,
        status: "fit",
        injuryType: "Shoulder (managed)",
        expectedReturn: "Available",
        notes: "Ongoing management; no issue expected.",
      },
    ],
  });

  // Season scorers / keepers / penalties
  const scorerRows: { clubId: string; playerId: string; goals: number; assists: number; rank: number }[] = [
    { clubId: oviedo.id, playerId: marin.id, goals: 14, assists: 2, rank: 1 },
    { clubId: hull.id, playerId: hullPlayers[0].id, goals: 13, assists: 1, rank: 2 },
    { clubId: scarborough.id, playerId: scarboroughPlayers[0].id, goals: 12, assists: 3, rank: 3 },
    { clubId: whitby.id, playerId: whitbyPlayers.find((p) => p.name === "Jamie Garside")!.id, goals: 11, assists: 1, rank: 4 },
    { clubId: york.id, playerId: yorkPlayers[0].id, goals: 10, assists: 2, rank: 5 },
    { clubId: whitby.id, playerId: whitbyPlayers.find((p) => p.name === "Leo Park")!.id, goals: 9, assists: 8, rank: 6 },
    { clubId: harrogate.id, playerId: harrogatePlayers[0].id, goals: 9, assists: 4, rank: 7 },
    { clubId: oviedo.id, playerId: oviedoPlayers.find((p) => p.name === "Noah Ellison")!.id, goals: 8, assists: 3, rank: 8 },
    { clubId: darlington.id, playerId: darlingtonPlayers[0].id, goals: 8, assists: 2, rank: 9 },
    { clubId: oviedo.id, playerId: oviedoPlayers.find((p) => p.name === "Sam Okoro")!.id, goals: 7, assists: 6, rank: 10 },
  ];
  for (const s of scorerRows) {
    await prisma.seasonScorer.create({ data: s });
  }

  const keeperRows = [
    { clubId: oviedo.id, playerId: oviedoPlayers[0].id, cleanSheets: 8, saves: 52, appearances: 18, rank: 1 },
    { clubId: york.id, playerId: yorkPlayers[1].id, cleanSheets: 7, saves: 48, appearances: 18, rank: 2 },
    { clubId: whitby.id, playerId: salt.id, cleanSheets: 6, saves: 61, appearances: 18, rank: 3 },
    { clubId: darlington.id, playerId: darlingtonPlayers[1].id, cleanSheets: 6, saves: 55, appearances: 17, rank: 4 },
    { clubId: scarborough.id, playerId: scarboroughPlayers[1].id, cleanSheets: 5, saves: 44, appearances: 16, rank: 5 },
    { clubId: hull.id, playerId: hullPlayers[1].id, cleanSheets: 5, saves: 50, appearances: 18, rank: 6 },
  ];
  for (const k of keeperRows) {
    await prisma.seasonKeeper.create({ data: k });
  }

  await prisma.penaltyRecord.createMany({
    data: [
      {
        clubId: oviedo.id,
        playerId: marin.id,
        takerName: "Diego Marín",
        scored: 5,
        missed: 1,
        saved: 0,
        preference: "right",
        notes: "Primary taker. Soft stutter run-up.",
      },
      {
        clubId: oviedo.id,
        playerId: oviedoPlayers.find((p) => p.name === "Jamie Vale")!.id,
        takerName: "Jamie Vale",
        scored: 2,
        missed: 0,
        saved: 0,
        preference: "left",
        notes: "Backup if Marín off pitch.",
      },
      {
        clubId: whitby.id,
        playerId: whitbyPlayers.find((p) => p.name === "Leo Park")!.id,
        takerName: "Leo Park",
        scored: 4,
        missed: 0,
        saved: 1,
        preference: "right",
        notes: "Often goes low to keeper's left.",
      },
      {
        clubId: whitby.id,
        playerId: whitbyPlayers.find((p) => p.name === "Jamie Garside")!.id,
        takerName: "Jamie Garside",
        scored: 1,
        missed: 1,
        saved: 0,
        preference: "power",
        notes: "Secondary option.",
      },
    ],
  });

  await prisma.statistic.createMany({
    data: [
      { matchId: featured.id, label: "Possession", homeValue: "—", awayValue: "—", order: 1 },
      { matchId: featured.id, label: "Shots", homeValue: "0", awayValue: "0", order: 2 },
      { matchId: featured.id, label: "Shots on target", homeValue: "0", awayValue: "0", order: 3 },
      { matchId: featured.id, label: "Corners", homeValue: "0", awayValue: "0", order: 4 },
      { matchId: featured.id, label: "Fouls", homeValue: "0", awayValue: "0", order: 5 },
      { matchId: featured.id, label: "Yellow cards", homeValue: "0", awayValue: "0", order: 6 },
    ],
  });

  // Sample pre-match event log
  await prisma.matchEvent.create({
    data: {
      matchId: featured.id,
      type: "note",
      minute: 0,
      description: "Teams in tunnel — toss won by Oviedo, they kick towards North End first half.",
      commentary: "Warm-up complete. Rebecca Shaw leads the sides out.",
    },
  });

  console.log("Seed complete.");
  console.log("Demo login: demo@pitchline.app / demo1234");
  console.log("Featured match:", featured.id);
  console.log("Unused formation refs:", FORMATION_433.length, FORMATION_4231.length, mbPlayers.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
