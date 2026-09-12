-- Match Desk Pass credits (pay-per-match packs)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "matchPassCredits" INTEGER NOT NULL DEFAULT 0;
