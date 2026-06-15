-- CreateEnum
CREATE TYPE "SignatureStatus" AS ENUM ('WRITTEN', 'COMPLETED', 'REJECTED');

-- CreateTable
CREATE TABLE "signatures" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "imageData" BYTEA,
    "imageKey" TEXT,
    "status" "SignatureStatus" NOT NULL DEFAULT 'WRITTEN',
    "rejectReason" TEXT,
    "writtenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "composedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),

    CONSTRAINT "signatures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "signatures_deliveryId_key" ON "signatures"("deliveryId");

-- CreateIndex
CREATE INDEX "signatures_status_idx" ON "signatures"("status");

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "digital_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
