-- #33 Phase 1-B: 商品種別 3値 を Product に追加
-- ProductKind enum を作成し、products.productKind カラムを追加する。
-- 既存レコードは PHYSICAL でフォールバックする。

-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('PHYSICAL', 'DIGITAL_PHOTO_SIGN', 'DIGITAL_VIDEO_SIGN');

-- AlterTable
ALTER TABLE "products"
  ADD COLUMN "productKind" "ProductKind" NOT NULL DEFAULT 'PHYSICAL';
