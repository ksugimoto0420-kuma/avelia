# 開発オンボーディング

Avelia FunClub プロジェクトの開発に参加するメンバー向け。**このドキュメントを読めば、初日から作業を始められる**ことをゴールにしています。

より詳しい規約は `docs/dev-workflow.md` を参照してください。

---

## 1. リポジトリ

**メインリポジトリ:** https://github.com/how-collect/avelia-funclub

**サブリポジトリ（個人ミラー）:** https://github.com/ksugimoto0420-kuma/avelia
※ 現在は個人アカウントにも同期していますが、how-collect が正式リポです。

### 最初にやること

```bash
git clone https://github.com/how-collect/avelia-funclub.git
cd avelia-funclub
npm install
```

環境変数（`.env`）は別途 Slack / 1Password で共有します。

---

## 2. ブランチ運用（Git Flow）

```
main       ●───────────●───→  本番（Vercel Production）
            \         /
             \       /
develop    ───●──●──●──────→  開発の統合先（Vercel Preview）
                \  /
             feat/xxx        作業ブランチ
```

### 使うブランチ

| ブランチ    | 何のためのブランチか                          | 触っていいか       |
| ----------- | --------------------------------------------- | ------------------ |
| `main`      | 本番デプロイ用                                | ❌ 直接触らない     |
| `develop`   | 開発中の最新                                   | ❌ 直接触らない     |
| `feat/xxx`  | 新機能を作る自分専用ブランチ                    | ✅ ここで作業する   |
| `fix/xxx`   | バグ修正用の自分専用ブランチ                    | ✅ ここで作業する   |

### ブランチ名のつけ方

`<type>/<issue番号>-<英語で短い説明>`

例:
- `feat/23-signup-form`  ← Issue #23 の新機能
- `fix/45-login-error`   ← Issue #45 のバグ修正
- `docs/57-readme`       ← Issue #57 のドキュメント修正

`type` は以下から選びます:

| type       | 使うとき                     |
| ---------- | ---------------------------- |
| `feat`     | 新機能                       |
| `fix`      | バグ修正                     |
| `docs`     | ドキュメントのみ             |
| `refactor` | 挙動を変えないコード整理     |
| `chore`    | 依存更新・設定変更           |

---

## 3. 作業の流れ（毎日これを繰り返します）

### ① Issue を選ぶ

まず、[Issues一覧](https://github.com/how-collect/avelia-funclub/issues) から自分がやる Issue を選ぶ、または新しく Issue を作ります。

**Issue には目的・受け入れ条件を書きます。**「これができたら完了」がハッキリしていない Issue には手を付けません。分からなければコメントで質問。

### ② 最新の develop を取り込む

```bash
git checkout develop
git pull origin develop
```

### ③ 作業ブランチを切る

```bash
git checkout -b feat/23-signup-form
```

### ④ コードを書く・コミットする

```bash
git add .
git commit -m "feat(auth): add email verification to signup"
```

コミットメッセージのルールは後述。

### ⑤ Push する

```bash
git push -u origin feat/23-signup-form
```

### ⑥ PR（Pull Request）を作る

GitHub の画面で **New Pull Request** を押す、または CLI で:

```bash
gh pr create --base develop
```

**PRを作るとき:**
- **base（マージ先）は `develop`**（`main` にはしない）
- タイトルは Conventional Commits 形式
- 本文はテンプレが自動で出るので埋める
- 本文に `Closes #23` と書くと、merge時に自動で Issue が閉じる

### ⑦ Vercel Preview URL で動作確認

PR を作ると Vercel が Preview URL をコメントしてくれます。そこで動作確認します。

### ⑧ Merge する

問題なければ **Merge pull request → Create a merge commit** を選んで merge。
その後の画面で **Delete branch** を押して作業ブランチを削除します。

---

## 4. Issue の使い方

### いつ Issue を立てるか

- 新しい機能を作る前
- バグを見つけたとき
- 仕様の変更を提案するとき
- 何を作るか調査したいとき（スパイク）

**軽微な typo 修正など、5分で終わる話は Issue なしで直接 PR でも OK。**

### Issue の作り方

[New Issue](https://github.com/how-collect/avelia-funclub/issues/new/choose) から、3種類のテンプレを選べます:

- **機能追加・改善**（`feature.md`）
- **バグ報告**（`bug.md`）
- **技術調査・スパイク**（`spike.md`）

テンプレに従って埋めるだけで OK です。

### ラベル

Issue には自動でラベルが付きます。必要に応じて追加:

- `type: xxx` → Issue の種類（feature / bug / docs / spike / chore）
- `scope: xxx` → どの機能領域か（kuji / orders / photobook / lottery / infra / ci）
- `pr-1 優先度 高` `pr-2 優先度 中` `pr-3 優先度 低` → 優先度

---

## 5. コミットメッセージのルール（Conventional Commits）

### 基本形

```
<type>(<scope>): <subject>
```

**例:**

```
feat(kuji): add draw animation
fix(photobook-viewer): correct page order on mobile
docs: update onboarding guide
chore(deps): bump next to 15.1.0
```

### type 一覧

| type       | 使うとき                                     |
| ---------- | -------------------------------------------- |
| `feat`     | 新機能                                       |
| `fix`      | バグ修正                                     |
| `docs`     | ドキュメントのみ                             |
| `style`    | コード整形・空白調整（挙動変更なし）         |
| `refactor` | リファクタ（挙動変更なし・機能追加なし）     |
| `perf`     | パフォーマンス改善                           |
| `test`     | テスト追加・修正                             |
| `chore`    | ビルド・ツール・依存・設定など               |

### scope の例

`kuji`, `photobook`, `orders`, `lottery`, `admin`, `viewer`, `db`, `deploy`, `ci`

---

## 6. PR のルール

### 大事なこと

- **base ブランチは必ず `develop`**（`main` は本番なので触らない）
- **タイトルはコミットメッセージと同じ形式**
- **本文には動作確認手順を書く**（自分が忘れないため & レビュワーのため）
- **UI 変更があればスクショか Preview URL を貼る**
- **Issue番号を `Closes #23` で紐付ける**

### merge 方式

**Create a merge commit** を選びます。
Squash や Rebase は使いません。理由は「作業中の細かい試行錯誤も履歴として残したい」から。

### 誰かにレビューを頼むとき

右側の **Reviewers** から追加します。

---

## 7. リリースフロー

**このセクションはリリース担当者だけが読めば OK。**

`develop` にたまった機能を本番（`main`）に上げるときの流れです:

```bash
# 1. develop から release ブランチを切る
git checkout develop && git pull
git checkout -b release/0.3.0

# 2. バージョン更新（package.json など）
# 3. Preview で最終確認
# 4. main に merge & タグ打ち
git checkout main && git merge --no-ff release/0.3.0
git tag -a v0.3.0 -m "Release 0.3.0"
git push origin main --tags

# 5. develop にも取り込む
git checkout develop && git merge --no-ff release/0.3.0
git push origin develop
```

本番で緊急対応が必要なとき（Hotfix）は `main` から `hotfix/xxx` を切って、修正後 `main` と `develop` の両方にマージします。

---

## 8. よくある質問

### Q. `main` に間違えてコミットしそうになった

`main` はブランチ保護がかかっているので、直接 push すると弾かれます。
やってしまったら:

```bash
# コミットを別ブランチに移す
git branch feat/rescue-work
git reset --hard origin/main
git checkout feat/rescue-work
```

### Q. PR のレビューって誰がやるの？

現状はメンバーが少ないので、**自分でチェック（セルフレビュー）→ merge** で OK。
チームが増えたら Required approvals を設定します。

### Q. Vercel の環境変数を追加したい

Vercel ダッシュボードから追加。Production / Preview / Development の3スコープに分けて登録します。追加した内容は Slack で共有してください。

### Q. Prisma のマイグレーションを本番に流したい

自動化されていません。手順は `docs/db-migration-guide.md`（Issue #12 で作成予定）を参照。

### Q. Claude Code（AI）に作業させたい

このプロジェクトでは Claude Code を積極的に使っています。以下のルールがあります:

- Claude が作るコミットには `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` を付ける
- **`main` への直接プッシュは Claude では原則行わない**
- 依頼するときは **Issue 番号 or PR 番号** を渡すと文脈が明確になります

---

## 9. ファイルストレージ（Vercel Blob）

画像・PDF・動画は `src/lib/storage/` のドライバー経由で扱います。**必ず `bucket` を指定**します。

```ts
import { storage, StoragePaths } from "@/lib/storage";

const stored = await storage.put(buffer, file.name, {
  bucket: "private-digital",              // 用途に合った bucket
  pathnamePrefix: StoragePaths.photobookSigned(orderId),
});
```

### バケット選択の指針

| 保存物 | 使う bucket |
| --- | --- |
| 商品画像・公開バナー | `public-assets` |
| 購入者向け写真集PDF・動画 | `private-digital` |
| 管理者作業素材（ベース画像・CSV） | `private-admin` |
| 一時ファイル | `private-temp` |

### 開発時のセットアップ

**ローカルでファイルシステム保存で済ませる場合（デフォルト）:**

```
STORAGE_DRIVER=local
```

**個人 Vercel Blob に接続してテストしたい場合:**

1. Vercel ダッシュボード → Storage → Create → Blob
2. Region: **Tokyo (hnd1)** / Access mode: **Private** で作成（後から変更不可）
3. ストア画面の Quickstart → `.env.local` タブでトークンをコピー
4. `.env.local` に追記:
   ```
   STORAGE_DRIVER=vercel-blob
   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxx
   ```

### やってはいけないこと

- **同じ pathname に上書きしない**（Vercel Blob にバックアップ機能がないため）
- **`STORAGE_DRIVER` を変えても DB の bucket 列は変えない**（マイグレーションで対応）
- **アクセスモード（public/private）を後から変えない**（ストア作成時に確定）
- **トークンをコミットしない**（`.env.local` は Git 管理外なので安全）

### 参考

- 設計仕様: [docs/storage-strategy.md](storage-strategy.md)
- Vercel Blob 公式: https://vercel.com/docs/vercel-blob

---

## 10. リンク集

### 開発ドキュメント

| ドキュメント                       | 内容                                     |
| ---------------------------------- | ---------------------------------------- |
| `docs/onboarding.md`               | このガイド                               |
| `docs/dev-workflow.md`             | 開発ワークフロー詳細版                   |
| `docs/avelia-kuji-spec.md`         | オンラインくじの仕様                     |
| `docs/orders-invoice-batch-spec.md`| 注文管理の仕様                           |
| `docs/signed-photobook-research.md`| 写真集ビューアの技術調査                 |
| `docs/signed-video-spec.md`        | サイン付き動画の仕様                     |
| `docs/issue-backlog.md`            | 起票済みバックログの一覧                 |
| `docs/storage-strategy.md`         | ファイルストレージ設計仕様               |

### 外部サービス

| サービス    | 用途                     | URL / 場所                                 |
| ----------- | ------------------------ | ------------------------------------------ |
| GitHub      | ソース管理・Issue・PR    | https://github.com/how-collect/avelia-funclub |
| Vercel      | デプロイ                 | Vercel ダッシュボード                       |
| Neon        | PostgreSQL DB            | Neon ダッシュボード                         |
| Vercel Blob | 画像・PDF・動画ストレージ| Vercel ダッシュボード → Storage             |
| Stripe      | 決済                     | Stripe ダッシュボード                       |

---

## 11. 困ったら

- **Issue でコメント** — 質問・相談・仕様確認
- **Slack** — リアルタイムで話したいとき

「これで合ってる？」と聞くのは全然 OK です。**最悪の行動は「勝手に判断して `main` を壊す」**。迷ったら止まって聞いてください。
