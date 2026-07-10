import type {
  FetchedFile,
  PutOptions,
  StorageBucket,
  StoredFile,
} from "./types";

/**
 * ストレージドライバーの共通インターフェース。
 *
 * PR-3 で bucket 対応に拡張済み。呼び出し側は必ず bucket を明示的に指定する。
 * 実装ドライバーは bucket ごとに保存先やアクセスモードを切り替える。
 */
export interface StorageDriver {
  /**
   * バイナリを保存し、bucket と key、参照URLを返す。
   * filename は拡張子・オリジナル名の保持に使い、key は
   * ドライバー側で「pathnamePrefix / <random>.<ext>」形式にする。
   */
  put(buffer: Buffer, filename: string, opts: PutOptions): Promise<StoredFile>;

  /**
   * 認可済みユーザー向けの参照URLを返す。
   * private バケットでは短TTLの署名URL、
   * public バケットでは CDN の直接URLを返す (実装次第)。
   */
  getSignedUrl(
    bucket: StorageBucket,
    key: string,
    expiresSeconds?: number,
  ): Promise<string>;

  /**
   * Route Handler から呼ばれるファイル取得。
   * 存在しない場合は StorageNotFoundError を投げる。
   */
  getFile(bucket: StorageBucket, key: string): Promise<FetchedFile>;
}
