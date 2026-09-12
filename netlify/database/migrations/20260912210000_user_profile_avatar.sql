-- Profile edit: avatar URL + optional bio/timezone
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "image" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bio" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "timezone" TEXT;
