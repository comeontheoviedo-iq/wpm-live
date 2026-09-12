/**
 * Idempotent: ensure chris@ronniedogmedia.com exists on Netlify Postgres.
 * Usage:
 *   UR_CHRIS_TEMP_PASSWORD='...' node scripts/seed-chris-ur-user-prod.mjs
 * Reads DATABASE_URL / NETLIFY_DB_URL like seed-demo-users-prod.mjs.
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

const EMAIL = "chris@ronniedogmedia.com";
const password = process.env.UR_CHRIS_TEMP_PASSWORD?.trim();
if (!password || password.length < 12) {
  console.error("Set UR_CHRIS_TEMP_PASSWORD to a strong temp password (≥12 chars)");
  process.exit(1);
}

const url = resolveUrl();
if (!url) {
  console.error("seed-chris-ur-user-prod: no Postgres URL");
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    create: {
      email: EMAIL,
      passwordHash,
      name: "Chris Beaumont",
      role: "commentator",
      avatarInitials: "CB",
      theme: "system",
      billingStatus: "active",
    },
    update: {
      passwordHash,
      name: "Chris Beaumont",
      avatarInitials: "CB",
    },
  });
  console.log("seed-chris-ur-user-prod: upserted", user.email, "id=", user.id);
} catch (e) {
  console.error("seed-chris-ur-user-prod failed:", e?.message || e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
