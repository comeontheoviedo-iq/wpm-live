import { PrismaClient } from "@prisma/client";

// Netlify Database provisions NETLIFY_DB_URL; Prisma datasource expects DATABASE_URL.
// Use DATABASE_URL only when it is Postgres; otherwise fall back to NETLIFY_DB_URL.
// Ignore file: (SQLite) and other non-Postgres values so they cannot block Neon.
function resolveDatabaseUrl(): void {
  const current = process.env.DATABASE_URL?.trim() ?? "";
  const netlify = process.env.NETLIFY_DB_URL?.trim() ?? "";
  const isPostgres = (url: string) =>
    url.startsWith("postgresql://") || url.startsWith("postgres://");

  if (isPostgres(current)) return;
  if (isPostgres(netlify)) {
    process.env.DATABASE_URL = netlify;
  }
}

resolveDatabaseUrl();

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
