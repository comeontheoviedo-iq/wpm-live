-- Polar customer / subscription ids (temporary MoR while Stripe parked)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "polarCustomerId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "polarSubscriptionId" TEXT;
