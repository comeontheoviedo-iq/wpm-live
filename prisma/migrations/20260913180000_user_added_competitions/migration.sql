-- User self-serve competitions + MatchDay AF league id
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "addedCompetitions" TEXT;
ALTER TABLE "MatchDay" ADD COLUMN IF NOT EXISTS "apiFootballLeagueId" INTEGER;
