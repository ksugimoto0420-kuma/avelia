import {
  BlobNotFoundError,
  del,
  get,
  put,
  type BlobAccessType,
} from "@vercel/blob";
import type { StorageDriver } from "../driver";
import {
  StorageNotFoundError,
  isPrivateBucket,
  type FetchedFile,
  type PutOptions,
  type StorageBucket,
  type StoredFile,
} from "../types";

/**
 * Vercel Blob をバックエンドに使うドライバー。
 *
 * 現状は単一ストア (BLOB_READ_WRITE_TOKEN) 運用で、bucket は pathname の
 * prefix (bucketName/pathnamePrefix/...) で表現する:
 *   private-digital/photobooks/<orderId>/<random>.pdf
 *   private-admin/deliveries/base-image/<contentId>/<random>.jpg
 *
 * bucket ごとに別ストア (別トークン) に分けるのは PR-4 で導入予定。
 * その際も呼び出し側の API (bucket 指定) は変わらない。
 */
export class VercelBlobDriver implements StorageDriver {
  /**
   * bucket ごとに Vercel Blob 側の access mode を決定する。
   *
   * 現在は同一ストア (private) 上で全て運用しているため、
   * public-assets を選んでも実質 private access になる。
   * PR-4 で public-assets 専用ストアを追加する際に本来の "public" が使える。
   */
  private accessFor(bucket: StorageBucket): BlobAccessType {
    return isPrivateBucket(bucket) ? "private" : "public";
  }

  /** Blob 上の実 pathname を組み立てる。 */
  private makePathname(bucket: StorageBucket, prefix: string): string {
    return `${bucket}/${prefix}`;
  }

  async put(
    buffer: Buffer,
    filename: string,
    opts: PutOptions,
  ): Promise<StoredFile> {
    const safeName = filename.replace(/[^\w.\-]+/g, "_");
    const pathname = `${this.makePathname(opts.bucket, opts.pathnamePrefix)}-${safeName}`;

    const result = await put(pathname, buffer, {
      access: this.accessFor(opts.bucket),
      addRandomSuffix: true,
    });

    return {
      bucket: opts.bucket,
      key: result.pathname,
      // 呼び出し側は基本的に getSignedUrl(bucket, key) を使う想定。
      // ここで返す url は public バケットに切り替わったときのフォールバック値。
      url: isPrivateBucket(opts.bucket)
        ? `/api/user/digital-contents/file/${encodeURIComponent(result.pathname)}`
        : result.url,
    };
  }

  async getSignedUrl(
    _bucket: StorageBucket,
    key: string,
    _expiresSeconds?: number,
  ): Promise<string> {
    // 現状は全 bucket を Route Handler 経由で配信する。
    // PR-4 で public バケットを分けたら、そこだけ blob.url を DB 保存済みの
    // ものから直接使う形に変える。
    return `/api/user/digital-contents/file/${encodeURIComponent(key)}`;
  }

  async getFile(bucket: StorageBucket, key: string): Promise<FetchedFile> {
    try {
      const result = await get(key, { access: this.accessFor(bucket) });
      if (!result || result.statusCode !== 200) {
        throw new StorageNotFoundError(bucket, key);
      }
      const chunks: Uint8Array[] = [];
      const reader = result.stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
      return { buffer };
    } catch (e) {
      if (e instanceof BlobNotFoundError) {
        throw new StorageNotFoundError(bucket, key);
      }
      throw e;
    }
  }

  /**
   * 補助メソッド: 明示的な削除。Driver interface には入れず、
   * 呼び出し側は必要ならこのクラスにキャストして使う。
   * (Cron や管理者操作向け。del は無料。)
   */
  async del(key: string): Promise<void> {
    await del(key);
  }
}
