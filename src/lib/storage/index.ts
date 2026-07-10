// ストレージのエントリポイント。
//
// 呼び出し側は必ずこの facade 経由で使う:
//   import { storage, StoragePaths, type StorageBucket } from "@/lib/storage";
//
// PR-3 で bucket 対応に拡張済み。呼び出し時は bucket を必ず明示する。

import { env } from "@/lib/env";
import type { StorageDriver } from "./driver";
import { LocalDriver } from "./drivers/local";
import { VercelBlobDriver } from "./drivers/vercel-blob";

function createDriver(): StorageDriver {
  switch (env.storage.driver) {
    case "local":
      return new LocalDriver();
    case "vercel-blob":
      return new VercelBlobDriver();
    default:
      throw new Error(`storage driver "${env.storage.driver}" は未実装です`);
  }
}

export const storage: StorageDriver = createDriver();

export { StoragePaths } from "./path";
export type { StorageDriver } from "./driver";
export {
  StorageNotFoundError,
  isPrivateBucket,
  type FetchedFile,
  type PutOptions,
  type StorageBucket,
  type StoredFile,
} from "./types";
