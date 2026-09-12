-- U&R privacy: create chris@ronniedogmedia.com and reassign ALL demo desks/notes/speaks/ur shows to him.
-- Does NOT touch tester@cocomms.online. Idempotent.

INSERT INTO "User" (
  "id",
  "email",
  "passwordHash",
  "name",
  "role",
  "avatarInitials",
  "theme",
  "billingStatus",
  "matchPassCredits",
  "createdAt",
  "updatedAt"
) VALUES (
  'cmseedchrisur000000000001',
  'chris@ronniedogmedia.com',
  '$2b$10$ZSRzudn46tZqzVaEiM84uOu2H3Lq8xQ8CI4TOuqHqnvFpZyGb1Ra.',
  'Chris Beaumont',
  'commentator',
  'CB',
  'system',
  'active',
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("email") DO UPDATE SET
  "passwordHash" = EXCLUDED."passwordHash",
  "name" = EXCLUDED."name",
  "role" = EXCLUDED."role",
  "avatarInitials" = EXCLUDED."avatarInitials",
  "theme" = EXCLUDED."theme",
  "billingStatus" = EXCLUDED."billingStatus",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Reassign ownership FKs from demo → chris (preserve rows; no delete/recreate)
UPDATE "MatchDay"
SET "userId" = 'cmseedchrisur000000000001'
WHERE "userId" = 'cmseeddemo000000000000001';

UPDATE "Note"
SET "userId" = 'cmseedchrisur000000000001'
WHERE "userId" = 'cmseeddemo000000000000001';

UPDATE "Speak"
SET "userId" = 'cmseedchrisur000000000001'
WHERE "userId" = 'cmseeddemo000000000000001';

UPDATE "UrShow"
SET "claimedByUserId" = 'cmseedchrisur000000000001'
WHERE "claimedByUserId" = 'cmseeddemo000000000000001';
