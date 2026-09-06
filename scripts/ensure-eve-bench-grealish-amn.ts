/**
 * Ensure Jack Grealish + Ainsley Maitland-Niles on Everton matchday bench
 * for match cmtots5ds011oa69sd8ewl15x. Soft-fail unique constraints; update by name.
 * Also normalize Everton coach to David Moyes if present / not already correct.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const MATCH_ID = "cmtots5ds011oa69sd8ewl15x";

type BenchSpec = {
  names: string[];
  createName: string;
  position: string;
  preferredShirt: number;
  nationality?: string;
  age?: number;
  apiFootballPlayerId?: number;
  photoUrl?: string;
};

const BENCH: BenchSpec[] = [
  {
    names: ["Grealish", "J. Grealish", "Jack Grealish"],
    createName: "J. Grealish",
    position: "ATT",
    preferredShirt: 10,
    nationality: "England",
    age: 30,
    apiFootballPlayerId: 19187,
    photoUrl: "https://media.api-sports.io/football/players/19187.png",
  },
  {
    names: [
      "Maitland-Niles",
      "A. Maitland-Niles",
      "Ainsley Maitland-Niles",
      "Maitland Niles",
    ],
    createName: "A. Maitland-Niles",
    position: "MID",
    preferredShirt: 2,
    nationality: "England",
    age: 28,
    apiFootballPlayerId: 1456,
    photoUrl: "https://media.api-sports.io/football/players/1456.png",
  },
];

function nameHits(have: string, want: string) {
  const a = have.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const b = want.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const aLast = a.split(" ").pop() || "";
  const bLast = b.split(" ").pop() || "";
  return Boolean(
    aLast &&
      bLast &&
      (aLast === bLast || aLast.includes(bLast) || bLast.includes(aLast))
  );
}

async function pickShirt(
  clubId: string,
  preferred: number,
  existingId?: string
) {
  const used = await prisma.player.findMany({
    where: { clubId },
    select: { id: true, shirtNumber: true },
  });
  const taken = new Set(
    used.filter((p) => p.id !== existingId).map((p) => p.shirtNumber)
  );
  if (!taken.has(preferred)) return preferred;
  return null;
}

async function findFreeShirt(clubId: string, existingId?: string) {
  const used = await prisma.player.findMany({
    where: { clubId },
    select: { id: true, shirtNumber: true },
  });
  const taken = new Set(
    used.filter((p) => p.id !== existingId).map((p) => p.shirtNumber)
  );
  for (let n = 90; n <= 99; n++) if (!taken.has(n)) return n;
  for (let n = 50; n <= 89; n++) if (!taken.has(n)) return n;
  return 99;
}

async function ensureBench(clubId: string, spec: BenchSpec) {
  const players = await prisma.player.findMany({ where: { clubId } });
  let hit =
    players.find((p) => spec.names.some((n) => nameHits(p.name, n))) ||
    (spec.apiFootballPlayerId
      ? players.find((p) => p.apiFootballPlayerId === spec.apiFootballPlayerId)
      : undefined);

  if (hit) {
    const shirt =
      (await pickShirt(clubId, spec.preferredShirt, hit.id)) ?? hit.shirtNumber;
    try {
      const updated = await prisma.player.update({
        where: { id: hit.id },
        data: {
          position: spec.position,
          shirtNumber: shirt,
          isStarter: false,
          onPitch: false,
          formationSlot: "BENCH",
          isCaptain: false,
          ...(spec.nationality ? { nationality: spec.nationality } : {}),
          ...(spec.age != null ? { age: spec.age } : {}),
          ...(spec.photoUrl && !hit.photoUrl ? { photoUrl: spec.photoUrl } : {}),
          ...(spec.apiFootballPlayerId && !hit.apiFootballPlayerId
            ? { apiFootballPlayerId: spec.apiFootballPlayerId }
            : {}),
        },
      });
      console.log(
        `UPDATED bench: #${updated.shirtNumber} ${updated.name} (${updated.position}) slot=${updated.formationSlot}`
      );
      return updated;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`SOFT-FAIL update ${spec.createName}: ${msg}`);
      const updated = await prisma.player.update({
        where: { id: hit.id },
        data: {
          position: spec.position,
          isStarter: false,
          onPitch: false,
          formationSlot: "BENCH",
          isCaptain: false,
        },
      });
      console.log(
        `UPDATED (no shirt) bench: #${updated.shirtNumber} ${updated.name}`
      );
      return updated;
    }
  }

  let shirt =
    (await pickShirt(clubId, spec.preferredShirt)) ??
    (await findFreeShirt(clubId));
  try {
    const created = await prisma.player.create({
      data: {
        clubId,
        name: spec.createName,
        shirtNumber: shirt,
        position: spec.position,
        nationality: spec.nationality || "England",
        age: spec.age ?? null,
        photoUrl: spec.photoUrl ?? null,
        apiFootballPlayerId: spec.apiFootballPlayerId ?? null,
        isStarter: false,
        onPitch: false,
        formationSlot: "BENCH",
        isCaptain: false,
      },
    });
    console.log(
      `CREATED bench: #${created.shirtNumber} ${created.name} (${created.position})`
    );
    return created;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`SOFT-FAIL create ${spec.createName}: ${msg}`);
    shirt = await findFreeShirt(clubId);
    try {
      const created = await prisma.player.create({
        data: {
          clubId,
          name: spec.createName,
          shirtNumber: shirt,
          position: spec.position,
          nationality: spec.nationality || "England",
          isStarter: false,
          onPitch: false,
          formationSlot: "BENCH",
        },
      });
      console.log(
        `CREATED (free shirt) bench: #${created.shirtNumber} ${created.name}`
      );
      return created;
    } catch (e2: unknown) {
      console.log(
        `SOFT-FAIL create retry ${spec.createName}: ${
          e2 instanceof Error ? e2.message : e2
        }`
      );
      return null;
    }
  }
}

async function fixCoach(clubId: string) {
  const coaches = await prisma.coach.findMany({ where: { clubId } });
  console.log(
    "\nCoaches before:",
    coaches.map((c) => `${c.name} (${c.role})`).join(", ") || "(none)"
  );

  const baines = coaches.find((c) => /baines|leighton/i.test(c.name));
  if (baines) {
    const updated = await prisma.coach.update({
      where: { id: baines.id },
      data: {
        name: "David Moyes",
        role: "Head Coach",
        nationality: "Scotland",
        age: 62,
        photoUrl: "https://media.api-sports.io/football/coachs/5662.png",
        apiFootballCoachId: 5662,
      },
    });
    console.log(`FIXED Baines -> ${updated.name}`);
    return updated;
  }

  const moyes = coaches.find((c) => /moyes/i.test(c.name));
  if (moyes) {
    if (moyes.name !== "David Moyes") {
      const updated = await prisma.coach.update({
        where: { id: moyes.id },
        data: { name: "David Moyes", role: moyes.role || "Head Coach" },
      });
      console.log(`Normalized coach name: ${moyes.name} -> ${updated.name}`);
      return updated;
    }
    console.log(`Coach already correct: ${moyes.name}`);
    return moyes;
  }

  if (coaches.length === 0) {
    const created = await prisma.coach.create({
      data: {
        clubId,
        name: "David Moyes",
        role: "Head Coach",
        nationality: "Scotland",
        age: 62,
        photoUrl: "https://media.api-sports.io/football/coachs/5662.png",
        apiFootballCoachId: 5662,
      },
    });
    console.log(`CREATED coach: ${created.name}`);
    return created;
  }

  console.log(
    "No Baines; leaving existing coaches as-is:",
    coaches.map((c) => c.name).join(", ")
  );
  return coaches[0];
}

async function fixManagerNote(matchId: string) {
  const notes = await prisma.note.findMany({
    where: {
      matchId,
      OR: [
        { title: { contains: "Manager" } },
        { body: { contains: "Everton Manager" } },
      ],
    },
  });
  for (const n of notes) {
    if (
      /Baines|Unknown \[Match Context\]/i.test(n.body) ||
      /Everton Manager:\*\* Unknown/i.test(n.body)
    ) {
      const body = n.body
        .replace(
          /\*\*Everton Manager:\*\*\s*Unknown[^\n]*/i,
          "**Everton Manager:** David Moyes [Match Context]. Touchline suspensions/bans: none listed [Match Context]."
        )
        .replace(/Baines/gi, "David Moyes")
        .replace(/Leighton/gi, "David");
      await prisma.note.update({ where: { id: n.id }, data: { body } });
      console.log(`Updated Manager note ${n.id}`);
    } else {
      console.log(`Manager note OK / no Baines: ${n.title}`);
    }
  }

  const bad = await prisma.note.findMany({
    where: {
      OR: [
        { title: { contains: "Baines" } },
        { body: { contains: "Baines" } },
        { title: { contains: "Leighton" } },
      ],
    },
  });
  for (const n of bad) {
    console.log(`Found Baines note: ${n.id} ${n.title} match=${n.matchId}`);
  }
}

async function main() {
  const match = await prisma.match.findUnique({ where: { id: MATCH_ID } });
  if (!match) throw new Error("Match not found: " + MATCH_ID);
  console.log("Match", MATCH_ID, "homeClubId", match.homeClubId);

  for (const spec of BENCH) {
    await ensureBench(match.homeClubId, spec);
  }

  const coach = await fixCoach(match.homeClubId);
  await fixManagerNote(MATCH_ID);

  const bench = await prisma.player.findMany({
    where: { clubId: match.homeClubId, formationSlot: "BENCH" },
    orderBy: { shirtNumber: "asc" },
    select: {
      shirtNumber: true,
      name: true,
      position: true,
      isStarter: true,
      onPitch: true,
    },
  });
  console.log("\n=== EVE BENCH NOW ===");
  for (const p of bench) {
    console.log(
      `  #${p.shirtNumber} ${p.name} (${p.position}) starter=${p.isStarter} onPitch=${p.onPitch}`
    );
  }
  console.log("Coach showing:", coach?.name);

  const speaks = await prisma.speak.findMany({
    where: { matchId: MATCH_ID },
    orderBy: { order: "asc" },
    select: { title: true, timing: true, order: true },
  });
  console.log("\n=== SPEAKS ===");
  for (const s of speaks) console.log(`  [${s.order}] ${s.timing} | ${s.title}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
