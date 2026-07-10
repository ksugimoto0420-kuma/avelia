// ストレージドライバーが取り扱う共通型。
//
// PR-3 で bucket 概念を導入。docs/storage-strategy.md Section 3, 5 参照。

/**
 * ストレージバケット (用途別コンテナ)。
 *
 * Vercel Blob ではストア単位。ローカルでは ./storage/<bucket>/ サブディレクトリで表現する。
 * 現状の実装で有効な bucket:
 *   - private-digital : 購入者向けデジタルコンテンツ (写真集PDF、サイン動画等)
 *   - private-admin   : 管理者作業用素材 (サイン用ベース画像、CSV出力等)
 *
 * 型としては仕様書 Section 3 の全4種を定義しておく (public-assets, private-temp)。
 * これらは Route Handler での参照はあるが実際の書き込みは PR-4 以降または未実装。
 */
export type StorageBucket =
  | "public-assets"
  | "private-digital"
  | "private-admin"
  | "private-temp";

/** バケットが private かどうか。 */
export function isPrivateBucket(bucket: StorageBucket): boolean {
  return bucket !== "public-assets";
}

/** 保存済みファイルの参照情報。 */
export type StoredFile = {
  /** どの bucket に保存されたか。 */
  bucket: StorageBucket;
  /** ストレージ内のキー（ローカルなら storage/<bucket>/<key>、Blob なら pathname）。 */
  key: string;
  /**
   * 呼び出し側から使う参照URL。
   * ローカル環境や private バケットでは認可付き Route Handler のパス、
   * public バケットでは CDN 上の直接URLが入る。
   */
  url: string;
};

/** ファイル取得結果（Route Handler で Response を作るための最小データ）。 */
export type FetchedFile = {
  /** バイナリ本体。 */
  buffer: Buffer;
};

/** put 呼び出し時のオプション。 */
export type PutOptions = {
  bucket: StorageBucket;
  /** パスプレフィックス。末尾のランダムサフィックスとファイル拡張子は自動付与。 */
  pathnamePrefix: string;
};

/** ストレージから見えないと判断された時に投げるエラー。 */
export class StorageNotFoundError extends Error {
  constructor(bucket: StorageBucket, key: string) {
    super(`storage object not found: ${bucket}/${key}`);
    this.name = "StorageNotFoundError";
  }
}
