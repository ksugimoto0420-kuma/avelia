-- CreateEnum
CREATE TYPE "FulfillmentSource" AS ENUM ('IN_HOUSE', 'WAREHOUSE');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "fulfillmentSource" "FulfillmentSource" NOT NULL DEFAULT 'IN_HOUSE';
