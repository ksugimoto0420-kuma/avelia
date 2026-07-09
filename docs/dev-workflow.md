# 開発ワークフロー

Avelia FunClub プロジェクトの Git 運用ルール。**Git Flow をベースに、Issue駆動 + PRレビュー** で管理する。

---

## 1. ブランチ構成

```
main       ●─────────────●──────●────→   本番デプロイ用（Vercel Production）
            \           /      /
             \         /      /
develop    ───●──●──●─●──●──●──●──────→   開発の統合先（Vercel Preview）
                  \/   \/
             feat/xxx  feat/yyy         短命ブランチ
```

| ブランチ         | 目的                                    | ライフサイクル           |
| ---------------- | --------------------------------------- | ------------------------ |
| `main`           | 本番（Vercel Production）               | 永続。直接コミット禁止   |
| `develop`        | 開発の中心（Vercel Preview）            | 永続。直接コミット原則禁止 |
| `feat/<slug>`    | 新機能開発                              | Issue単位で切って merge 後に削除 |
| `fix/<slug>`     | バグ修正                                | 同上                     |
| `docs/<slug>`    | ドキュメントのみの修正                  | 同上                     |
| `chore/<slug>`   | 依存更新・設定変更など                  | 同上                     |
| `refactor/<slug>`| 挙動変更を伴わないリファクタ            | 同上                     |
| `release/x.y.z`  | リリース準備（バージョン確定・最終検証）| リリース完了で削除       |
| `hotfix/<slug>`  | 本番緊急対応                            | 対応後 main と develop 両方に merge して削除 |

### ブランチ命名規則

`<type>/<issue番号>-<英小文字ハイフン区切りの短い説明>`

例:
- `feat/42-photobook-viewer-share-link`
- `fix/57-kuji-stock-race`
- `docs/61-dev-workflow`
- `hotfix/72-stripe-webhook-500`

Issue番号がないもの（軽微な typo 修正など）は番号を省略可: `docs/fix-typo-readme`

---

## 2. 標準フロー（機能追加・バグ修正）

```
1. Issue作成
   └─ 目的・受入条件・関連リンクを書く

2. develop から作業ブランチを切る
   $ git checkout develop && git pull
   $ git checkout -b feat/42-photobook-share-link

3. 開発 → コミット
   $ git commit -m "feat(photobook): add share link generator"

4. Push
   $ git push -u origin feat/42-photobook-share-link
   $ git push company feat/42-photobook-share-link  # 2リモート運用の場合

5. develop 宛にPR作成
   - タイトル: 変更内容が一目で分かる形
   - 本文: PR テンプレートに沿って記入
   - 説明に "Closes #42" と書いてIssueを紐付け

6. Vercel Preview URL で動作確認

7. Merge commit で develop に取り込む
   - PR が close されると Issue も自動 close

8. リリースタイミングで develop → main を release ブランチ経由で merge
```

---

## 3. コミットメッセージ規約

**Conventional Commits** に準拠。

```
<type>(<scope>): <subject>

<body>

<footer>
```

### type

| type       | 意味                                         |
| ---------- | -------------------------------------------- |
| `feat`     | 新機能                                       |
| `fix`      | バグ修正                                     |
| `docs`     | ドキュメントのみ                             |
| `style`    | コード整形・空白調整（挙動変更なし）         |
| `refactor` | リファクタ（挙動変更なし・機能追加なし）     |
| `perf`     | パフォーマンス改善                           |
| `test`     | テスト追加・修正                             |
| `chore`    | ビルド・ツール・依存・設定など               |
| `revert`   | revert コミット                              |

### scope（例）

`photobook`, `kuji`, `orders`, `lottery`, `admin`, `viewer`, `db`, `deploy`, `ci`

### 例

```
feat(kuji): add hybrid inventory (LIMITED + PROBABILITY)

在庫方式に確率型を追加。確率賞は在庫概念を持たず、
残数UIも「?」表示に切り替える。

Closes #38
```

```
fix(photobook-viewer): only insert blank back-of-cover in spread mode

usePortrait=true のスマホで白紙が本文の間に挟まる問題を修正。
```

---

## 4. PRのルール

### タイトル

コミットメッセージと同じ形式で書く。Squash merge を使わないので、PRタイトル自体を後追い時の目印にする。

- ✅ `feat(kuji): add draw animation with Framer Motion`
- ❌ `くじの改修`

### 本文

`.github/PULL_REQUEST_TEMPLATE.md` に沿って記入する（後述）。特に:

- **Closes #N** の記載必須（Issue が無い軽微な変更は「Issueなし」と明記）
- **動作確認手順** を書く
- **スクショ or Preview URL** を UI 変更時は貼る

### merge方式

**Merge commit** で develop に取り込む。理由:

- 作業中の細かい試行錯誤も履歴として残る
- どのPRで何が入ったかが merge commit で明示される
- あとから「あの機能はどのPRで入ったか」を `git log --merges` で辿れる

---

## 5. Issue運用

### いつIssueを立てるか

- 新機能開発
- バグ報告・修正
- 仕様変更・改善提案
- スパイク調査（技術検証）
- ドキュメント整備

軽微な typo 修正など、議論の余地がなく5分で終わるものは Issue なしで直接PRでもOK。

### Issueテンプレート

`.github/ISSUE_TEMPLATE/` に3種類用意:

| テンプレ            | 用途                                       |
| ------------------- | ------------------------------------------ |
| `feature.md`        | 新機能・改善                               |
| `bug.md`            | バグ報告                                   |
| `spike.md`          | 技術調査・スパイク                         |

### ラベル運用（推奨）

| ラベル             | 意味                                       |
| ------------------ | ------------------------------------------ |
| `type: feature`    | 新機能                                     |
| `type: bug`        | バグ                                       |
| `type: docs`       | ドキュメント                               |
| `type: spike`      | 調査                                       |
| `scope: kuji`      | くじ関連                                   |
| `scope: photobook` | 写真集関連                                 |
| `scope: orders`    | 注文管理                                   |
| `priority: high`   | 優先度高                                   |
| `blocked`          | 別Issue待ち                                |
| `good first issue` | 新規参加者向け                             |

---

## 6. リリースフロー

```
1. develop 上で機能が揃ったら release ブランチを切る
   $ git checkout develop && git pull
   $ git checkout -b release/0.3.0

2. バージョン更新・changelog 更新など最終調整
3. release/0.3.0 上で最終検証（Vercel Preview で最終確認）

4. main に merge → タグ打ち
   $ git checkout main && git merge --no-ff release/0.3.0
   $ git tag -a v0.3.0 -m "Release 0.3.0"
   $ git push origin main --tags

5. develop にも取り込む（release中の hotfix があれば）
   $ git checkout develop && git merge --no-ff release/0.3.0
   $ git push origin develop

6. release ブランチを削除
```

### バージョニング

**セマンティックバージョニング (MAJOR.MINOR.PATCH)** に準拠。

- MAJOR: 破壊的変更（本番リリース後は慎重に）
- MINOR: 後方互換な新機能追加
- PATCH: バグ修正・小さな改善

デモ期間中は `0.x.y` で運用し、本番リリース時に `1.0.0` を切る。

---

## 7. Hotfix フロー

本番で緊急対応が必要な場合:

```
1. main から hotfix ブランチを切る
   $ git checkout main && git pull
   $ git checkout -b hotfix/72-stripe-webhook-500

2. 修正 → PR (main 宛)
3. main に merge、タグ打ち (v0.3.1 など)
4. develop にも取り込む
   $ git checkout develop && git merge --no-ff hotfix/72-stripe-webhook-500
```

---

## 8. Vercel との連携

| ブランチ  | Vercel環境     | URL                                        |
| --------- | -------------- | ------------------------------------------ |
| `main`    | Production     | 本番ドメイン                               |
| `develop` | Preview（固定）| develop 用の固定 Preview URL               |
| その他    | Preview        | PR ごとに自動生成される Preview URL        |

PR を出すと Vercel が自動で Preview URL をコメントする。動作確認はそこで行う。

環境変数は Vercel ダッシュボード側で **Production / Preview / Development** の3スコープに分けて管理する。Preview 用 DB は Neon の別ブランチを推奨。

---

## 9. リポジトリ運用

現状 origin（個人）と company（how-collect）の2箇所にプッシュしている。

- 開発中は `origin` メインで運用
- 節目（デモ前・リリース前）に `company` にも同期
- 両方に push する時は下記を使う:

```bash
git push origin <branch> && git push company <branch>
```

将来的には company を main、origin をミラー化することを検討。

---

## 10. Claude Code との協業ルール

- 作業依頼時に **Issue番号 or PR番号** を渡すと文脈が明確になる
- Claude が作るコミットは `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` を付ける
- `main` への直接プッシュは Claude では原則行わない（作業ブランチ + PR）
- 例外: `docs/*` の単発修正など、Issue不要と判断できるものはユーザー承認のもと直接運用可

---

## 参考

- [Git Flow (元記事)](https://nvie.com/posts/a-successful-git-branching-model/)
- [Conventional Commits](https://www.conventionalcommits.org/ja/v1.0.0/)
- [Semantic Versioning](https://semver.org/lang/ja/)
