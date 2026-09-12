-- U&R Enable auto-provision state (cleared when destination URLs written back)
ALTER TABLE "UrShow" ADD COLUMN IF NOT EXISTS "provisioningStatus" TEXT NOT NULL DEFAULT 'idle';
