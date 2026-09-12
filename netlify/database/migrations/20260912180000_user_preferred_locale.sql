-- Preferred UI locale (i18n foundation)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferredLocale" TEXT NOT NULL DEFAULT 'en-GB';
