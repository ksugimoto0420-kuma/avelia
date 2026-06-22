-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED');

-- AlterTable
ALTER TABLE "lottery_entries" ADD COLUMN     "pinReason" TEXT,
ADD COLUMN     "pinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pinnedAt" TIMESTAMP(3),
ADD COLUMN     "pinnedById" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "gender" "Gender",
ADD COLUMN     "joinedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "lottery_entries_lotteryId_pinned_idx" ON "lottery_entries"("lotteryId", "pinned");
