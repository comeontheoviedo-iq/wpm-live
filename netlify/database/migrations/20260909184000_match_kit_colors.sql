-- Per-match strip / kit colours from feed lineups
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "homeKitJson" TEXT;
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "awayKitJson" TEXT;
