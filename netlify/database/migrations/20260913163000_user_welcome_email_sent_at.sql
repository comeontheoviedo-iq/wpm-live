-- Welcome email idempotency flag (Polar trial unlock)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "welcomeEmailSentAt" TIMESTAMP(3);
