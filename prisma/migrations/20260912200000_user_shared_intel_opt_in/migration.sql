-- Account-level opt-in for CoComms shared intel pool (default OFF)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sharedIntelOptIn" BOOLEAN NOT NULL DEFAULT false;
