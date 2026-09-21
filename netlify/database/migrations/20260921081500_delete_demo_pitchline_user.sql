-- Remove CoComms demo login demo@pitchline.app from production.
-- Explicit go-ahead 2026-09-21 (Chris Beaumont). Idempotent.
-- Does NOT touch chris@ronniedogmedia.com, barryswain@live.co.uk, tester@cocomms.online, or any other account.
-- Desks/notes/prep were previously reassigned to chris (20260912170000); this cleans any leftovers then drops the User row.

DO $$
DECLARE
  demo_id text;
BEGIN
  SELECT id INTO demo_id FROM "User" WHERE email = 'demo@pitchline.app' LIMIT 1;
  IF demo_id IS NULL THEN
    RAISE NOTICE 'demo@pitchline.app already absent — no-op';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM "User"
    WHERE id = demo_id
      AND email IN ('chris@ronniedogmedia.com', 'barryswain@live.co.uk')
  ) THEN
    RAISE EXCEPTION 'Refusing to delete protected account id %', demo_id;
  END IF;

  -- Owned desks (Match cascades to Match children; MatchDay cascades to UrShow)
  DELETE FROM "MatchDay" WHERE "userId" = demo_id;

  -- Prep rows that may still reference the user directly
  DELETE FROM "Note" WHERE "userId" = demo_id;
  DELETE FROM "Speak" WHERE "userId" = demo_id;

  -- UrShow.claimedByUserId has no FK; clear if any leftover claims
  UPDATE "UrShow" SET "claimedByUserId" = 'cmseedchrisur000000000001'
  WHERE "claimedByUserId" = demo_id
    AND EXISTS (SELECT 1 FROM "User" WHERE id = 'cmseedchrisur000000000001');

  -- User-scoped tables with onDelete: Cascade would follow; delete explicitly for clarity
  DELETE FROM "UserPlayerAlias" WHERE "userId" = demo_id;
  DELETE FROM "PasswordResetToken" WHERE "userId" = demo_id;
  DELETE FROM "SupportPing" WHERE "userId" = demo_id;
  DELETE FROM "UserProductUpdateRead" WHERE "userId" = demo_id;

  DELETE FROM "User" WHERE id = demo_id AND email = 'demo@pitchline.app';
  RAISE NOTICE 'Deleted demo@pitchline.app id %', demo_id;
END $$;
