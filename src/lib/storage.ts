import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

// ストレージ抽象。MVP ではローカル ./public/uploads に保存し、
// 本番では S3 互換に差し替える。デジタルコンテンツは署名付きURL想定だが、
// ローカルでは認可済み配信エンドポイント経由で配る。

// 公開ディレクトリ外に保存し、配信は認可付きルート経由にする（直アクセス防止）。
export const LOCAL_DIR = path.join(process.cwd(), "storage");

export type StoredFile = { key: string; url: string };

/** ローカル保存ファイルの絶対パスを返す（パストラバーサル防止のため key は basename 化）。 */
export function localFilePath(key: string): string {
  return path.join(LOCAL_DIR, path.basename(key));
}

/** ファイルを保存し、キーと参照URLを返す。 */
export async function putFile(
  buffer: Buffer,
  filename: string,
): Promise<StoredFile> {
  const safe = filename.replace(/[^\w.\-]+/g, "_");
  const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;

  if (env.storage.driver === "local") {
    await mkdir(LOCAL_DIR, { recursive: true });
    await writeFile(path.join(LOCAL_DIR, key), buffer);
    return { key, url: `/api/user/digital-contents/file/${encodeURIComponent(key)}` };
  }

  // TODO: S3 互換へ PutObject（本番）
  throw new Error(`storage driver ${env.storage.driver} は未実装です`);
}

/**
 * デジタルコンテンツの配信URLを返す。
 * 本番では署名付きURL（短時間有効）。ローカルでは認可済み配信API経由。
 */
export async function getSignedUrl(
  key: string,
  _expiresSeconds = 300,
): Promise<string> {
  if (env.storage.driver === "local") {
    // ローカルは認可チェック済みの配信エンドポイント経由で返す
    return `/api/user/digital-contents/file/${encodeURIComponent(key)}`;
  }
  // TODO: S3 互換の getSignedUrl
  throw new Error(`storage driver ${env.storage.driver} は未実装です`);
}
