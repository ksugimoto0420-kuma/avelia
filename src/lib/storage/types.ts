// ストレージドライバーが取り扱う共通型。
//
// PR-1 では既存の挙動 (local ドライバー1本) をそのまま移設するため、
// 最小限の型で始める。bucket 概念や private/public 区別は PR-3 で導入する。

/** 保存済みファイルの参照情報。 */
export type StoredFile = {
  /** ストレージ内のキー（ローカルなら storage/<key>、Blob なら pathname）。 */
  key: string;
  /**
   * 呼び出し側から使う参照URL。
   * ローカル環境では認可付き Route Handler のパス、
   * Blob 環境では public バケットの直接URL などが入る。
   */
  url: string;
};

/** ファイル取得結果（Route Handler で Response を作るための最小データ）。 */
export type FetchedFile = {
  /** バイナリ本体。 */
  buffer: Buffer;
};

/** ストレージから見えないと判断された時に投げるエラー。 */
export class StorageNotFoundError extends Error {
  constructor(key: string) {
    super(`storage object not found: ${key}`);
    this.name = "StorageNotFoundError";
  }
}
