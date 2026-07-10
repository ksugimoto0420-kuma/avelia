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
 * bucket 別に別ストア (別トークン) を切り替える構成。
 *   - public-assets  : avelia-public-assets ストア (BLOB_PUBLIC_READ_WRITE_TOKEN)
 *   - private-digital / private-admin / private-temp
 *     : avelia-dev-blob ストア (BLOB_READ_WRITE_TOKEN)
 *
 * ストア内では pathname prefix (bucketName/pathnamePrefix/...) で
 * さらに用途別に分ける (Immutable 運用のため addRandomSuffix つき)。
 */
export class VercelBlobDriver implements StorageDriver {
  private tokenFor(bucket: StorageBucket): string | undefined {
    if (bucket === "public-assets") {
      // public 側は専用ストアのトークンが必須。無ければ意図的に失敗させる。
      return process.env.BLOB_PUBLIC_READ_WRITE_TOKEN;
    }
    // private 系は既存の avelia-dev-blob を共用。@vercel/blob は
    // BLOB_READ_WRITE_TOKEN を自動で拾うので token を明示しなくても動くが、
    // 呼び出し側で bucket 混在を防ぐため明示的に渡す。
    return process.env.BLOB_READ_WRITE_TOKEN;
  }

  private accessFor(bucket: StorageBucket): BlobAccessType {
    return isPrivateBucket(bucket) ? "private" : "public";
  }

  private makePathname(bucket: StorageBucket, prefix: string): string {
    return `${bucket}/${prefix}`;
  }

  async put(
    buffer: Buffer,
    filename: string,
    opts: PutOptions,
  ): Promise<StoredFile> {
    const token = this.tokenFor(opts.bucket);
    if (opts.bucket === "public-assets" && !token) {
      throw new Error(
        "BLOB_PUBLIC_READ_WRITE_TOKEN が未設定のため public-assets バケットにアップロードできません",
      );
    }
    const safeName = filename.replace(/[^\w.\-]+/g, "_");
    const pathname = `${this.makePathname(opts.bucket, opts.pathnamePrefix)}-${safeName}`;

    const result = await put(pathname, buffer, {
      access: this.accessFor(opts.bucket),
      addRandomSuffix: true,
      token,
    });

    return {
      bucket: opts.bucket,
      key: result.pathname,
      // public バケットの場合は CDN 直リンクを返す (未ログインでも表示可能)。
      // private バケットは管理者向け Route Handler 経由の URL を返す
      // (管理画面のプレビュー・編集時再表示で使う)。
      // 購入者向け配信は /api/user/digital-contents/file/[key] で
      // 別途 DB 上の bucket 情報を参照して認可判定する。
      url:
        opts.bucket === "public-assets"
          ? result.url
          : buildAdminBlobUrl(opts.bucket, result.pathname),
    };
  }

  async getSignedUrl(
    bucket: StorageBucket,
    key: string,
    _expiresSeconds?: number,
  ): Promise<string> {
    // public は Blob URL を直接使ってほしいので、この経路は private 想定。
    // ただし public でも呼ばれる可能性を考慮して、認可経路にフォールバックさせない。
    if (bucket === "public-assets") {
      throw new Error(
        "public-assets バケットは put 時の url を DB に保存して直接使ってください",
      );
    }
    // 購入者向けの認可付き配信ルート。呼び出し元は通常こちらを使う。
    return `/api/user/digital-contents/file/${encodeURIComponent(key)}`;
  }

  async getFile(bucket: StorageBucket, key: string): Promise<FetchedFile> {
    const token = this.tokenFor(bucket);
    try {
      const result = await get(key, {
        access: this.accessFor(bucket),
        token,
      });
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
   */
  async del(bucket: StorageBucket, key: string): Promise<void> {
    const token = this.tokenFor(bucket);
    await del(key, { token });
  }
}

/**
 * private バケットの blob を管理画面から参照するための URL を組み立てる。
 * /api/admin/blob/[bucket]/[...key] (Route Handler の catch-all) 経由。
 *
 * key の中に "/" が含まれるが、Next の catch-all は "/" ごとに segment を作る仕様。
 * そのままエンコードすると "%2F" になってしまうため、segment を分けて encodeURIComponent する。
 */
function buildAdminBlobUrl(bucket: StorageBucket, key: string): string {
  const segments = key.split("/").map((s) => encodeURIComponent(s));
  return `/api/admin/blob/${bucket}/${segments.join("/")}`;
}
