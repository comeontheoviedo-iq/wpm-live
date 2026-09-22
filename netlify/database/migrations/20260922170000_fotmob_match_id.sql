-- Silent FotMob XI verify: cache resolved FotMob match id on desk Match
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "fotmobMatchId" INTEGER;
