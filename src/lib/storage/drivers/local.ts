import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageDriver } from "../driver";
import {
  StorageNotFoundError,
  type FetchedFile,
  type PutOptions,
  type StorageBucket,
  type StoredFile,
} from "../types";

/**
 * ローカルファイルシステム上にファイルを置くドライバー。
 *
 * ./storage/<bucket>/<key> の階層で保存する。
 * bucket ごとにサブディレクトリを分けることで、Vercel Blob ストアと
 * 論理的な対応関係を維持する。
 *
 * 配信は認可付き Route Handler 経由に統一 (public バケットもローカル環境では
 * 認可経由にしておく方が開発中の権限確認が楽)。
 */
export class LocalDriver implements StorageDriver {
  static readonly LOCAL_DIR = path.join(process.cwd(), "storage");

  private bucketDir(bucket: StorageBucket): string {
    return path.join(LocalDriver.LOCAL_DIR, bucket);
  }

  /** パストラバーサル防止のため basename のみを使う。 */
  private filePath(bucket: StorageBucket, key: string): string {
    return path.join(this.bucketDir(bucket), path.basename(key));
  }

  async put(
    buffer: Buffer,
    filename: string,
    opts: PutOptions,
  ): Promise<StoredFile> {
    const safeName = filename.replace(/[^\w.\-]+/g, "_");
    const random = Math.random().toString(36).slice(2, 10);
    // Vercel Blob の pathname と同じく、pathnamePrefix を含む key を作る。
    // ただしローカルではファイルシステム上のディレクトリ構造ではなく、
    // 単一 bucket ディレクトリに basename 化して置く (パストラバーサル防止)。
    const key = `${opts.pathnamePrefix.replace(/\//g, "_")}-${Date.now()}-${random}-${safeName}`;

    const dir = this.bucketDir(opts.bucket);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, key), buffer);

    return {
      bucket: opts.bucket,
      key,
      url: `/api/user/digital-contents/file/${encodeURIComponent(key)}`,
    };
  }

  async getSignedUrl(
    _bucket: StorageBucket,
    key: string,
    _expiresSeconds?: number,
  ): Promise<string> {
    return `/api/user/digital-contents/file/${encodeURIComponent(key)}`;
  }

  async getFile(bucket: StorageBucket, key: string): Promise<FetchedFile> {
    try {
      const buffer = await readFile(this.filePath(bucket, key));
      return { buffer };
    } catch (e) {
      const code = (e as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") {
        throw new StorageNotFoundError(bucket, key);
      }
      throw e;
    }
  }
}
