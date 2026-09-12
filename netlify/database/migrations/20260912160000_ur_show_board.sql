-- U&R Show board MVP
CREATE TABLE IF NOT EXISTS "UrShow" (
    "id" TEXT NOT NULL,
    "matchDayId" TEXT NOT NULL,
    "claimedByUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Planned',
    "youtubeWatchUrl" TEXT,
    "restreamExternalUrl" TEXT,
    "ytTitle" TEXT,
    "ytDescription" TEXT,
    "igStillUrl" TEXT,
    "restreamEventStubId" TEXT,
    "youtubeUpcomingStubId" TEXT,
    "handoffReadyAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UrShow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UrShow_matchDayId_key" ON "UrShow"("matchDayId");
CREATE INDEX IF NOT EXISTS "UrShow_claimedByUserId_idx" ON "UrShow"("claimedByUserId");

CREATE TABLE IF NOT EXISTS "UrCreative" (
    "id" TEXT NOT NULL,
    "urShowId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "canvaId" TEXT,
    "canvaUrl" TEXT,
    "assetUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UrCreative_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UrCreative_urShowId_idx" ON "UrCreative"("urShowId");

CREATE TABLE IF NOT EXISTS "UrSocialSlot" (
    "id" TEXT NOT NULL,
    "urShowId" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'youtube',
    "copy" TEXT NOT NULL DEFAULT '',
    "assetUrl" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "scheduledAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "creativeKind" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UrSocialSlot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UrSocialSlot_urShowId_slotKey_key" ON "UrSocialSlot"("urShowId", "slotKey");
CREATE INDEX IF NOT EXISTS "UrSocialSlot_urShowId_idx" ON "UrSocialSlot"("urShowId");

CREATE TABLE IF NOT EXISTS "UrHandoffLog" (
    "id" TEXT NOT NULL,
    "urShowId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payloadJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UrHandoffLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UrHandoffLog_urShowId_idx" ON "UrHandoffLog"("urShowId");

DO $$ BEGIN
  ALTER TABLE "UrShow" ADD CONSTRAINT "UrShow_matchDayId_fkey" FOREIGN KEY ("matchDayId") REFERENCES "MatchDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "UrCreative" ADD CONSTRAINT "UrCreative_urShowId_fkey" FOREIGN KEY ("urShowId") REFERENCES "UrShow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "UrSocialSlot" ADD CONSTRAINT "UrSocialSlot_urShowId_fkey" FOREIGN KEY ("urShowId") REFERENCES "UrShow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "UrHandoffLog" ADD CONSTRAINT "UrHandoffLog_urShowId_fkey" FOREIGN KEY ("urShowId") REFERENCES "UrShow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

