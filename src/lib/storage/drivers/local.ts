import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageDriver } from "../driver";
import { StorageNotFoundError, type FetchedFile, type StoredFile } from "../types";

/**
 * ローカルファイルシステム上にファイルを置くドライバー。
 *
 * MVP から続くローカル開発用の実装。旧 src/lib/storage.ts から移設。
 * 公開ディレクトリ外に保存し、配信は認可付き Route Handler 経由に統一する。
 */
export class LocalDriver implements StorageDriver {
  /** 保存先のルート（プロジェクト直下 ./storage）。 */
  static readonly LOCAL_DIR = path.join(process.cwd(), "storage");

  /**
   * 実ファイルの絶対パスを返す。
   * パストラバーサル防止のため key は basename のみを取り出す。
   *
   * ドライバー内部でのみ利用する。呼び出し側は getFile() を使う。
   */
  private filePath(key: string): string {
    return path.join(LocalDriver.LOCAL_DIR, path.basename(key));
  }

  async put(buffer: Buffer, filename: string): Promise<StoredFile> {
    const safe = filename.replace(/[^\w.\-]+/g, "_");
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
    await mkdir(LocalDriver.LOCAL_DIR, { recursive: true });
    await writeFile(path.join(LocalDriver.LOCAL_DIR, key), buffer);
    return {
      key,
      url: `/api/user/digital-contents/file/${encodeURIComponent(key)}`,
    };
  }

  async getSignedUrl(key: string, _expiresSeconds?: number): Promise<string> {
    // ローカルは署名URLを持たない。認可チェック済みの Route Handler 経由で返す。
    return `/api/user/digital-contents/file/${encodeURIComponent(key)}`;
  }

  async getFile(key: string): Promise<FetchedFile> {
    try {
      const buffer = await readFile(this.filePath(key));
      return { buffer };
    } catch (e) {
      const code = (e as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") {
        throw new StorageNotFoundError(key);
      }
      throw e;
    }
  }
}
