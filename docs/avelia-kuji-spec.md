# アベリアくじ 仕様書（MVP）

参考: https://sukisuki-shop.com/kuji

## 1. コンセプト

オンラインガチャ型の販売チャネル。1回 ¥XXX を決済すると、その場で抽選されて
「S/A/B...賞」のいずれかが当たる。当たった賞は実品として後日配送される。
連数（10連/50連/100連）まとめ買い時には連数限定オマケが付く。

## 2. ユースケース

- イベント中／配信中にスマホ・タブレットでガチャを引いてもらう
- 「ハズレなし」で必ず何かが当たる体験で気軽に楽しんでもらう
- 連数を上げるほどお得感（限定オマケ）を付けて課金単価を上げる

## 3. 商品設計

### 3-1. KujiCampaign（くじ本体）
- タイトル、説明、バナー画像
- 紐づくEvent（任意）
- 販売開始日時 / 販売終了日時
- 1回あたりの単価
- 配送目安テキスト（例:「2026年10月下旬」）
- 注意事項テキスト（自由記述）
- ステータス: DRAFT / OPEN / CLOSED
- 1ユーザー購入上限: **設けない**

### 3-2. KujiPrize（賞）
- ランク文字列（"S","A","B",...）と表示順（自由に追加可能、**上限なし**）
- 名称、画像、バリエーション説明文（「14種：各キャラA/B」など）
- **賞タイプ**:
  - `LIMITED`（本数制）: 在庫数を持ち、引かれるたび -1。0で排出停止
  - `PROBABILITY`（確率制）: 在庫無制限、重み付き抽選
- 本数（LIMITED 用）: 総本数 / 残数
- 確率重み（PROBABILITY 用）: 整数weight（例: 30 = 0.30%）
- 連数限定フラグ（10連/50連/100連オマケ用）

### 3-3. KujiBundle（連数SKU）
- 連数（1 / 10 / 50 / 100）
- セット価格（割引可能）
- 連数オマケ賞ID（任意。指定するとその賞が必ず追加で1本付く）
- SKU文字列

## 4. 抽選ロジック

### 4-1. 1回の抽選
1. LIMITED 賞のうち remainingCount > 0 を「上位枠候補」に
2. 上位枠の出現重みを「残数の何分の1か」で計算（要は枯渇していない上位賞は均等）
3. 上位枠のうち、選ばれた賞に対し原子的に
   `UPDATE prize SET remainingCount = remainingCount - 1 WHERE id = ? AND remainingCount > 0`
   を発行 → 1行影響したら確定、0行なら他の購入者に取られたので再抽選
4. 上位枠で当たらなかった場合、PROBABILITY 賞をweighted抽選
5. **上位賞の本数が果てたら、その分の確率は下位 PROBABILITY 賞に按分**される
   - 設計: PROBABILITY 賞の weight 合計を 10000 とし、LIMITED が枯渇したら丸ごと PROBABILITY 抽選に倒す
   - 「ハズレなし」を維持
6. **連数まとめ買い特典**: 抽選ループ後に bonusPrizeId を追加で1本付与

### 4-2. 競合制御
- すべてサーバーサイドのトランザクション内で実行
- LIMITED の残数操作は楽観的ロック（UPDATE WHERE remainingCount > 0）
- 100連の途中で枯渇しても残りは PROBABILITY 抽選に自動切替

## 5. 購入フロー

```
くじ詳細ページ
  ↓ 「1連 ¥770 / 10連 ¥7,700 / 50連 ¥38,500 / 100連 ¥77,000」
[認証チェック]
  未ログイン → ログインへ
  ↓
[決済（Stripe）]
  成功
  ↓
[サーバーで抽選実行]
  連数分ループ + 連数オマケ
  ↓
[KujiDraw + Order + OrderItem 作成]
  ↓
[/kuji/[id]/result/[orderId] へ遷移]
  ↓
[ガチャ演出 (SVG/Lottie 系)]
  ジャジャーン... → 賞のフラッシュ → 画像と名前表示
  連数の場合は早送り可、一括表示モードも用意
  ↓
[マイページ・注文履歴に履歴反映]
  ↓
[後日 実品配送]
```

## 6. UI構成

### 6-1. ユーザー側
- `/kuji` — くじ一覧（販売中/終了 ステータスフィルター）
- `/kuji/[id]` — くじ詳細（賞構成テーブル + 確率 + 注意事項 + 購入ボタン）
- `/kuji/[id]/result/[orderId]` — ガチャ演出 + 結果表示
- `/mypage/orders` — 注文履歴に「アベリアくじ」も表示

### 6-2. 管理側
- `/admin/kuji` — くじ一覧
- `/admin/kuji/new` — 新規作成
- `/admin/kuji/[id]` — 編集（基本情報・賞・SKU・連数オマケ）
- `/admin/kuji/[id]/draws` — 抽選履歴一覧（誰が何を引いたか・在庫残数）

## 7. Prisma スキーマ案

```prisma
model KujiCampaign {
  id              String       @id @default(cuid())
  title           String
  description     String?
  bannerImageUrl  String?
  eventId         String?
  saleStartAt     DateTime
  saleEndAt       DateTime
  pricePerDraw    Int
  deliveryNote    String?
  notesText       String?
  status          KujiStatus   @default(DRAFT)
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  event           Event?       @relation(fields: [eventId], references: [id])
  prizes          KujiPrize[]
  bundles         KujiBundle[]
  draws           KujiDraw[]

  @@map("kuji_campaigns")
}

enum KujiStatus { DRAFT OPEN CLOSED }

model KujiPrize {
  id                String       @id @default(cuid())
  campaignId        String
  rank              String       // "S","A","B"...
  order             Int          // 表示順
  name              String
  imageUrl          String?
  variantNote       String?
  type              KujiPrizeType
  totalCount        Int?         // LIMITED 用
  remainingCount    Int?         // LIMITED 用
  probabilityWeight Int?         // PROBABILITY 用 (合計10000基準)
  bundleOnly        Boolean      @default(false)

  campaign          KujiCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  draws             KujiDraw[]
  bundleSlots       KujiBundle[] @relation("BundleBonus")

  @@index([campaignId, order])
  @@map("kuji_prizes")
}

enum KujiPrizeType { LIMITED PROBABILITY }

model KujiBundle {
  id            String        @id @default(cuid())
  campaignId    String
  drawCount     Int           // 1, 10, 50, 100
  priceTotal    Int
  bonusPrizeId  String?
  sku           String?       @unique

  campaign      KujiCampaign  @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  bonusPrize    KujiPrize?    @relation("BundleBonus", fields: [bonusPrizeId], references: [id])

  @@unique([campaignId, drawCount])
  @@map("kuji_bundles")
}

model KujiDraw {
  id            String       @id @default(cuid())
  campaignId    String
  userId        String
  orderId       String
  prizeId       String
  isBundleBonus Boolean      @default(false)
  drawnAt       DateTime     @default(now())

  campaign      KujiCampaign @relation(fields: [campaignId], references: [id])
  user          User         @relation(fields: [userId], references: [id])
  order         Order        @relation(fields: [orderId], references: [id])
  prize         KujiPrize    @relation(fields: [prizeId], references: [id])

  @@index([campaignId, drawnAt])
  @@index([userId])
  @@index([orderId])
  @@map("kuji_draws")
}
```

## 8. 演出

- 段階1（MVP）: SVG + CSS アニメによる軽量演出
  - カプセル落下 → 開封フラッシュ → 賞ランク表示 → 賞画像表示
- 段階2: Lottie JSON 差し替え可能なコンポーネント設計
- 連数結果は1本ずつ表示する「順送り」と「一覧で見る」の両モード

## 9. 結果の納品

- **実品配送前提**
- 既存の `Order` / `OrderItem` / `Shipment` の流れに乗せる
- 各賞は内部的に「商品 (Product)」として参照され、orderItem に追加される
- 後日デジタル賞も追加できる設計余地は残す（賞 → 商品 関連の中間モデルで差し替え可）

## 10. MVPに含めるもの

- 管理側CRUD（くじ・賞・SKU・連数オマケ）
- ユーザー側くじ詳細
- 購入即時抽選 + 即時表示
- ガチャ演出（SVG）
- 結果表示・マイページ履歴
- 本数制+確率制ハイブリッド + 在庫枯渇時の按分
- 連数オマケ
- 在庫切れ・期間外の購入ブロック
- 管理側で抽選履歴閲覧

## 11. MVPでやらないもの（次フェーズ）

- ラストワン賞 / Wチャンス賞
- 当選統計ダッシュボード
- ガチャ動画の高品質化（Lottie）
- デジタル賞の付与フロー
- 自動キャンセル/返金
- 賞ごとの個別演出差し替え

## 12. 実装順序

1. Prisma スキーマ追加 + migration
2. 管理画面: くじ作成・編集・賞編集・SKU編集
3. ユーザー側: くじ一覧 + 詳細ページ
4. 抽選ロジック（lib/kuji/draw.ts）
5. 購入フロー連携（決済 → 抽選 → KujiDraw作成）
6. ガチャ演出ページ
7. マイページ履歴連携
8. 管理画面の抽選履歴ビュー
9. テストデータ生成スクリプト + 手動E2E

## 13. ⚠️ デモ実装の制限と本番化時の必須変更

**【重要】現状の実装はデモ専用であり、本番運用には致命的な不備があります。**

### 13-1. 現状（デモ）の挙動
- ユーザーが「N連購入」ボタンを押した瞬間にサーバーで `drawKuji` が走る
- 同時に `Order` を `status=PAID` で作成（決済を一切経由しない）
- 結果として「**1円も払わずにガチャを引ける**」状態
- マイページの注文履歴に「金額あり・商品なし」の意味不明な PAID 注文が並ぶ

### 13-2. 本番化時に必須の変更

#### 13-2-1. 抽選は決済成功後に実行する
ガチャはユーザーがリクエストしたタイミングではなく、**Stripe webhook で
`checkout.session.completed` を受け取った瞬間にサーバー側で実行**する。

```
[1連購入ボタン]
   ↓
[Stripe Checkout Session 作成]（抽選はしない）
   ↓
[ユーザーが Stripe で決済]
   ↓
[Stripe webhook: checkout.session.completed]
   ├─ drawKuji 実行
   ├─ Order を PENDING → PAID
   ├─ KujiDraw 記録
   └─ /kuji/[id]/result/[orderId] へ誘導
       ↓
[ガチャ演出（結果を取得して再生するだけ）]
```

#### 13-2-2. result ページの責務分離
- 現在: 「演出 = 抽選結果の表示」
- 本番: 「演出 = 既に確定した結果の演出再生」（抽選はもう終わっている）
- ページ初回アクセス時に KujiDraw が無ければ「処理中…」と表示し、
  webhook 完了をポーリング or SSE で待つ

#### 13-2-3. タダ引き防止のサーバーガード
- `drawKuji` を呼べる経路を限定する（Stripe webhook 内のみ）
- もしくは `Order.status` が `PAID` の場合のみ抽選結果を保存できるよう原子的に検査
- リトライ攻撃に備えて idempotency key（Stripe session_id）でガード

#### 13-2-4. 注文履歴への扱い
- kuji の Order は通常物販と並べて出すと購入者の混乱を招く
- マイページに **「アベリアくじ履歴」** を独立して用意し、当選結果と
  注文番号・配送状況をまとめて見せるのが理想

### 13-3. デモ段階での暫定対応（実装済）
- マイページ「注文履歴」から kuji の Order を除外する
- マイページに「アベリアくじ履歴」を新設し、KujiDraw を一覧表示する
- これにより「タダで引いた Order が履歴に残る」見た目の違和感を解消する

### 13-4. カート統合（将来検討）
- 特典会グッズと一緒に「N連」をカートに入れてまとめ決済したいニーズあり
- KujiBundle を CartItem に乗せられるよう ProductVariant 互換のシムが必要
- 検討は次フェーズ以降。MVP は単体購入で良い。

## 14. ⚠️ 未解決の重大設計課題：賞品と商品マスタの一本化

**【必読】MVPでは「KujiPrize は独立した在庫管理」となっており、これは本番運用で
破綻するため、本番化前に一本化が必要です。**

### 14-1. 現状の問題

```
Product / ProductVariant / Inventory          ← 物販・特典会の在庫
KujiPrize.remainingCount                       ← くじ専用の在庫（独立！）
```

くじの賞品は **商品マスタの外** に存在しているため、以下が壊れる:

| ケース | 起きる事故 |
|---|---|
| 同じ商品（例: サイン入りポスター）を物販とくじ両方に出したい | 在庫が分裂、合計本数が制御不能 |
| くじで余った賞品を在庫処分で売りたい | KujiPrize → Product への変換手段なし、人手で重複登録 |
| 倉庫向け制作リスト CSV | くじ当選分は OrderItem を作らないので CSV に出ない |
| 倉庫向け発送リスト CSV | 同上、当選品が出荷漏れる |
| 倉庫区分 (IN_HOUSE / WAREHOUSE) | Product にはあるが KujiPrize にはない、振り分け不能 |
| サイン納品が必要な賞品 | DigitalDelivery 連携が走らない |

### 14-2. 一本化の設計案

KujiPrize に「ProductVariant への参照」を持たせて、賞品の本体は商品マスタに置く:

```prisma
model KujiPrize {
  id          String   @id
  campaignId  String
  rank        String
  order       Int

  // 賞の本体は ProductVariant を参照する
  variantId   String?  // 物販と共有する場合は紐付け、くじ専用なら null

  // 表示用（variant がある場合は variant のものを優先）
  name        String
  imageUrl    String?
  variantNote String?

  // くじキャンペーン内での割当
  type              KujiPrizeType
  allocatedCount    Int?    // このくじに割り当てた本数（LIMITED）
  remainingCount    Int?    // 残数
  probabilityWeight Int?
  bundleOnly        Boolean

  variant     ProductVariant? @relation(fields: [variantId], ...)
}
```

### 14-3. 移行に必要な変更

1. **抽選ロジック**: 当選時に
   - KujiPrize.remainingCount を減らす
   - variant がある場合は Inventory.quantity も減らす（StockReservation 経由）
   - OrderItem を作成（既存の物販フローに乗せる）
2. **管理画面**: 賞作成時に「既存の商品から選ぶ」or「くじ専用商品として登録」のスイッチ
3. **発送リスト・制作リスト CSV**: 自動的にくじ当選品が乗るようになる（OrderItem 経由）
4. **データ移行**: 既存のテスト用 KujiPrize を Product/ProductVariant に作り直す or 「くじ専用」フラグで温存
5. **Stripe webhook 連携**: 13-2 の本番化変更と同時に実装

### 14-4. 本番化タイミング

- 13. の「Stripe webhook 経由の抽選」と一緒に着手する
- 単独で進めると整合性が取れないので、本番化フェーズで一気に変更する
- 仮にデモを延長する場合も、MVPの公開前には必ず対応する

### 14-5. デモ段階での割り切り

- 現状の独立在庫モデルは「ガチャの動作だけを見せる」用途には十分
- 本番運用には不適切なので、本番化前に必ず再設計する
- このメモを残しておくのは、本番化時に「なぜ KujiPrize.remainingCount が
  あるのか」「なぜ OrderItem が空なのか」を読み解くため
