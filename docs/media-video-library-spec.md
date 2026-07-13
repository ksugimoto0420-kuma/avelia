# 動画ライブラリ (Media Library) 仕様書

## 1. 目的・背景

事前撮影した動画を管理画面上で **一元管理** できるようにする。
現状は商品作成/編集ページで動画をアップロードするが、以下の課題がある:

- 動画を横断で一覧できない (どの商品にどの動画が紐づいているか不明)
- 同じ動画を複数商品で使い回せない (毎回アップロードが必要)
- プレビュー / 長さ / サイズなどの動画メタが確認できない
- 動画専用の UI ではないため、削除・差し替えが煩雑

「事前撮影 → タレントがサインする対象動画」の運用フローに合わせて、
**動画ライブラリを新設し、商品からは選択して紐付ける** 形にする。

## 2. スコープ

### 対象
- サイン用ベース動画 (DIGITAL_VIDEO_SIGN 商品の原本)

### 対象外 (別途)
- 写真サインのベース画像 (現行 UI 継続)
- ユーザーへの配信済み動画 (別カテゴリ)
- イベントバナー動画

## 3. データモデル

### 3.1 新規モデル: `MediaVideo`

```prisma
model MediaVideo {
  id           String   @id @default(cuid())
  title        String   // 管理者が付ける名前 (例: "6月配信 サンプルA")
  description  String?  // 任意メモ
  blobKey      String   // Vercel Blob のキー (private-admin bucket)
  blobBucket   String   @default("private-admin") // 将来バケット変更に備える
  blobUrl      String   // /api/admin/blob/... の内部URL
  durationSec  Float?   // 動画の長さ (秒)。アップロード時に取得
  sizeBytes    Int      // ファイルサイズ
  mimeType     String   // "video/mp4" 等
  thumbnailKey String?  // (Phase 2) サムネイル画像のBlobキー
  isArchived   Boolean  @default(false) // 論理削除 (削除しても紐づく商品は残す)

  uploadedById String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  uploadedBy   AdminUser        @relation(fields: [uploadedById], references: [id])
  digitalContents DigitalContent[] // このメディアを使っている DC

  @@index([isArchived])
  @@map("media_videos")
}
```

### 3.2 既存 `DigitalContent` の拡張

```prisma
model DigitalContent {
  // ... 既存 ...
  baseImageKey    String?  // 写真サインの原本 key (継続)
  baseImageBucket String?  // 継続
  baseImageUrl    String?  // 継続

  // 動画サイン用: ライブラリ FK
  baseVideoId     String?  // MediaVideo.id
  baseVideo       MediaVideo? @relation(fields: [baseVideoId], references: [id], onDelete: SetNull)
}
```

**互換性**: 既存の `baseImageUrl` に動画URL が入っているレコードもそのまま
生かす。新規は `baseVideoId` を優先し、無ければ `baseImageUrl` を読む
(移行猶予期間)。既存データはコード内で参照するのみで、書き換えない。

## 4. UI

### 4.1 `/admin/media/videos` (新設): 動画ライブラリ一覧

- 動画のリスト表示 (カード or テーブル):
  - サムネイル (Phase 2、当面は動画アイコン)
  - タイトル
  - 長さ (秒)
  - サイズ (MB)
  - アップロード日 / アップロード者
  - **使用商品数** (このメディアを使っている `DigitalContent` の数)
  - 「編集」「削除 (アーカイブ)」ボタン
- 上部に「+ 動画をアップロード」ボタン
- フィルター: 「使用中のみ / 全て」

### 4.2 `/admin/media/videos/new`: 新規アップロード

- タイトル入力 (必須)
- 説明 (任意)
- 動画ファイル選択 (D&D / クリック)
- アップロード中: 進捗バー (Vercel Blob の resumable が使えれば)
- アップロード後: プレビュー再生 + 「保存」

### 4.3 `/admin/media/videos/[id]`: 詳細/編集

- 動画プレビュー
- タイトル / 説明の編集
- ファイルの**差し替え** (新しい動画で置き換え、blob 再アップロード)
- **紐づき先商品の一覧** (この動画を使っている DigitalContent → 商品)
  - 「使用中」なので削除時に警告
- 「削除 (アーカイブ)」ボタン
  - 使用中の商品がある場合は「削除できません、先に商品側で外してください」
  - or 「アーカイブして商品からも自動的に外す」の選択

### 4.4 商品編集画面 (`/admin/products/[id]`) の変更

現状の「サイン用ベース動画」欄を刷新:

- 「**動画を選択**」ボタン → モーダル表示
  - モーダル内: 動画ライブラリの一覧を検索可能に (タイトル検索)
  - 動画をクリックで選択
  - 上部に「+ 新規アップロード」ボタン (モーダル内で完結)
- 選択済み: サムネ + タイトル + 「変更」「クリア」ボタン
- 動画一覧が空のときは「動画をアップロード」ボタンだけ表示

## 5. API 変更

### 5.1 動画ライブラリ用エンドポイント

```
GET  /api/admin/media/videos          # 一覧 (paging)
POST /api/admin/media/videos          # 新規作成 (blob key と title を受け取る)
GET  /api/admin/media/videos/[id]     # 詳細
PATCH /api/admin/media/videos/[id]    # 更新 (タイトル/説明)
DELETE /api/admin/media/videos/[id]   # アーカイブ (物理削除でも良い、要判断)
```

### 5.2 動画アップロード
既存の `/api/admin/uploads` (private-admin bucket) を流用:
- purpose に "media-video" を新設
- レスポンスの blob key を上記 POST に渡して MediaVideo レコードを作成

### 5.3 動画配信 (タレント/購入者向け)
既存の base-image エンドポイントを流用可能:
- `/api/admin/deliveries/base-image/[key]` (管理者プレビュー)
- `/api/talent/deliveries/[id]/base-image` (タレント)
- `/api/deliveries/[id]/base-image` (購入者)

上記は動画も返せるので、DigitalContent 側で:
- `baseVideoId` があれば MediaVideo.blobKey を、無ければ既存 baseImageKey/Url を
返すよう resolveBase 系のロジックに分岐を追加

## 6. 実装ステップ

### Step 1: スキーマ + マイグレーション (0.5 日)
- Prisma: `MediaVideo` モデル追加 + `DigitalContent.baseVideoId` 追加
- 手動 SQL を Neon SQL Editor に貼り付け

### Step 2: 動画ライブラリ CRUD (1 日)
- `/admin/media/videos` 一覧ページ
- `/admin/media/videos/new` アップロードページ
- `/admin/media/videos/[id]` 詳細/編集/削除
- API 4 本

### Step 3: 商品編集画面のセレクター (0.5 日)
- 動画選択モーダル (`VideoLibraryPicker` Client)
- 「変更」「クリア」の挙動

### Step 4: 配信ロジック分岐 (0.5 日)
- baseVideoId が優先されるよう base-image 系エンドポイントを調整
- 既存 baseImageUrl 経由のフォールバックも維持

### Step 5: adminNav メニュー追加 (5 分)
- 「コンテンツ」グループに「動画ライブラリ」を追加

## 7. 動画の技術要件

- 対応形式: `video/mp4` (優先) / `video/webm` (互換)
- 最大サイズ: Vercel Blob の 500MB 制限に準ずる
  - タブレット再生を考えると **推奨 100MB 以下 / 720p / 60秒程度**
- アップロード時の長さ取得: クライアント側で `<video>` の loadedmetadata で取得
- サムネイル: Phase 2。当面は動画アイコンで代替

## 8. 権限

- MANAGER 以上: アップロード / 編集 / 削除
- OPERATOR: 閲覧のみ
- TALENT: このメニューは非表示

## 9. 未解決事項

- [ ] 削除は物理削除 or アーカイブ (論理削除) どちらか
  - 推奨: アーカイブ (紐づく DigitalContent があるため)
- [ ] サムネイル生成をいつ実装するか (Phase 1 or Phase 2)
- [ ] 動画のバージョン管理 (差し替え時に旧ファイルを残すか)
  - 推奨: 残さない (Blob 削除)、変更履歴だけ operation-log
- [ ] 動画長の下限/上限バリデーション (5秒〜3分想定?)
- [ ] iPad Safari での再生確認 (MP4 H.264 必須)

## 10. #38 (動画サイン リアルタイム描画) との関係

- 本仕様書 (動画ライブラリ) は **どちらの動画サイン方式でも必要**
  - 現状の静止 PNG 方式でも、リアルタイム描画型 (#38) でも
    「原本動画をアップロード → 商品に紐付ける」フローは共通
- **#38 実装の前に本仕様を先に片付ける**のが順序として自然:
  1. 動画ライブラリ完成
  2. 商品編集で動画を選択できる
  3. タレントがサインを書く (現状の PNG 方式 or #38 のリアルタイム方式)
  4. 購入者が視聴

## 11. 参考

- 関連: `docs/signed-video-spec.md` (静止 PNG 方式の設計)
- 関連: `docs/signed-video-realtime-spec.md` (#38 リアルタイム描画型の設計)
- 実装参考: `src/components/admin/ProductForm.tsx` の ImageUploadField 部分
