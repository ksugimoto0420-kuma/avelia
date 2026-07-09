# Issue 棚卸しドラフト

現状の未解決作業を Issue として棚卸ししたもの。GitHub の Issue 一覧に手動 or gh CLI で投入する。
投入完了したら Issue 番号を横に追記して、このファイルは履歴として残す。

Status:
- [ ] = 未投入
- [x] = 投入済（GitHub Issueとして起票済み）

---

## Avelia kuji（オンラインくじ）

### [ ] Stripe決済 → 抽選のフロー本番化 (`type: feature`, `scope: kuji`, `priority: high`)

**概要**
現状デモ版は「ガチャを回すと同時に PAID 扱い」で動いており、実売にはならない。
本番では Stripe Checkout / PaymentIntent 完了 webhook を受けてから抽選 → 結果表示のフローに切り替える必要がある。

**背景**
- 現状のデモ実装だと購入前にガチャが回り、無料で当選できてしまう
- `docs/avelia-kuji-spec.md` の Section 13 に整理済み

**受け入れ条件**
- [ ] Stripe Checkout 経由での決済完了を webhook で受ける
- [ ] webhook 内で KujiDraw を作成し、当選賞品を確定
- [ ] 決済成功後の返り遷移で当選演出 + 結果を表示
- [ ] 決済失敗 / キャンセル時は在庫を戻す
- [ ] マイページ「くじ履歴」に PAID の Draw のみが反映

**メモ**
- 賞品在庫の予約（決済中は仮押さえ）が必要か検討
- 既存 Order / OrderItem との統合はしない（別モデル維持）

---

### [ ] 商品マスタとくじ賞品の統合検討 (`type: spike`, `scope: kuji`)

**概要**
現状 KujiPrize は自前でタイトル・画像・数量を持ち、既存の Product とは切り離されている。
将来的に「くじ賞品 = 商品マスタの1つ」として統合するかを検討する。

**背景**
- `docs/avelia-kuji-spec.md` Section 14 に整理済み
- 統合すると在庫管理は楽になる一方、確率賞（在庫概念なし）との整合が課題

**成果物**
- [ ] `docs/kuji-product-unification-research.md` に統合案 / 分離維持案の比較表
- [ ] 結論（今のところは分離維持を推奨、根拠を明文化）

---

## 注文管理（Orders）

### [ ] 管理画面：イベント別注文フィルタ (`type: feature`, `scope: orders`)

**概要**
注文一覧をイベントで絞り込めるようにする。

**背景**
`docs/orders-invoice-batch-spec.md` に整理済み。運用時に「このイベントの注文だけ見たい」というニーズが強い。

**受け入れ条件**
- [ ] イベントセレクタで絞り込める
- [ ] URLクエリと連動（`?eventId=xxx`）
- [ ] 選択中イベントに紐づく注文のみ表示

---

### [ ] 注文書PDF生成（@react-pdf/renderer） (`type: feature`, `scope: orders`)

**概要**
注文単位で「注文書 / 領収書」相当のPDFを発行する。

**受け入れ条件**
- [ ] 個別注文からPDFダウンロード
- [ ] レイアウトはアベリア指定のフォーマット（ロゴ・宛名・明細・合計）
- [ ] `docs/orders-invoice-batch-spec.md` の様式に沿う

---

### [ ] 注文ステータス一括変更 (`type: feature`, `scope: orders`)

**概要**
複数注文を選択して「発送済」などにまとめて変更できるようにする。

**受け入れ条件**
- [ ] 複数選択チェックボックス
- [ ] 一括ステータス変更ドロップダウン
- [ ] 変更履歴（誰がいつ）が残る
- [ ] 楽観ロック or トランザクションで整合性担保

---

## デジタル写真集

### [ ] Kiss stamp デモ（唇型スタンプ配置） (`type: feature`, `scope: photobook`)

**概要**
写真集のページに「キススタンプ（唇マーク）」を配置できるデモ機能。

**背景**
サイン + 写真集の応用として、キススタンプで擬似リップ跡を残す演出案。
デモ化することで、購入者向け特典UIの表現の幅を検証する。

**受け入れ条件**
- [ ] 唇型 SVG or PNG スタンプを事前準備
- [ ] `admin/photobook-demo` にモード切替（サイン / キス）
- [ ] 位置・サイズ・回転を指定して合成
- [ ] PDF エクスポート可能

---

### [ ] 写真集ビューア - シェア用リンク発行 (`type: feature`, `scope: photobook`)

**概要**
サイン済み写真集を購入者にシェアリンクで見せる仕組み。

**受け入れ条件**
- [ ] 期限付きの署名URL
- [ ] 購入者名の透かしを自動適用
- [ ] 画面録画・スクショ抑制（現状の右クリック・ドラッグ抑制に加えて検討）

---

## 抽選（Lottery）

### [ ] 抽選結果通知メール (`type: feature`, `scope: lottery`)

**概要**
抽選確定後、当選者・落選者にメール通知する。

**受け入れ条件**
- [ ] SendGrid or Resend で送信
- [ ] 当選テンプレ / 落選テンプレの2種
- [ ] 送信ログを残す
- [ ] 冪等性（二重送信防止）

---

## インフラ / 運用

### [ ] Vercel Preview 用 DB ブランチの分離 (`type: chore`, `scope: infra`)

**概要**
現状 develop / feature プレビューも本番 DB を参照している可能性がある。
Neon の DB ブランチ機能を使い、Preview 環境は別ブランチ DB を見るようにする。

**受け入れ条件**
- [ ] Neon で `preview` ブランチ作成
- [ ] Vercel の Preview スコープに `preview` DB の接続URL設定
- [ ] Preview 環境で本番データを触らないことを確認

---

### [ ] CI: 型チェック + lint の自動実行 (`type: chore`, `scope: ci`)

**概要**
PR 作成時に GitHub Actions で型チェック・lint を自動実行し、ステータスチェックとして表示する。

**受け入れ条件**
- [ ] `.github/workflows/ci.yml` を追加
- [ ] `tsc --noEmit` と `next lint` を並列実行
- [ ] main / develop への PR にステータス表示
- [ ] Vercel Deploy と共存

---

### [ ] Prisma マイグレーションの安全な適用手順を文書化 (`type: docs`, `scope: infra`)

**概要**
Vercel の advisory lock 事故を踏まえ、本番 DB へのマイグレーション適用手順を明文化する。

**受け入れ条件**
- [ ] `docs/db-migration-guide.md` を作成
- [ ] 手順: ローカル検証 → Preview DB 検証 → 本番適用 → デプロイ
- [ ] Zombie connection への対処方法（pg_terminate_backend）を記載
- [ ] `prisma migrate deploy` を build から外している理由を記録
