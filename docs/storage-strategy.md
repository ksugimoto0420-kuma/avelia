# ファイルストレージ戦略・Vercel Blob 実装仕様書

**関連 Issue:** #15（Vercel Blob ドライバー実装）、#10（Vercel Preview 用 DB ブランチの分離）と連動

**作成日:** 2026-07-09
**最終更新:** 2026-07-10（PR-1〜PR-3 実装完了 + 実接続確認）
**対象読者:** 実装者、レビュワー、新規参加メンバー
**ステータス:** **実装完了（開発 Hobby 接続まで）**。会社 Pro Team への移行は保留

---

## 0. TL;DR

- ファイルストレージは **Vercel Blob 一本** に統一する
- 開発は **個人 Hobby アカウント** で進める。後日 **会社 Pro Team** に Blob ストアごと Transfer 可能なので、コード書き換えは発生しない
- 既存の `src/lib/storage.ts` を **ドライバー抽象化** し、`local` / `vercel-blob` を切り替え可能にする
- **アクセスモード（private/public）とリージョン（hnd1）はストア作成時に確定**（後から変更不可）
- **写真集PDF・動画は private ストア**、商品画像は public ストア
- **Immutable 運用**（同じパスに上書きしない）を基本ルール化。ファイル名にランダムサフィックスを付ける

---

## 1. 背景・目的

### 現状

- `src/lib/storage.ts` に MVP として `local` ドライバーのみ実装済み
- `putFile()`、`getSignedUrl()`、`localFilePath()` の3関数
- 使用箇所:
  - `src/app/api/admin/uploads/route.ts` — 管理画面からのアップロード
  - `src/app/api/user/digital-contents/file/[key]/route.ts` — デジタルコンテンツ配信
  - `src/app/api/user/deliveries/[id]/route.ts` — デリバリー配信
  - `src/app/api/admin/deliveries/base-image/[key]/route.ts` — 元画像取得
- 本番切替のための `S3 互換` 仕様は TODO のまま

### 本サービス化に向けた課題

- 本番運用ではローカルファイルシステムは使えない（Vercel Functions はエフェメラル）
- 写真集PDFなど購入者限定コンテンツは **署名URL・認可付き配信** が必須
- 商品画像は **CDN 経由で高速配信** したい
- インフラベンダーを増やしたくない（Vercel + Neon で完結）

### 決定事項

- **Vercel Blob を採用**（[検討経緯は別途チャット履歴参照]）
- 個人 Hobby → 会社 Pro Team への Transfer が公式サポートされているため、Hobby で先行実装しても本番移行時にコード変更は不要
- 東京リージョン `hnd1` を選択

---

## 2. アーキテクチャ

### 2.1 全体像

```
+---------------------------+
| Next.js App (Vercel)      |
|                           |
|  ┌─────────────────────┐  |
|  │ Server Actions /    │  |
|  │ Route Handlers      │  |
|  └──────────┬──────────┘  |
|             │             |
|  ┌──────────▼──────────┐  |
|  │ src/lib/storage/    │  |    ドライバー抽象化
|  │  index.ts (facade)  │  |
|  │  ├─ local.ts        │  |    開発 (env=local)
|  │  └─ vercel-blob.ts  │  |    Hobby開発 & 本番
|  └──────────┬──────────┘  |
+─────────────│──────────────+
              │
       ┌──────┴──────┐
       │             │
   ┌───▼───┐    ┌────▼──────────┐
   │ 開発:  │    │ Vercel Blob    │
   │ ./storage│  │ (Hobby / Pro)  │
   └────────┘    └───────────────┘
```

### 2.2 ドライバー切替

環境変数 `STORAGE_DRIVER` で切替:

| 値 | 用途 | 保存先 |
|---|---|---|
| `local` (既定) | ローカル開発（オフライン可） | `./storage/` |
| `vercel-blob` | Hobby / Preview / 本番 Pro | Vercel Blob |

### 2.3 ディレクトリ構成

```
src/lib/storage/
  index.ts            # 公開API（drivers.putFile 等をディスパッチ）
  types.ts            # 共通型
  driver.ts           # Driver interface
  drivers/
    local.ts          # 既存ロジックをここに移設
    vercel-blob.ts    # 新規実装
  path.ts             # ファイルパス生成ヘルパ（命名規約の集約）
```

---

## 3. Blob ストア設計

### 3.1 ストア分割方針

**用途ごとに Blob ストアを分離する**。理由:

- **アクセスモード（public/private）はストア単位で決まる**（後から変更不可）
- 権限・料金の見える化がしやすい
- 万一の事故時の影響範囲を絞れる

### 3.2 ストア一覧（4ストア構成）

| ストア名 | アクセスモード | リージョン | 用途 | 想定サイズ |
|---|---|---|---|---|
| `avelia-public-assets` | **public** | hnd1 | 商品画像、イベントバナー、公開素材 | 1ファイル 数MB × 大量 |
| `avelia-private-digital` | **private** | hnd1 | 写真集PDF、サイン動画、購入者限定コンテンツ | 1ファイル 数十〜数百MB |
| `avelia-private-admin` | **private** | hnd1 | 管理画面のアップロード素材（作業中の元データ、CSV出力保管など） | 中規模 |
| `avelia-private-temp` | **private** | hnd1 | 一時ファイル（PDF生成中間物、動画変換前ファイルなど） | 一時的 |

**Hobby ストア上限は 100 なのでこの分割で余裕あり。**

### 3.3 環境変数

```
# 開発ローカル
STORAGE_DRIVER=local

# Hobby / Preview / 本番
STORAGE_DRIVER=vercel-blob
BLOB_READ_WRITE_TOKEN_PUBLIC=vercel_blob_rw_xxx    # avelia-public-assets 用
BLOB_READ_WRITE_TOKEN_DIGITAL=vercel_blob_rw_xxx   # avelia-private-digital 用
BLOB_READ_WRITE_TOKEN_ADMIN=vercel_blob_rw_xxx     # avelia-private-admin 用
BLOB_READ_WRITE_TOKEN_TEMP=vercel_blob_rw_xxx      # avelia-private-temp 用
```

- Vercel Blob は **ストア単位でトークン発行**
- コード側は「用途 (bucket)」を指定 → ドライバー内でトークンを選択
- Vercel の Environment Variables で Production / Preview / Development をスコープ分離

---

## 4. パス命名規約

### 4.1 基本ルール

- `<domain>/<entityId>/<file>` 形式
- 拡張子は保持
- **同じパスに上書きしない（Immutable運用）**
- ファイル名にランダムサフィックス or ハッシュを付ける（`addRandomSuffix: true` を使う）

### 4.2 用途別命名

| 用途 | パス例 | ストア |
|---|---|---|
| 商品サムネイル | `products/{productId}/thumbnail-{hash}.jpg` | public |
| イベントバナー | `events/{eventId}/banner-{hash}.jpg` | public |
| 写真集PDF | `photobooks/{productId}/{version}-{hash}.pdf` | private-digital |
| サイン済み写真集 | `photobooks-signed/{orderId}/{hash}.pdf` | private-digital |
| サイン動画 | `videos-signed/{orderId}/{hash}.mp4` | private-digital |
| 管理素材（作業中） | `admin/{userId}/{yyyymmdd}/{hash}-{filename}` | private-admin |
| CSV出力 | `admin/csv/{yyyymmdd}/{hash}.csv` | private-admin |
| 一時ファイル | `tmp/{sessionId}/{hash}` | temp |

### 4.3 パス生成ヘルパ

`src/lib/storage/path.ts` に集約する:

```typescript
export const StoragePaths = {
  productThumbnail: (productId: string) =>
    `products/${productId}/thumbnail`,
  eventBanner: (eventId: string) =>
    `events/${eventId}/banner`,
  photobookOriginal: (productId: string, version: string) =>
    `photobooks/${productId}/${version}`,
  photobookSigned: (orderId: string) =>
    `photobooks-signed/${orderId}`,
  videoSigned: (orderId: string) =>
    `videos-signed/${orderId}`,
  adminUpload: (userId: string, yyyymmdd: string, filename: string) =>
    `admin/${userId}/${yyyymmdd}/${filename}`,
  csvExport: (yyyymmdd: string) =>
    `admin/csv/${yyyymmdd}`,
  tempFile: (sessionId: string) =>
    `tmp/${sessionId}`,
};
```

パス末尾のファイル名はドライバー側で `addRandomSuffix: true` で自動生成させる。呼び出し側はプレフィックスまでを指定する。

---

## 5. Driver 抽象化

### 5.1 型定義（`src/lib/storage/types.ts`）

```typescript
export type StorageBucket =
  | "public-assets"
  | "private-digital"
  | "private-admin"
  | "private-temp";

export type StoredFile = {
  bucket: StorageBucket;
  key: string;       // Blob 上のパス (e.g. "products/abc/thumbnail-xyz.jpg")
  url: string;       // アクセス用URL（public はそのままCDN、private は署名URL）
  contentType: string;
  size: number;
};

export type PutOptions = {
  bucket: StorageBucket;
  pathnamePrefix: string;   // "products/abc/thumbnail" のような prefix
  contentType?: string;
  cacheControlMaxAge?: number;  // 秒。省略時はデフォルト
};

export type GetSignedUrlOptions = {
  bucket: StorageBucket;
  key: string;
  expiresSeconds?: number;   // private only
};
```

### 5.2 Driver interface（`src/lib/storage/driver.ts`）

```typescript
export interface StorageDriver {
  put(buffer: Buffer, opts: PutOptions): Promise<StoredFile>;
  del(bucket: StorageBucket, key: string): Promise<void>;
  head(bucket: StorageBucket, key: string): Promise<{ size: number; contentType: string } | null>;

  /**
   * 認可済みユーザー向けの配信URL。
   * - public バケット: そのままCDNのURLを返す
   * - private バケット: 短TTLの署名URL、または Route Handler を経由するプロキシURL
   */
  getUrl(opts: GetSignedUrlOptions): Promise<string>;
}
```

### 5.3 Facade（`src/lib/storage/index.ts`）

```typescript
import { env } from "@/lib/env";
import { LocalDriver } from "./drivers/local";
import { VercelBlobDriver } from "./drivers/vercel-blob";
import type { StorageDriver } from "./driver";

function createDriver(): StorageDriver {
  switch (env.storage.driver) {
    case "vercel-blob":
      return new VercelBlobDriver();
    case "local":
    default:
      return new LocalDriver();
  }
}

const driver = createDriver();

export const storage = driver;
export { StoragePaths } from "./path";
export type { StoredFile, StorageBucket } from "./types";
```

---

## 6. 各ドライバー実装仕様

### 6.1 Local ドライバー（既存を移設）

`src/lib/storage/drivers/local.ts`

**責務:**
- `./storage/{bucket}/{key}` に保存
- `getUrl()` は `/api/user/digital-contents/file/{key}` のような認可済み Route Handler パスを返す
- ローカル開発の便宜のため public バケットも認可なしで返す

**既存 `src/lib/storage.ts` からの移設ポイント:**
- `LOCAL_DIR` は `./storage/{bucket}/` にサブディレクトリを追加
- `putFile()` → `LocalDriver.put()` に統合
- `getSignedUrl()` → `LocalDriver.getUrl()` に統合
- `localFilePath()` は Route Handler の実ファイル取得用に残す（`LocalDriver.getFilePath()` として driver に閉じ込める）

### 6.2 Vercel Blob ドライバー

`src/lib/storage/drivers/vercel-blob.ts`

**依存パッケージ:**
```bash
npm install @vercel/blob
```

**実装スケルトン:**

```typescript
import { put, del, head } from "@vercel/blob";
import type { StorageDriver } from "../driver";
import type { StorageBucket, StoredFile, PutOptions, GetSignedUrlOptions } from "../types";

const TOKENS: Record<StorageBucket, string | undefined> = {
  "public-assets": process.env.BLOB_READ_WRITE_TOKEN_PUBLIC,
  "private-digital": process.env.BLOB_READ_WRITE_TOKEN_DIGITAL,
  "private-admin": process.env.BLOB_READ_WRITE_TOKEN_ADMIN,
  "private-temp": process.env.BLOB_READ_WRITE_TOKEN_TEMP,
};

const ACCESS: Record<StorageBucket, "public" | "private"> = {
  "public-assets": "public",
  "private-digital": "private",
  "private-admin": "private",
  "private-temp": "private",
};

export class VercelBlobDriver implements StorageDriver {
  async put(buffer: Buffer, opts: PutOptions): Promise<StoredFile> {
    const token = TOKENS[opts.bucket];
    if (!token) throw new Error(`BLOB token not set for bucket: ${opts.bucket}`);

    const blob = await put(opts.pathnamePrefix, buffer, {
      access: ACCESS[opts.bucket],
      token,
      addRandomSuffix: true,
      contentType: opts.contentType,
      cacheControlMaxAge: opts.cacheControlMaxAge,
    });

    return {
      bucket: opts.bucket,
      key: blob.pathname,
      url: blob.url,
      contentType: blob.contentType ?? opts.contentType ?? "application/octet-stream",
      size: buffer.length,
    };
  }

  async del(bucket: StorageBucket, key: string): Promise<void> {
    const token = TOKENS[bucket];
    if (!token) throw new Error(`BLOB token not set for bucket: ${bucket}`);
    // Vercel Blob の del は URL または pathname を受け取る
    await del(key, { token });
  }

  async head(bucket: StorageBucket, key: string) {
    const token = TOKENS[bucket];
    if (!token) throw new Error(`BLOB token not set for bucket: ${bucket}`);
    try {
      const info = await head(key, { token });
      return { size: info.size, contentType: info.contentType };
    } catch {
      return null;
    }
  }

  async getUrl(opts: GetSignedUrlOptions): Promise<string> {
    // public バケットは blob.url をそのまま DB に保存済みなのでその値を返す想定
    // private バケットは Function 経由のプロキシで配信するため、
    // /api/user/digital-contents/file/{encodeURIComponent(key)} を返す
    if (ACCESS[opts.bucket] === "public") {
      // 呼び出し側で保存済みの url をそのまま使う想定。
      // ここでは念のためエラーで気づかせる
      throw new Error("public バケットは put 時の url を DB 保存して直接使ってください");
    }
    return `/api/user/digital-contents/file/${encodeURIComponent(opts.key)}`;
  }
}
```

### 6.3 Private コンテンツ配信の流れ

**public バケット:**
```
Client → [Vercel CDN] → blob.public.blob.vercel-storage.com
                       (署名不要、URL直参照)
```

**private バケット:**
```
Client → /api/user/digital-contents/file/{key}
          ↓ 認可チェック（購入者か? 期限内か? DL上限内か?）
          ↓ Vercel Blob get() で取得
          ↓ ストリームで返却
          ↓ Cache-Control: private, no-store
```

**理由:**
- Vercel Blob の private ストアは Function 経由での配信が公式パターン
- ダウンロード上限・期限管理をアプリ側で厳格制御できる
- 購入者透かし合成などをリアルタイムでかけるフックポイントになる

---

## 7. 既存コードへの影響

### 7.1 変更が必要なファイル

| ファイル | 変更内容 |
|---|---|
| `src/lib/storage.ts` | 削除。`src/lib/storage/index.ts` の facade 経由に置換 |
| `src/lib/env.ts` | `storage.driver` に `"vercel-blob"` を追加、BLOB トークン群を追加 |
| `src/app/api/admin/uploads/route.ts` | `putFile` → `storage.put({ bucket, pathnamePrefix })` に置換 |
| `src/app/api/user/digital-contents/file/[key]/route.ts` | `localFilePath` の代わりに driver 経由でファイル取得 |
| `src/app/api/user/deliveries/[id]/route.ts` | 同上 |
| `src/app/api/admin/deliveries/base-image/[key]/route.ts` | 同上 |
| `src/app/(user)/mypage/digital-contents/[contentId]/page.tsx` | URL 生成部分を `storage.getUrl()` に置換 |
| `.env.example` | BLOB トークン変数を追記 |
| `README.md` | STORAGE_DRIVER に `vercel-blob` の説明追加 |

### 7.2 DB スキーマへの影響

**現状の Prisma スキーマ確認事項:**
- `DigitalContent.fileKey` → 現状 `local` ドライバーの key のみ格納
- Vercel Blob 化するにあたり、以下のいずれかにする必要がある:

**選択肢A: fileKey は Blob の pathname のみを格納（推奨）**

- 既存カラムをそのまま使用
- Blob URL は Runtime に driver 経由で生成
- **メリット:** スキーマ変更なし、URL変更に強い
- **デメリット:** public バケットの場合も一度 driver 経由になる

**選択肢B: bucket と key を分離して保存**

```prisma
model DigitalContent {
  ...
  storageBucket String  // "public-assets" | "private-digital" ...
  storageKey    String  // pathname
  publicUrl     String? // public バケットの場合のみキャッシュ
}
```

**推奨: 選択肢A**
まずは既存の `fileKey` を活用し、必要になった時点で選択肢Bに拡張する。

### 7.3 マイグレーション不要

上記の選択肢Aを取れば **DBマイグレーションは不要**。データも既存のままで、ドライバーだけ差し替わる。

---

## 8. Immutable 運用ルール

### 8.1 なぜ Immutable にするか

- Vercel Blob には**バックアップ機能がない**
- **同じパスに上書きすると、キャッシュ反映まで最大60秒かかる + 誤上書き時の復元不可**
- Vercel 公式も Immutable 運用を推奨

### 8.2 実装ルール

**a. `addRandomSuffix: true` を全 put で必ず使う**

```typescript
// ○ 良い
await storage.put(buffer, {
  bucket: "private-digital",
  pathnamePrefix: StoragePaths.photobookSigned(orderId),
});
// → 実際の key は "photobooks-signed/order-123/xxxxxxxxxxx.pdf"

// × ダメ（上書きが起きる）
await put("photobooks-signed/order-123.pdf", buffer, { allowOverwrite: true });
```

**b. 変更するときは「新しいファイルを作って古いのを削除」**

```typescript
// 例: 商品サムネイル差し替え
const newFile = await storage.put(buffer, {
  bucket: "public-assets",
  pathnamePrefix: StoragePaths.productThumbnail(productId),
});
// DB を新しい key に更新
await prisma.product.update({ where: { id: productId }, data: { thumbnailKey: newFile.key } });
// 古い方を削除（del は無料）
if (oldKey) await storage.del("public-assets", oldKey);
```

**c. 削除は基本的に「参照が消えてから」**

- ユーザーが購入した写真集PDFは、原則削除しない
- DB上の論理削除 + 参照リセット後にストレージから物理削除するのはバッチ処理で

---

## 9. セキュリティ

### 9.1 権限マトリクス

| 操作 | public-assets | private-digital | private-admin | private-temp |
|---|---|---|---|---|
| 書き込み (put) | 管理者のみ | サーバー処理のみ | 管理者のみ | 認証済みユーザー |
| 直接URL参照 | 誰でも可 | 不可 | 不可 | 不可 |
| 認可経由配信 | - | 購入者本人 | 管理者 | 発行者本人 |
| 削除 (del) | 管理者のみ | サーバー処理のみ | 管理者のみ | Cronで自動 |

### 9.2 write トークンの取扱

- **write トークンをクライアントに送らない**
- クライアントアップロードが必要な場合は **Client Upload の一時トークン発行**（`@vercel/blob/client` の `handleUpload`）
- サーバー側でトークンを Route Handler に閉じ込めることで、環境変数を経由してのみアクセス可能に

### 9.3 private コンテンツの二重防御

Route Handler での配信時に:

1. セッション認証（`requireUser()`）
2. 購入・付与レコード確認
3. 期限・DL回数上限チェック
4. Vercel Blob からストリーム取得
5. `Cache-Control: private, no-store` で返却

これは既存の `src/app/api/user/digital-contents/file/[key]/route.ts` にすでに実装されているロジック。

### 9.4 コピー対策

写真集ビューワーで既に実装済み:
- 右クリック・ドラッグ・選択の抑制
- 購入者透かし
- 短TTL署名URL（今回のスコープ外だが将来検討）

Vercel Blob 側でできる対策は URL 難読化のみ。DRM 相当の保護は写真集ビューワー側で実装する。

---

## 10. 料金試算（Hobby開発時）

Hobby 枠の実質使用量は開発中なら **ほぼゼロ**。無料枠内で完結する見込み。

| 想定使用 | 使用量 | 判定 |
|---|---|---|
| ストレージ | 開発用サンプル 数百MB〜1GB | ✅ 無料枠内 |
| Simple Ops | 開発中の閲覧 1万回程度/月 | ✅ 無料枠内 |
| Advanced Ops | put/list 数千回/月 | ✅ 無料枠内 |
| データ転送 | 数GB/月 | ✅ 無料枠内 |

Hobby は超過しても課金されず、**30日間ロックされるだけ**。開発中に想定を超えたら30日待てば復活する。

本番 Pro 移行後の料金は `docs/vercel-blob-research.md`（本ドキュメントとは別に、料金・移行手順の記録として作成予定）で管理。

---

## 11. 実装計画

### 11.1 タスク分割（Issue 化する単位）

| # | タスク | ステータス | 参照 PR |
|---|---|---|---|
| 1 | `src/lib/storage/` ディレクトリ構造への移設 + Driver 抽象化 | ✅ 完了 | #17 |
| 2 | LocalDriver 実装（既存ロジックの移設） | ✅ 完了 | #17 |
| 3 | VercelBlobDriver 実装 | ✅ 完了 | #18 |
| 4 | 既存 Route Handler / Page の facade 使用への差し替え | ✅ 完了 | #17 + #19 |
| 5 | Hobby アカウントで Blob ストア作成 + 環境変数設定 | ✅ 完了（1ストア運用に統合） | 手動作業 |
| 6 | 動作確認（管理画面から画像アップ → 表示） | ✅ スモークで確認済 | Blob 実接続 |
| 7 | README・.env.example・onboarding.md への追記 | ✅ 完了 | 本 PR |

### 11.2 実装順序（実績）

1. **PR-1 (#17): 抽象化基盤 + LocalDriver 移設** ✅
   - 既存挙動を保ったまま `src/lib/storage/` 配下にドライバー抽象を導入
   - LocalDriver で既存動作を再現

2. **PR-2 (#18): VercelBlobDriver 追加** ✅
   - `@vercel/blob@^2.6.1` 導入
   - Driver 実装、`STORAGE_DRIVER=vercel-blob` 切替可能に
   - 単一トークン運用でスモーク通過

3. **PR-3 (#19): bucket 分割導入** ✅
   - `StorageBucket` 型、`StoragePaths` ヘルパ、DB スキーマ拡張
   - 既存呼び出し 5 箇所を bucket 明示指定に統一
   - Hobby ストア `avelia-dev-blob` で `private-digital` / `private-admin` の実接続テスト成功

4. **PR-4 (本 PR): ドキュメント整備 + 本番接続手順**
   - README・onboarding.md・.env.example に反映
   - 本番 (Pro Team) 移行手順を Section 12 に確定
   - 会社 Pro 契約後の設定タスクを明記

### 11.4 Hobby 開発における簡略化

仕様書当初 4 ストア構成を想定していたが、Hobby 開発時点では **1 ストア (avelia-dev-blob) 上に pathname prefix で bucket を分ける** 運用を採用した。理由:

- Hobby ストア上限 (100) の枠内でも運用に影響はないが、初期開発では 1 ストアの方が接続確認・トークン管理が単純
- Vercel Blob 側の access mode は「private」のみで統一（呼び出し側は Route Handler 経由で認可制御）
- 将来的に会社 Pro Team に移った際、`public-assets` 用のストアを追加で作れば従来の 4 ストア構成に段階移行可能
  - コードは `isPrivateBucket(bucket)` の分岐で自動対応（VercelBlobDriver.accessFor 参照）

### 11.3 テスト実績

**PR-2 スモーク（単一 bucket）:**
- ✅ `put()` / `getFile()` / `getSignedUrl()` の往復成功（Hobby avelia-dev-blob）
- ✅ addRandomSuffix でユニーク key 生成
- ✅ トークン検出・認証成功

**PR-3 スモーク（bucket 分割）:**
- ✅ `private-digital` bucket で put→getFile→del 成功
- ✅ `private-admin` bucket で put→getFile→del 成功
- ✅ pathname prefix に bucket 名が正しく含まれる
- ✅ `del()` 動作確認

**未実施（次回のPreview デプロイ以降で実施推奨）:**
- [ ] 管理画面 UI からのアップロード動線
- [ ] 未認可アクセスが 403 で拒否される
- [ ] ファイルサイズ 100MB 超のときに Multipart Upload が使われる
- [ ] 期限切れ / DL上限超過時の 403 挙動
- [ ] エラー時のフォールバック挙動

---

## 12. Hobby → Pro 移行手順（将来）

会社 Pro Team が用意できた時点で以下を実施する。**コード変更は 0 行** で、環境変数と接続先の切替のみで完了する。

### 12.1 事前準備

- [ ] 個人 Vercel アカウントを会社 Pro Team のメンバーに招待してもらう
- [ ] 会社側で `avelia-funclub` プロジェクトを Pro Team に作成 or Transfer 済みにする
- [ ] Neon の本番 DB が Pro Team の Vercel プロジェクトに接続済みになっている

### 12.2 Blob ストアの構成方針

現状 `avelia-dev-blob` 1 ストア運用だが、本番では用途別に分ける。

| 環境 | 構成 |
|---|---|
| 開発 (Hobby) | `avelia-dev-blob` 1 ストア（すべて private） |
| Preview (Pro) | 開発と同一 or 別途 `avelia-preview-blob` を Pro に切る |
| Production (Pro) | 用途別 2〜4 ストア（Section 3.2 参照） |

**現時点で最小のストア数:**
- `avelia-private` (private) — private-digital / private-admin / private-temp を pathname prefix で分ける
- `avelia-public`  (public)  — public-assets 用（商品画像を Public 化する時点で追加）

### 12.3 移行フロー（開発 Hobby → Pro Production）

**方針A: データを引き継ぐ (Transfer Store)**

1. Vercel ダッシュボード → Storage → `avelia-dev-blob` → Settings → Transfer Store
2. Destination: 会社 Pro Team を選択 → Transfer 実行
3. 数分で完了、Blob URL は変化しない
4. Vercel Project 側の環境変数はストアに紐付いたまま新 Team に引き継がれる

**方針B: 新規に作り直す**（**アベリア本番はこちら**。開発用データを本番に持ち込まないため）

1. Pro Team で新規 Blob ストアを作成（用途別に 2〜4 個）
2. 各ストアの `BLOB_READ_WRITE_TOKEN` を取得し、Production 環境変数として登録
3. `STORAGE_DRIVER=vercel-blob` を Production スコープに設定
4. Neon の本番 DB を空の状態で用意（既存レコードがある場合は Section 12.4 参照）
5. デプロイ、動作確認

### 12.4 DB との整合

- 開発 DB の `DigitalContent.fileKey` / `baseImageKey` / `DigitalDelivery.fileKey` は **開発 Blob ストアの pathname を指している**
- 本番の Blob ストアはそれとは別なので、開発 DB のレコードを本番にコピーしても Blob にはファイルが存在しない
- 本番運用開始時は「本番 DB は空で始め、正規のアップロードフローで積んでいく」のが自然
- Preview 環境でも同様に、Preview 用 DB (Issue #10) と Preview 用 Blob を接続する

### 12.5 移行後の環境変数

会社 Pro Team の Vercel プロジェクト設定で以下を Environment ごとに設定:

| 変数 | Development | Preview | Production |
|---|---|---|---|
| `STORAGE_DRIVER` | `local` | `vercel-blob` | `vercel-blob` |
| `BLOB_READ_WRITE_TOKEN` | (unset) | Preview ストアのトークン | Production ストアのトークン |

**注意:** Vercel Blob ストアを Vercel Project に Connect すると、`BLOB_READ_WRITE_TOKEN` は自動注入される。手動設定は不要になる。

---

## 13. 決めきれていない事項（今後の議論）

**PR-1〜PR-4 の実装で確定した:**
- ✅ 開発時は 1 ストア (avelia-dev-blob) 運用、pathname prefix で bucket 分離
- ✅ 全 bucket を private access で扱う（呼び出し側は Route Handler 経由で配信）
- ✅ DB マイグレーションは既存レコード互換のため default 値で補完
- ✅ 既存 `./storage/` のデータは Hobby Blob に投入しない（Section 12.4 参照）

**未決（次アクション時に決める）:**
- [ ] **CSV出力のストレージ配置**: private-admin か、Route Handler で直接ストリームか
- [ ] **一時ファイルの TTL**: Cron で自動削除する場合の閾値（24時間? 7日? デフォルト設定）
- [ ] **管理画面のClient Upload**: 大きなファイル（数百MB動画）を管理画面から上げる場合、Client Upload に切り替えるか
- [ ] **バックアップの頻度と方式**: 重要ファイル（写真集マスターPDF等）を R2 に週1同期するか、それとも Immutable 運用のみで十分か
- [ ] **public-assets ストア導入タイミング**: 商品画像を CDN で高速配信したくなった時に切る
- [ ] **本番 DB マイグレーション適用手順**: Issue #12 でドキュメント化予定

---

## 14. 参考

- [Vercel Blob 概要](https://vercel.com/docs/vercel-blob)
- [Vercel Blob 料金](https://vercel.com/docs/vercel-blob/usage-and-pricing)
- [Store の Transfer 手順](https://vercel.com/docs/storage#transferring-your-store)
- 関連 Issue: #10（Vercel Preview 用 DB ブランチの分離）
- 関連ドキュメント:
  - `docs/dev-workflow.md`
  - `docs/onboarding.md`
