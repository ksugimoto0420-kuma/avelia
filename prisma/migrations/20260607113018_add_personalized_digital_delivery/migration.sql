-- CreateEnum
CREATE TYPE "DigitalDeliveryType" AS ENUM ('SHARED', 'PERSONALIZED');

-- CreateEnum
CREATE TYPE "DigitalDeliveryStatus" AS ENUM ('PENDING', 'READY');

-- AlterTable
ALTER TABLE "cart_items" ADD COLUMN     "unitNicknames" JSONB;

-- AlterTable
ALTER TABLE "digital_contents" ADD COLUMN     "baseImageKey" TEXT,
ADD COLUMN     "deliveryType" "DigitalDeliveryType" NOT NULL DEFAULT 'SHARED',
ALTER COLUMN "fileKey" DROP NOT NULL;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "unitNicknames" JSONB;

-- CreateTable
CREATE TABLE "digital_deliveries" (
    "id" TEXT NOT NULL,
    "digitalContentId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "unitIndex" INTEGER NOT NULL,
    "nickname" TEXT,
    "nicknameKana" TEXT,
    "note" TEXT,
    "status" "DigitalDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "fileKey" TEXT,
    "originalFilename" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "digital_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "digital_deliveries_userId_status_idx" ON "digital_deliveries"("userId", "status");

-- CreateIndex
CREATE INDEX "digital_deliveries_status_idx" ON "digital_deliveries"("status");

-- CreateIndex
CREATE INDEX "digital_deliveries_orderId_idx" ON "digital_deliveries"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "digital_deliveries_orderItemId_digitalContentId_unitIndex_key" ON "digital_deliveries"("orderItemId", "digitalContentId", "unitIndex");

-- AddForeignKey
ALTER TABLE "digital_deliveries" ADD CONSTRAINT "digital_deliveries_digitalContentId_fkey" FOREIGN KEY ("digitalContentId") REFERENCES "digital_contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_deliveries" ADD CONSTRAINT "digital_deliveries_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_deliveries" ADD CONSTRAINT "digital_deliveries_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_deliveries" ADD CONSTRAINT "digital_deliveries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
