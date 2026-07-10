-- #15 PR-3: bucket 分割対応
-- DigitalContent.fileKey / baseImageKey、DigitalDelivery.fileKey が
-- どの storage bucket に属するかを明示するカラムを追加する。
-- 既存レコードは private-digital / private-admin にフォールバックする。

-- AlterTable: digital_contents
ALTER TABLE "digital_contents"
  ADD COLUMN "storageBucket" TEXT NOT NULL DEFAULT 'private-digital',
  ADD COLUMN "baseImageBucket" TEXT NOT NULL DEFAULT 'private-admin';

-- AlterTable: digital_deliveries
ALTER TABLE "digital_deliveries"
  ADD COLUMN "storageBucket" TEXT NOT NULL DEFAULT 'private-digital';
