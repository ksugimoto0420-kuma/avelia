// ストレージのエントリポイント。
//
// 呼び出し側は必ずこの facade 経由で使う:
//   import { storage } from "@/lib/storage";
//
// PR-1 では local ドライバーのみ実装。PR-2 で VercelBlobDriver を追加した際も、
// この facade の型・関数シグネチャは変わらない。
//
// 旧 src/lib/storage.ts から putFile / getSignedUrl / localFilePath を提供していたが、
// localFilePath は Route Handler から使う readFile と密結合していたので、
// ドライバー内部に閉じ込め、代わりに storage.getFile(key) を公開する。

import { env } from "@/lib/env";
import type { StorageDriver } from "./driver";
import { LocalDriver } from "./drivers/local";

function createDriver(): StorageDriver {
  switch (env.storage.driver) {
    case "local":
      return new LocalDriver();
    default:
      // 未対応ドライバーは起動時に気づけるように投げる。
      throw new Error(
        `storage driver "${env.storage.driver}" は未実装です (PR-2 以降で追加予定)`,
      );
  }
}

export const storage: StorageDriver = createDriver();

// 型は必要に応じて呼び出し側でも import できるように再エクスポート。
export type { StorageDriver } from "./driver";
export type { FetchedFile, StoredFile } from "./types";
export { StorageNotFoundError } from "./types";
