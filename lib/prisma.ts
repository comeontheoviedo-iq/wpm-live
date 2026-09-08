import { PrismaClient } from "@prisma/client";

// Netlify Database provisions NETLIFY_DB_URL; Prisma datasource expects DATABASE_URL.
if (!process.env.DATABASE_URL?.trim() && process.env.NETLIFY_DB_URL?.trim()) {
  process.env.DATABASE_URL = process.env.NETLIFY_DB_URL;
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
