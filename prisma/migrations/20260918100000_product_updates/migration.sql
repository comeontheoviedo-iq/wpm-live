-- What’s New product updates for commentators
CREATE TABLE IF NOT EXISTS "ProductUpdate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    CONSTRAINT "ProductUpdate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductUpdate_createdAt_idx" ON "ProductUpdate"("createdAt");

DO $$ BEGIN
  ALTER TABLE "ProductUpdate" ADD CONSTRAINT "ProductUpdate_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "UserProductUpdateRead" (
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserProductUpdateRead_pkey" PRIMARY KEY ("userId")
);

DO $$ BEGIN
  ALTER TABLE "UserProductUpdateRead" ADD CONSTRAINT "UserProductUpdateRead_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seed recent user-facing notes (idempotent)
INSERT INTO "ProductUpdate" ("id", "title", "body", "createdAt")
VALUES
  (
    'pu_kit_colour_override',
    'Kit colours on the desk',
    'Override outfield and GK kit colours per side when the feed gets them wrong — handy for cup kits and third strips.',
    TIMESTAMP '2026-09-16 10:00:00'
  ),
  (
    'pu_card_phonetic_photo',
    'Cards: phonetics + missing photos',
    'Player cards show phonetic names clearer, and you can upload a photo when the feed has none.',
    TIMESTAMP '2026-09-16 14:00:00'
  ),
  (
    'pu_swap_ends_labels',
    'Clearer Swap ends + faster labels',
    'Swap ends is easier to spot mid-match, and desk icon labels pop quicker so you are not hunting.',
    TIMESTAMP '2026-09-17 09:00:00'
  ),
  (
    'pu_ask_report',
    'Ask / Report on the desk',
    'Need a hand or something looks off? Use Ask / Report from the desk — it pings CoComms with optional match context.',
    TIMESTAMP '2026-09-17 16:00:00'
  ),
  (
    'pu_lineup_safeguards',
    'Lineup safeguards',
    'Official / Predicted / Last XI badge, XI lock, fixture chip, and “XI looks wrong” freeze — so you know what you are reading and can stop a bad feed overwrite.',
    TIMESTAMP '2026-09-18 07:00:00'
  )
ON CONFLICT ("id") DO NOTHING;
