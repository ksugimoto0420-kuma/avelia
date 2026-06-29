-- DropForeignKey
ALTER TABLE "kuji_campaigns" DROP CONSTRAINT IF EXISTS "kuji_campaigns_eventId_fkey";

-- AlterTable
ALTER TABLE "kuji_campaigns" DROP COLUMN IF EXISTS "eventId";
