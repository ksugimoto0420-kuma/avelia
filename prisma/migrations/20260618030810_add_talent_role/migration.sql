-- AlterEnum
ALTER TYPE "AdminRole" ADD VALUE 'TALENT';

-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN     "assignedArtistId" TEXT;

-- CreateIndex
CREATE INDEX "admin_users_assignedArtistId_idx" ON "admin_users"("assignedArtistId");

-- AddForeignKey
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_assignedArtistId_fkey" FOREIGN KEY ("assignedArtistId") REFERENCES "artists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
