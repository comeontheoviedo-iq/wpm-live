-- In-desk Ask / Report support pings (agent pickup)
CREATE TABLE IF NOT EXISTS "SupportPing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "context" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    CONSTRAINT "SupportPing_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SupportPing_status_createdAt_idx" ON "SupportPing"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "SupportPing_userId_idx" ON "SupportPing"("userId");

DO $$ BEGIN
  ALTER TABLE "SupportPing" ADD CONSTRAINT "SupportPing_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
