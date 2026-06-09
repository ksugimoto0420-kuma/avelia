-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('MEET_GREET', 'KUJI', 'TRADING_CARD', 'GOODS');

-- CreateEnum
CREATE TYPE "SaleMethod" AS ENUM ('FIRST_COME', 'LOTTERY');

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "artistName" TEXT,
ADD COLUMN     "eventDate" TIMESTAMP(3),
ADD COLUMN     "eventType" "EventType" NOT NULL DEFAULT 'MEET_GREET',
ADD COLUMN     "saleMethod" "SaleMethod" NOT NULL DEFAULT 'FIRST_COME';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "benefit" TEXT,
ADD COLUMN     "deliveryDate" TIMESTAMP(3);
