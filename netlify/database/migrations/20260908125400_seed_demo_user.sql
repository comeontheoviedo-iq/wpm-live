-- Seed demo commentator for production login (idempotent).
INSERT INTO "User" (
  "id",
  "email",
  "passwordHash",
  "name",
  "role",
  "avatarInitials",
  "theme",
  "createdAt",
  "updatedAt"
) VALUES (
  'cmseeddemo000000000000001',
  'demo@pitchline.app',
  '$2b$10$qPmdfEQFkIiLrRupRpgzaewjujT1WQA0WHsoAFOPgsEUZnrdyPqLS',
  'Chris Beaumont',
  'commentator',
  'CB',
  'system',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("email") DO UPDATE SET
  "passwordHash" = EXCLUDED."passwordHash",
  "name" = EXCLUDED."name",
  "role" = EXCLUDED."role",
  "avatarInitials" = EXCLUDED."avatarInitials",
  "theme" = EXCLUDED."theme",
  "updatedAt" = CURRENT_TIMESTAMP;
