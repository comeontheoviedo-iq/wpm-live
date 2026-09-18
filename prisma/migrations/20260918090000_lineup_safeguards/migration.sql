-- Lineup safeguards: source badge meta, feed freeze, per-player lock-from-feed
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "lineupSource" TEXT;
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "lineupSourceMeta" TEXT;
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "xiFeedFrozen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "xiFeedFrozenAt" TIMESTAMP(3);
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "xiFeedFrozenByUserId" TEXT;
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "xiFeedFrozenReason" TEXT;
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "xiFeedFrozenNote" TEXT;

ALTER TABLE "MatchPlayerOverride" ADD COLUMN IF NOT EXISTS "lockFromFeed" BOOLEAN NOT NULL DEFAULT false;
