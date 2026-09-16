-- One-time admin reset: Chris Beaumont production temp password (bcrypt hash).
-- Plaintext emailed separately; passwords are hashed and cannot be resent.
UPDATE "User"
SET
  "passwordHash" = '$2b$10$sqORuvahdYDtMW9aPyTeVuTznsr1/Kt7qYmlNrIn6yxvEah1gqMKy',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "email" = 'chris@ronniedogmedia.com';
