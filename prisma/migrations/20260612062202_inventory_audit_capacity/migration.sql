-- CreateEnum
CREATE TYPE "AdjustmentReason" AS ENUM ('INITIAL', 'RESTOCK', 'LOSS', 'RETURN', 'STOCKTAKE', 'CORRECTION', 'CSV_IMPORT', 'OTHER');

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "capacity" INTEGER;

-- AlterTable
ALTER TABLE "inventories" ADD COLUMN     "lowStockAlertedAt" TIMESTAMP(3),
ADD COLUMN     "lowStockThreshold" INTEGER;

-- CreateTable
CREATE TABLE "inventory_adjustments" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "before" INTEGER NOT NULL,
    "after" INTEGER NOT NULL,
    "reason" "AdjustmentReason" NOT NULL DEFAULT 'CORRECTION',
    "note" TEXT,
    "adminUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_adjustments_inventoryId_createdAt_idx" ON "inventory_adjustments"("inventoryId", "createdAt");

-- CreateIndex
CREATE INDEX "inventory_adjustments_variantId_createdAt_idx" ON "inventory_adjustments"("variantId", "createdAt");

-- CreateIndex
CREATE INDEX "inventory_adjustments_createdAt_idx" ON "inventory_adjustments"("createdAt");

-- AddForeignKey
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "inventories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
