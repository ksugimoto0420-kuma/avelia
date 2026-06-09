# Avelia FunClub

アーティスト・アイドル・IPコンテンツのファン向け **イベント販売EC / デジタルコンテンツ販売基盤**。
期間限定 / 数量限定 / 抽選販売、購入制限、在庫仮確保、外部決済（Stripe）、デジタルコンテンツライブラリ、R/S売上集計、制作・発送リストCSV出力までを一体で管理します。

スクラッチ開発仕様書（`scratch_event_ec_spec.docx`）に基づく実装です。

## 技術スタック

| 分類 | 採用 |
| --- | --- |
| フレームワーク | Next.js 15（App Router / Server Components） |
| 言語 | TypeScript |
| CSS | Tailwind CSS v4 |
| DB | PostgreSQL + Prisma |
| 認証 | Auth.js（NextAuth v5）— user / admin 分離、admin はロール（owner/manager/operator/viewer） |
| 決済 | Stripe Checkout + Webhook（PAY.JP は拡張用スタブ） |
| ストレージ | ローカル（`./storage`）。本番は S3 互換に差し替え |
| メール | Resend（未設定時はコンソール出力にフォールバック） |

## ディレクトリ構成

```
src/
  app/
    (user)/        … ECサイト（/ , /events , /products , /cart , /checkout , /mypage , /auth …）
    admin/         … 管理画面（/admin/...）
    api/           … Route Handlers（auth, cart, orders, payments, webhooks, admin, cron …）
  components/
    ui/            … 汎用UI（Button, Card, Input, Modal, Badge, DataTable, Pagination …）
    user/          … ユーザー向け（Header, ProductCard, CartSummary …）
    admin/         … 管理向け（Sidebar, StatusBadge, ProductForm …）
  lib/             … prisma, auth, payment/stripe, inventory, order, csv, storage, mail …
prisma/
  schema.prisma    … 全テーブル定義
  seed.ts          … ダミーデータ
```

## セットアップ

### 1. 依存インストール

```bash
npm install
```

### 2. 環境変数

```bash
cp .env.example .env
# AUTH_SECRET を生成して設定（例）
#   openssl rand -base64 32
```

主な環境変数（詳細は `.env.example`）:

| 変数 | 用途 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 接続文字列 |
| `AUTH_SECRET` | Auth.js のセッション署名鍵 |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe 決済（未設定ならローカル疑似決済） |
| `RESERVATION_TTL_MINUTES` | 在庫仮確保の有効期限（分）。既定15 |
| `CRON_SECRET` | Cron エンドポイント保護トークン |
| `STORAGE_DRIVER` | `local`（既定）/ S3互換 |
| `MAIL_DRIVER` | `console`（既定）/ `resend` |

### 3. データベース（Docker）

```bash
npm run db:up           # PostgreSQL 16 を起動（docker compose）
npm run prisma:migrate  # マイグレーション適用
npm run db:seed         # ダミーデータ投入
```

### 4. 開発サーバー

```bash
npm run dev
# http://localhost:3000
```

## ログイン情報（seed 投入後）

| 種別 | URL | メール | パスワード |
| --- | --- | --- | --- |
| 一般ユーザー | `/auth/login` | `user@example.com` | `password123` |
| 管理者(OWNER) | `/admin/login` | `admin@example.com` | `password123` |

## 購入フローの確認

1. `/auth/login` でユーザーログイン
2. `/events` → 商品詳細 → カートに追加
3. `/cart` → 「レジに進む」→ `/checkout`
4. 「この内容で決済する」
   - **Stripe 未設定（ローカル）**: 疑似決済が走り、注文が `PAID` になります
   - **Stripe 設定済**: Stripe Checkout に遷移 → 決済 → Webhook で `PAID` 化
5. `/mypage/orders` に注文、`/mypage/digital-contents` にデジタル特典が表示されます

## Stripe Webhook（ローカル）

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# 出力された whsec_... を STRIPE_WEBHOOK_SECRET に設定
```

決済成功で在庫を正式減算し注文を `PAID` に、失敗/期限切れで仮確保を解放します（署名検証あり）。

## 在庫仮確保とオーバーセル防止

- カート投入時は在庫を確認するのみ。**注文作成時にトランザクション内で行ロック（`SELECT ... FOR UPDATE`）して仮確保**します（`src/lib/inventory.ts` / `src/lib/order.ts`）。
- 仮確保には TTL（既定15分）。期限切れは Cron で解放します。
  ```bash
  curl "http://localhost:3000/api/cron/release-reservations?secret=$CRON_SECRET"
  ```
- 決済成功 Webhook で `reserved → sold` に確定。

## 主要機能（仕様書対応）

- 通常 / 期間限定 / 数量限定 / 抽選販売、1注文・1ユーザー累計・イベント単位の購入制限
- 外部決済（カード番号は非保持。外部決済IDのみ保存）
- デジタルコンテンツ付与・認可済み配信（直アクセス不可。本番は署名付きURL）
- 管理画面：ダッシュボード / イベント / 商品 / 在庫 / 注文 / 決済 / 抽選 / デジタルコンテンツ / R/S / 操作ログ
- 制作リスト・発送リスト・注文・R/S の CSV 出力（UTF-8 BOM 付き）
- 管理者操作の監査ログ（`operation_logs`）

## デプロイ（Vercel）

- GitHub 連携で `main` を Production、PR を Preview に。
- 環境変数は Vercel の Environment Variables に設定。
- `vercel.json` の Cron で仮確保解放を5分毎に実行。
- ロールバックは Deployment History から。

## npm スクリプト

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー |
| `npm run build` | 本番ビルド（`prisma generate` 込み） |
| `npm run db:up` / `db:down` | PostgreSQL（Docker）起動 / 停止 |
| `npm run prisma:migrate` | マイグレーション |
| `npm run db:seed` | ダミーデータ投入 |
| `npm run prisma:studio` | Prisma Studio |

## 初期スコープ外（将来拡張）

繰り上げ当選、待機室、高度な不正検知、外部物流API連携、R/S自動精算、複数テナント化、アプリ化。
