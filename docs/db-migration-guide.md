# DB マイグレーション適用手順 (本番)

Avelia FunClub は Neon (Postgres) をバックエンドに使い、Prisma で
スキーマ管理をしている。過去に Vercel のビルド中で `prisma migrate deploy`
が pgbouncer の advisory lock を掴んだままハングし、以降のビルドが
P1002 で全部落ちる事故があった。再発防止のため、本番マイグレーションは
**Neon の SQL Editor から手動で流す** 運用に統一する。

## 現状の運用ポリシー

- `prisma migrate deploy` は **Vercel の build コマンドから外している**
  (`package.json` の `build` は `prisma generate && next build` のみ)
- `prisma migrate dev` はローカル開発のみ、本番/Preview では叩かない
- 本番の Neon への DDL は SQL Editor から人手で流す (下記手順)

## 手順

### 1. ローカルでスキーマを編集し、開発DBで検証

```bash
# schema.prisma を編集
npx prisma migrate dev --name <migration_name>
# → prisma/migrations/<timestamp>_<name>/migration.sql が生成される
```

`migration.sql` の内容をレビュー。破壊的変更 (NOT NULL 追加、カラム削除、
リネーム等) は特に慎重に。

### 2. コードを合わせて実装

- 新カラムの読み書きが必要な箇所のコードを追加
- **後方互換に注意**: 本番 DB が古いスキーマのまま新コードが動く瞬間が
  発生する。新カラムは nullable / default 付きで追加する

### 3. Preview 環境で検証 (推奨)

Preview 用 Neon ブランチが分離されている場合はそちらで検証する
(#10 で導入予定)。分離されていない場合は開発DBで最終確認。

### 4. 本番 Neon に SQL Editor から流す

1. Neon Console → 対象ブランチ (main / production) を選択
2. **SQL Editor** タブを開く
3. `migration.sql` の内容を貼り付けて実行
4. 失敗した場合は上部の "Query" ペインでエラーを確認し、途中まで適用
   されていないかを Table Editor で確認する

### 5. Vercel にデプロイ

- develop → main の PR をマージ
- Vercel が自動的にビルド/デプロイ
- ビルド前に DB スキーマが本番と一致していることを確認 (順序を間違えると
  new build が古い DB を叩いて落ちる)

## Zombie connection への対処

pgbouncer の advisory lock を掴んだままの接続 (zombie) が残ると、
以降の `prisma migrate deploy` が P1002 で失敗する。

### 症状

Vercel Build ログに以下:

```
Error: P1002
The database server was reached but timed out.
```

Neon Console の Monitoring で「Long-running queries」に居座り続ける
接続が見える。

### 対処

Neon SQL Editor で該当接続を強制切断する:

```sql
-- 60秒以上アイドルな接続をすべて確認
SELECT pid, state, query_start, state_change, query
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND state_change < now() - interval '60 seconds';

-- 個別に切断
SELECT pg_terminate_backend(<pid>);

-- 上記条件のものを一括切断 (慎重に)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND state_change < now() - interval '60 seconds';
```

## `prisma migrate deploy` を build から外している理由

Vercel は build 中に短命な serverless 関数を起動し、その中で
`prisma migrate deploy` を走らせる形になる。以下の問題があった:

1. Neon pgbouncer 経由で advisory lock を取得したまま、build 関数が
   タイムアウトで殺される
2. lock が解放されないので次のデプロイの migrate が P1002 で落ちる
3. 手動で `pg_terminate_backend` するまで復旧しない

このため、build からは切り離し、**SQL Editor から人手で流す** 運用に
統一している。migrate の履歴は Prisma の `_prisma_migrations` テーブルに
残らないので、ローカルの `prisma/migrations/` を "設計履歴のドキュメント"
として保持する扱い。

## 参考

- Prisma advisory lock issue: <https://github.com/prisma/prisma/issues/13549>
- Neon の `pg_stat_activity` ガイド: <https://neon.tech/docs/manage/manage-connections>
