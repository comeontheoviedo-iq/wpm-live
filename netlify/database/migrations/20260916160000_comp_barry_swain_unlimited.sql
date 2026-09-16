-- Complimentary unlimited-forever CoComms account for Barry Swain.
-- Promised on 16 Sep 2026 call: not a 14-day trial, not billed.
-- Insert only if missing (never reset an existing password).
-- Always set billing to complimentary active with no Polar/Stripe subscription ids.

INSERT INTO "User" (
  "id",
  "email",
  "passwordHash",
  "name",
  "role",
  "avatarInitials",
  "theme",
  "timezone",
  "preferredLocale",
  "billingStatus",
  "trialEndsAt",
  "trialCancelledAt",
  "cancelAtPeriodEnd",
  "stripeSubscriptionId",
  "polarSubscriptionId",
  "matchPassCredits",
  "createdAt",
  "updatedAt"
)
SELECT
  'cmseedbarryswain000000001',
  'barryswain@live.co.uk',
  '$2b$10$UOWBLgn4Wp4KWkD2YecgnOSMvL5/45uz.fybs55IzM6t9OlyJ3cM6',
  'Barry Swain',
  'commentator',
  'BS',
  'system',
  'Europe/London',
  'en-GB',
  'active',
  NULL,
  NULL,
  FALSE,
  NULL,
  NULL,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "User" WHERE lower("email") = 'barryswain@live.co.uk'
);

UPDATE "User" SET
  "billingStatus" = 'active',
  "cancelAtPeriodEnd" = FALSE,
  "trialEndsAt" = NULL,
  "trialCancelledAt" = NULL,
  "stripeSubscriptionId" = NULL,
  "polarSubscriptionId" = NULL,
  "name" = 'Barry Swain',
  "avatarInitials" = 'BS',
  "timezone" = COALESCE("timezone", 'Europe/London'),
  "preferredLocale" = COALESCE(NULLIF("preferredLocale", ''), 'en-GB'),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE lower("email") = 'barryswain@live.co.uk';
