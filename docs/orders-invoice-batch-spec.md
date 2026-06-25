# 注文管理拡張 仕様書（MVP）

要望: 注文管理のイベント別管理、納品書 DL、納品書一括 DL、ステータス一括変更

## 1. スコープ

### 1-1. やること
1. 注文一覧 `/admin/orders` に **イベント絞り込み** を追加
2. イベント詳細 `/admin/events/[id]` に **関連注文を見るリンク** を追加
3. マイページ注文詳細から **納品書 PDF をユーザーが DL**
4. 管理画面で **納品書を一括 DL**（ZIP / 連結PDF を選択）
5. 注文一覧で **発送ステータス・注文ステータスを一括変更**（チェックボックス + フッターバー）

### 1-2. やらないこと（次フェーズ）
- 印影画像
- 領収書（インボイス制度対応・適格請求書）
- 自動メール送信（一括 DL 完了通知）
- バックグラウンドジョブキュー（大量件数の非同期処理）

## 2. データモデル変更

### 2-1. サイト設定の拡張

`SiteSetting` モデルに納品書テンプレート用フィールドを追加（既存のテーブルにカラム追加）：

```prisma
model SiteSetting {
  // ... 既存フィールド ...
  invoiceCompanyName      String? // 会社名
  invoicePostalCode       String?
  invoiceAddress          String?
  invoicePhone            String?
  invoiceEmail            String?
  invoiceRepresentative   String? // 代表者名
  invoiceFooterMessage    String? // 「記」の下のメッセージ（テンプレート）
}
```

シードで初期値を入れる。

### 2-2. 注文・発送モデルは変更なし
- 既存の Order / Shipment / Payment をそのまま使う
- イベント別の絞り込みは OrderItem → ProductVariant → Product → Event の経路で対応

## 3. イベント別の注文管理

### 3-1. 一覧フィルター追加
- `/admin/orders` の `OrdersFilterControls` に「イベント」セレクタを追加
- 既存の `event` テーブルを取得して表示
- 選択時のクエリパラメータ: `?eventId={id}`
- where 条件:
  ```ts
  items: { some: { variant: { product: { eventId } } } }
  ```
- 1つの注文に複数イベントの商品が混在する場合も「いずれかが該当」で一覧に出す
- 注文詳細画面では商品をイベント別にグルーピング表示

### 3-2. イベント詳細からの導線
- `/admin/events/[id]` のヘッダーに「📦 関連注文を見る」リンクを配置
- クリックで `/admin/orders?eventId={id}` に遷移

## 4. 納品書 PDF（ユーザー側 DL）

### 4-1. PDF テンプレート

レイアウト（A4 縦）:

```
[ヘッダー]
  発行日: 2026-06-25
  納品書 No. AV-20260625-0001

[宛名（左）]                [発行元（右）]
{購入者名} 様               {会社名}
{郵便番号}                  {郵便番号}
{住所}                      {住所}
                            {電話番号} / {メール}
                            代表: {代表者名}

[本文]
平素は格別のご高配を賜り、誠にありがとうございます。
下記のとおり納品いたしましたのでご査収ください。

[明細テーブル]
  商品名                       単価    数量    小計
  ─────────────────────────────────────────
  {商品名 / バリエーション}    ¥770    2       ¥1,540
  ...
  ─────────────────────────────────────────
  小計                                          ¥XXXX
  送料                                          ¥XXXX
  合計                                          ¥XXXX

[フッターメッセージ]
  {invoiceFooterMessage} （例: このたびはご購入いただき、誠にありがとうございます）
```

### 4-2. ライブラリ・実装
- `@react-pdf/renderer` を導入
- 日本語フォントを `public/fonts/NotoSansJP-Regular.ttf` に同梱
- `Font.register({ family: 'NotoSansJP', src: '/fonts/NotoSansJP-Regular.ttf' })`
- フォントは商用利用可能な Noto Sans JP

### 4-3. ユーザー側ルート

`GET /api/user/orders/[orderId]/invoice`
- 認証必須（NextAuth）
- 自分の注文のみ DL 可
- 注文ステータスが PAID 以上のもののみ（PENDING は不可）
- レスポンス: `application/pdf` ストリーム
- ファイル名: `納品書_{orderNumber}.pdf`

UI 追加箇所: `/(user)/mypage/orders/[orderId]/page.tsx`
- 「📄 納品書をダウンロード」ボタン
- 商品同封用なので発送ステータスが SHIPPED 以降は強調表示

### 4-4. ファイル名規則
- 個別 DL: `納品書_{orderNumber}.pdf`
- 例: `納品書_AV20260625-0001.pdf`

## 5. 納品書の一括 DL

### 5-1. 管理画面 UI
- `/admin/exports/invoices` を新設（既存の制作リスト・発送リスト の並びに追加）
- フィルター:
  - 期間（注文日 from-to）
  - 注文ステータス（既定: PAID 以上）
  - 発送ステータス（既定: PREPARING + SHIPPED + DELIVERED）
  - イベント
- プレビュー: 該当件数を表示
- 出力形式:
  - 「📦 ZIP（1件ごと PDF）」ボタン
  - 「📄 連結 PDF（1ファイル）」ボタン

### 5-2. ZIP フォーマット
- ライブラリ: `jszip`（軽量、Vercel との相性 ◯）
- ファイル名規則: `納品書_{orderNumber}_{購入者名}.pdf`
- ZIP 名: `納品書_{YYYYMMDD}_{件数}件.zip`

### 5-3. 連結 PDF
- @react-pdf/renderer の `<Document>` 内に `<Page>` を件数分連続生成
- 1ファイルにまとまるので連続印刷向き
- ファイル名: `納品書_{YYYYMMDD}_{件数}件.pdf`

### 5-4. 件数上限・パフォーマンス
- **件数上限: なし**（運営判断で運用）
- ただし応答までの時間が長くなる旨を UI に注意書き
- Vercel の serverless 関数タイムアウト: Hobby 10秒、Pro 60秒
- 100件くらいまでは同期 DL でいけるはず、それ以上はタイムアウトリスク
- 操作ログに件数・期間を必ず記録

### 5-5. ルート
- `POST /api/admin/exports/invoices`
  - body: `{ format: "zip" | "pdf", filters: {...} }`
  - レスポンス: `application/zip` or `application/pdf`

## 6. ステータス一括変更

### 6-1. 注文一覧の UI 変更
- テーブル左に **チェックボックス列** を追加
- ヘッダーに「全選択 / 全解除」チェックボックス
- 選択中は画面下部に **固定フッターバー** を出す:
  ```
  [選択中: 12件] [対象: 発送ステータス ▼] [新ステータス: SHIPPED ▼] [実行]
  ```
- 「対象」セレクタで「発送ステータス / 注文ステータス」を切替
- 「実行」で確認モーダル → サーバーアクション実行

### 6-2. 変更可能な遷移

#### 発送ステータス (Shipment)
- `UNFULFILLED → PREPARING`
- `PREPARING → SHIPPED`
- `SHIPPED → DELIVERED`
- `任意 → RETURNED`

#### 注文ステータス (Order)
- `PENDING → CANCELLED`（未払いを一括キャンセル）
- `PAID → REFUNDED`（返金処理は別フロー必要、一括は注意）

### 6-3. バリデーション
- 未払い (PENDING) を SHIPPED にする等の不正遷移はサーバー側で拒否
- 失敗した分は結果モーダルで「N件成功 / M件失敗（失敗理由）」を一覧表示
- トランザクションは1件ずつ（途中失敗で全ロールバックしない）

### 6-4. 操作ログ
- `OperationLog` に「N件一括変更」「対象オーダーID一覧」「変更前後のステータス」を記録
- `action: order.bulk_status_update` / `targetType: Order` / `targetId` は代表 1件 + `detail` に全件

### 6-5. サーバーアクション
- `bulkUpdateShipmentStatus(orderIds: string[], newStatus: ShipmentStatus)`
- `bulkUpdateOrderStatus(orderIds: string[], newStatus: OrderStatus)`
- 各々 transaction で 1件ずつ更新 + ログ記録

## 7. 実装順序の提案

1. **スキーマ拡張**：SiteSetting に納品書フィールド追加 + migration + シード
2. **PDF 生成基盤**：@react-pdf/renderer 導入、フォント同梱、テンプレートコンポーネント作成
3. **個別納品書 DL（ユーザー側）**：API ルート + マイページボタン
4. **イベント別フィルター**：一覧フィルター追加 + イベント詳細リンク
5. **一括ステータス変更**：チェックボックス UI + サーバーアクション + 確認モーダル
6. **一括納品書 DL**：エクスポートページ + ZIP / 連結 PDF
7. **サイト設定 UI**：管理画面 `/admin/settings` で納品書テンプレ情報を編集できるように

## 8. 既存仕様との整合・副作用

- 既存 CSV エクスポートとは別物として並ぶ、影響なし
- 既存の個別ステータス変更（DraftPanel 等）は維持
- DigitalDelivery（サイン納品）の状態管理とは独立
- 既存 `/admin/orders` のフィルターは全件 retrocompatible（eventId 未指定なら従来どおり）

## 9. テストポイント

- 1注文に複数イベントの商品が混在しても正しくイベントフィルターで出る
- 納品書 PDF の日本語表示崩れがない
- 一括変更で 1件失敗しても他は成功する
- 一括 DL の ZIP に同名ファイルが含まれないこと（重複は番号付加）
- マイページから他人の納品書を DL できない（認証チェック）

## 10. 確認点（次回着手時）

- フォントファイル（Noto Sans JP）の同梱位置は public/fonts/ で OK か
- サイト設定 UI の設置タイミング（実装順序 7 を前倒しするか）
- 一括 DL の件数が 200 件超になった場合の運用（次フェーズで非同期化）
