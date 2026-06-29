-- CreateEnum
CREATE TYPE "KujiStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "KujiPrizeType" AS ENUM ('LIMITED', 'PROBABILITY');

-- CreateTable
CREATE TABLE "kuji_campaigns" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "bannerImageUrl" TEXT,
    "eventId" TEXT,
    "artistId" TEXT,
    "saleStartAt" TIMESTAMP(3) NOT NULL,
    "saleEndAt" TIMESTAMP(3) NOT NULL,
    "pricePerDraw" INTEGER NOT NULL,
    "deliveryNote" TEXT,
    "notesText" TEXT,
    "status" "KujiStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kuji_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kuji_prizes" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "rank" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "variantNote" TEXT,
    "type" "KujiPrizeType" NOT NULL,
    "totalCount" INTEGER,
    "remainingCount" INTEGER,
    "probabilityWeight" INTEGER,
    "bundleOnly" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "kuji_prizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kuji_bundles" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "drawCount" INTEGER NOT NULL,
    "priceTotal" INTEGER NOT NULL,
    "bonusPrizeId" TEXT,
    "sku" TEXT,

    CONSTRAINT "kuji_bundles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kuji_draws" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "prizeId" TEXT NOT NULL,
    "isBundleBonus" BOOLEAN NOT NULL DEFAULT false,
    "drawnAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kuji_draws_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kuji_campaigns_status_idx" ON "kuji_campaigns"("status");

-- CreateIndex
CREATE INDEX "kuji_campaigns_saleStartAt_saleEndAt_idx" ON "kuji_campaigns"("saleStartAt", "saleEndAt");

-- CreateIndex
CREATE INDEX "kuji_prizes_campaignId_order_idx" ON "kuji_prizes"("campaignId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "kuji_bundles_sku_key" ON "kuji_bundles"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "kuji_bundles_campaignId_drawCount_key" ON "kuji_bundles"("campaignId", "drawCount");

-- CreateIndex
CREATE INDEX "kuji_draws_campaignId_drawnAt_idx" ON "kuji_draws"("campaignId", "drawnAt");

-- CreateIndex
CREATE INDEX "kuji_draws_userId_idx" ON "kuji_draws"("userId");

-- CreateIndex
CREATE INDEX "kuji_draws_orderId_idx" ON "kuji_draws"("orderId");

-- AddForeignKey
ALTER TABLE "kuji_campaigns" ADD CONSTRAINT "kuji_campaigns_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kuji_campaigns" ADD CONSTRAINT "kuji_campaigns_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "artists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kuji_prizes" ADD CONSTRAINT "kuji_prizes_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "kuji_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kuji_bundles" ADD CONSTRAINT "kuji_bundles_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "kuji_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kuji_bundles" ADD CONSTRAINT "kuji_bundles_bonusPrizeId_fkey" FOREIGN KEY ("bonusPrizeId") REFERENCES "kuji_prizes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kuji_draws" ADD CONSTRAINT "kuji_draws_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "kuji_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kuji_draws" ADD CONSTRAINT "kuji_draws_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kuji_draws" ADD CONSTRAINT "kuji_draws_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kuji_draws" ADD CONSTRAINT "kuji_draws_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "kuji_prizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
