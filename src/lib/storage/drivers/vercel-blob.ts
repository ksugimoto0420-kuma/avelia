import { get, put, BlobNotFoundError } from "@vercel/blob";
import type { StorageDriver } from "../driver";
import { StorageNotFoundError, type FetchedFile, type StoredFile } from "../types";

/**
 * Vercel Blob をバックエンドに使うドライバー。
 *
 * PR-2 では既存の LocalDriver と同じ interface で最小限の実装を提供する。
 * bucket 分割 (public / private) や複数トークン対応、bucket 別命名規約は PR-3 で導入する。
 *
 * 現時点は全ての blob を private access で扱う:
 *   - 直URL公開しない
 *   - 配信は Route Handler (認可付き) 経由で getFile() する
 *   - 既存の LocalDriver と挙動が一致するため、切替時の副作用がない
 *
 * トークンは環境変数 BLOB_READ_WRITE_TOKEN を Vercel Blob SDK が自動で読む。
 */
export class VercelBlobDriver implements StorageDriver {
  async put(buffer: Buffer, filename: string): Promise<StoredFile> {
    // ファイル名は英数記号のみを許容し、addRandomSuffix でユニーク化する。
    const safe = filename.replace(/[^\w.\-]+/g, "_");
    const result = await put(safe, buffer, {
      access: "private",
      addRandomSuffix: true,
    });
    return {
      key: result.pathname,
      // private blob の url は SDK 経由でしか使えない参考値。
      // 呼び出し側は getSignedUrl(key) で認可済み Route Handler の URL を得るのが前提。
      url: `/api/user/digital-contents/file/${encodeURIComponent(result.pathname)}`,
    };
  }

  async getSignedUrl(key: string, _expiresSeconds?: number): Promise<string> {
    // ローカルと同じく、認可チェック済みの Route Handler 経由で返す。
    // PR-3 で public バケットを導入した際は、バケットに応じて直URL / プロキシ URL を切り替える。
    return `/api/user/digital-contents/file/${encodeURIComponent(key)}`;
  }

  async getFile(key: string): Promise<FetchedFile> {
    try {
      const result = await get(key, { access: "private" });
      if (!result || result.statusCode !== 200) {
        throw new StorageNotFoundError(key);
      }
      const chunks: Uint8Array[] = [];
      const reader = result.stream.getReader();
      // Web Streams から Buffer に変換する。動画などの巨大ファイルは PR-3 以降で
      // ストリームのまま Response に流すよう最適化する余地あり。
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
      return { buffer };
    } catch (e) {
      if (e instanceof BlobNotFoundError) {
        throw new StorageNotFoundError(key);
      }
      throw e;
    }
  }
}
