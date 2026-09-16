-- Per-commentator player card aliases (phonetic/display name + optional photo)
CREATE TABLE IF NOT EXISTS "UserPlayerAlias" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "apiFootballPlayerId" INTEGER NOT NULL,
    "displayName" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserPlayerAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserPlayerAlias_userId_apiFootballPlayerId_key" ON "UserPlayerAlias"("userId", "apiFootballPlayerId");
CREATE INDEX IF NOT EXISTS "UserPlayerAlias_userId_idx" ON "UserPlayerAlias"("userId");
CREATE INDEX IF NOT EXISTS "UserPlayerAlias_apiFootballPlayerId_idx" ON "UserPlayerAlias"("apiFootballPlayerId");

DO $$ BEGIN
  ALTER TABLE "UserPlayerAlias" ADD CONSTRAINT "UserPlayerAlias_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
