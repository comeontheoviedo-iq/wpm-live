/**
 * Idempotent demo users for Netlify Postgres (runs at build when NETLIFY_DB_URL is set).
 * Safe no-op if no Postgres URL (local SQLite builds).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

function resolveUrl() {
  const current = process.env.DATABASE_URL?.trim() ?? "";
  const netlify = process.env.NETLIFY_DB_URL?.trim() ?? "";
  const isPg = (u) => u.startsWith("postgresql://") || u.startsWith("postgres://");
  if (isPg(current)) return current;
  if (isPg(netlify)) {
    process.env.DATABASE_URL = netlify;
    return netlify;
  }
  return null;
}

const users = [
  {
    email: "demo@pitchline.app",
    password: "demo1234",
    name: "Chris Beaumont",
    avatarInitials: "CB",
  },
  {
    email: "tester@cocomms.online",
    password: "cocommsDemo1",
    name: "Guest Tester",
    avatarInitials: "GT",
  },
];

const url = resolveUrl();
if (!url) {
  console.log("seed-demo-users-prod: no Postgres URL — skip");
  process.exit(0);
}

const prisma = new PrismaClient();
try {
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      create: {
        email: u.email,
        passwordHash,
        name: u.name,
        role: "commentator",
        avatarInitials: u.avatarInitials,
        theme: "system",
      },
      update: {
        passwordHash,
        name: u.name,
        role: "commentator",
        avatarInitials: u.avatarInitials,
      },
    });
    console.log("seed-demo-users-prod: upserted", u.email);
  }
} catch (e) {
  console.error("seed-demo-users-prod failed:", e?.message || e);
  process.exitCode = 0;
} finally {
  await prisma.$disconnect();
}
