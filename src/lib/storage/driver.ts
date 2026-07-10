import type { FetchedFile, StoredFile } from "./types";

/**
 * ストレージドライバーの共通インターフェース。
 *
 * PR-1 では既存の local ドライバー挙動をそのまま移設する。
 * bucket 分割・署名URL・削除などは後続 PR で追加する。
 */
export interface StorageDriver {
  /**
   * バイナリを保存し、キーと参照URLを返す。
   * ファイル名から安全なキーを生成するのはドライバー側の責務。
   */
  put(buffer: Buffer, filename: string): Promise<StoredFile>;

  /**
   * 認可済みユーザー向けの参照URLを返す。
   * ローカルでは Route Handler 経由のパス、
   * 将来的な private バケットでは短TTLの署名URL等を返す想定。
   */
  getSignedUrl(key: string, expiresSeconds?: number): Promise<string>;

  /**
   * Route Handler から呼ばれるファイル取得。
   * 存在しない場合は StorageNotFoundError を投げる。
   *
   * 既存コードで readFile(localFilePath(key)) を直接呼んでいた箇所を
   * この API に統一することで、ドライバー差し替え時に呼び出し側を触らずに済む。
   */
  getFile(key: string): Promise<FetchedFile>;
}
