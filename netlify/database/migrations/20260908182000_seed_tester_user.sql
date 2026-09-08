-- Second demo account for external tester (idempotent).
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
  'cmseedtester0000000000001',
  'tester@cocomms.online',
  '$2b$10$3ge8p3KLM00smwaTpIHCUOjoMK5GP7sIi2NFB1DZoTLmrdctLD6VS',
  'Guest Tester',
  'commentator',
  'GT',
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
