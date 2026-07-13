# サイン入り動画: リアルタイム描画型 仕様書 (#38)

Issue #38 [Phase1-L] 動画サイン: 再生時オーバーレイ描画プレイヤー実装 の設計書。

`signed-video-spec.md` (④ 静止サイン+宛名フレーム方式) が現状の実装、本書は
それを **③ ブラウザ再生時重ね (リアルタイム描画型)** に拡張する仕様。

## 1. 現状 (既に本番で動いている方式)

- タレントは動画をコントロール付きで再生しつつ、その上に全画面キャンバスで
  **1枚の透過 PNG** を書く。時間軸には紐づかない
- 購入者側は動画 + PNG を canvas に重ねて「静止サインが常に表示される動画」を
  再生・DL する
- Signature テーブルには `imageData` (Bytes) だけが入る

**利点**: シンプル、動画長に関係なく動く、写真サインと同じロジックが使える
**制約**: サインが「動画の途中で書かれていく」演出はできない。ずっと同じ静止画

## 2. 拡張後の方式 (#38)

タレントが「**動画を再生しながら、その時点で書く**」体験を実現する。

### 2.1 タレント側 (書き手)

- 動画を再生 (自動再生 or 手動再生)
- 動画の上に canvas オーバーレイ
- ペンで描画するたびに `(x, y, t, pressure)` の点列を記録
  - `x, y`: 動画表示エリア内の正規化座標 (0.0〜1.0)。動画のリサイズに追従できるようにする
  - `t`: 動画の現在時刻 (`video.currentTime` 秒)
  - `pressure`: PointerEvent.pressure (0〜1、非対応デバイスは 0.5 固定)
- ペンを離した時点で 1 ストローク完結、`{ color, size, points: [...] }` として配列に push
- 「送信」ボタンで全ストロークを JSON にまとめて `/api/talent/signatures` に POST

### 2.2 購入者側 (視聴)

- 同じ動画を `<video>` で再生
- `<canvas>` オーバーレイで、**現在時刻 `t` までに引かれたストロークを再描画**
- 再生位置を巻き戻すと、その時刻以降のストロークは消える
- 早送り・シークにも追従
- 再生停止中も現在時刻に応じた描画を保持

### 2.3 動画本体は変えない

- 動画ファイル自体はタレントの書き込み情報を含まない (焼き込みしない)
- 見る度にブラウザ側で合成
- サーバー再エンコード不要 = ffmpeg / Vercel serverless の重い処理なし

## 3. データモデル

Signature テーブルを拡張する (新テーブルは作らない = 現行の PNG 型と共存)。

```prisma
model Signature {
  // ... 既存 ...
  imageData    Bytes?
  imageKey     String?

  // #38: 動画サイン用リアルタイム描画データ (JSON)
  // 動画サインの場合はここに入る。写真サインは従来通り imageData を使う。
  videoPaths   Json?   // { paths: [{ color, size, points: [{ x, y, t, p? }] }] }
  videoDuration Float? // 保存時点の動画長 (秒)。後でシーク不正チェックに使う
}
```

### 選択理由
- 新テーブル `VideoSignaturePath` にしなかった理由:
  - Signature と 1:1 なので分ける意味が薄い
  - サイン種別による分岐が increases
- Bytes カラムに JSON を突っ込む案 (imageData を流用) は破棄:
  - 型の意味が壊れる、検索性が落ちる

### JSON フォーマット

```jsonc
{
  "paths": [
    {
      "color": "#111111",
      "size": 3.0,
      "points": [
        { "x": 0.42, "y": 0.35, "t": 1.234, "p": 0.8 },
        { "x": 0.43, "y": 0.36, "t": 1.267, "p": 0.9 }
      ]
    }
  ]
}
```

- `x, y`: 動画表示エリアの正規化座標 (0.0〜1.0)。中央 = (0.5, 0.5)。
  正規化しておくことで、購入者側が別解像度で再生しても崩れない
- `t`: 動画のその瞬間の `currentTime` (秒)
- `p`: 筆圧 (省略時 0.5 扱い)
- 色や太さはストローク単位。ペン変更するたびに新ストローク

## 4. UI 仕様

### 4.1 タレント側 (拡張後)

現状の `SignSession` (fullscreen 版) をベースに:

- 動画は再生可能なまま。tone: `<video controls playsInline muted={false}>`
- キャンバスは動画のオーバーレイ (現状と同じ)
- **描画中は動画の再生時刻を止めない** = 動画は流し続けて、書いた時刻を記録する
  - ただし「今の位置で書き足したい」のために「一時停止して描く」も可能にする
  - 「巻き戻して書き直す」は、`t > 現在時刻` のストロークを削除して再描画 (undo 的挙動)
- ペン色 / 太さ / 書き直す (全消去) は現状 UI を流用
- **「送信」ボタンで JSON を POST**

### 4.2 購入者側

現状の写真サイン合成 (`SignedImagePreview`) を動画向けに新規実装:

- `<video>` で動画再生 + `<canvas>` 全画面オーバーレイ
- `requestAnimationFrame` で毎フレーム、`video.currentTime` 以下の points を全て再描画
- シーク時は `timeupdate` イベントでも同じ再描画
- ダウンロード:
  - Phase 1: **なし** (視聴のみ)
  - Phase 2: MediaRecorder + captureStream で焼き込み mp4 を作って DL

## 5. API 変更

### 5.1 送信 `POST /api/talent/signatures`

現状のペイロード:
```jsonc
{ "deliveryId": "...", "dataUrl": "data:image/png;base64,..." }
```

拡張:
```jsonc
// 動画サインのとき
{
  "deliveryId": "...",
  "videoPaths": { "paths": [...] },
  "videoDuration": 12.5
}
```

サーバー側:
- `productKind === "DIGITAL_VIDEO_SIGN"` なら `videoPaths` を必須にして
  `imageData` は保存しない
- 写真サインは従来通り `dataUrl` を必須

### 5.2 取得 (購入者向け配信)

現状の `/api/deliveries/[id]/info` は `signaturePngBase64` を返している。動画時:

```jsonc
{
  "data": {
    "deliveryId": "...",
    "title": "...",
    "baseVideoUrl": "/api/deliveries/[id]/base-image",  // 動画本体
    "videoPaths": { "paths": [...] },
    "videoDuration": 12.5,
    "signatureStatus": "COMPLETED",
    "deliveryStatus": "READY"
  }
}
```

`baseImageUrl` の代わりに `baseVideoUrl` (実質同じ URL) を返す。既存の
`base-image` エンドポイントは動画ファイルも Content-Type で返しているので
そのまま流用可能。

## 6. 実装ステップ (段階リリース案)

大きいので 3 段階に分けるのが安全:

### Step 1: スキーマ + 送信 API
- Prisma: Signature に `videoPaths` `videoDuration` 追加、SQL 手動適用
- `POST /api/talent/signatures` を videoPaths 受け入れ対応
- 既存の写真サインは無影響

### Step 2: タレント側 UI 変更
- `SignSession` に「動画サインモード」を追加
- 動画再生と同期して座標+時刻+筆圧を記録
- 送信ペイロードを videoPaths に切り替え
- 巻き戻し時のストローク削除、一時停止書き

### Step 3: 購入者側 UI 変更
- `SignedVideoPlayer` (新規) を実装
- 動画再生と同期して canvas に再描画
- マイページ `/mypage/digital-contents/signed/[deliveryId]` を写真/動画で分岐

## 7. 既存の代替として残すか (フォールバック)

- 「PNG サイン (静止)」も動画サイン商品で使えるように残す
- 管理画面から「この商品はリアルタイム描画型 / 静止型」を選択できると理想
  だが、Phase 1 では「動画サイン = リアルタイム描画型」に統一する方向で良さそう

## 8. 未解決事項 (実装前に決める必要あり)

- [ ] 動画長の上限 (現状 5 分推奨。JSON サイズが大きくなりすぎないか)
- [ ] 「一時停止して書く」を許可するか (時刻軸の連続性が壊れる可能性)
- [ ] iPad Safari の PointerEvent 筆圧サポート範囲
- [ ] 描画をリアルタイムに小分けで送るか (再接続時のデータ損失対策)、
      完了後に一括送信するか
- [ ] 巻き戻し UI: 「動画のここから書き直す」の押しやすい配置
- [ ] Phase 2 の焼き込み DL の実装優先度

## 9. 参考

- 既存: `docs/signed-video-spec.md` (④ 静止方式の設計書)
- 既存: `docs/production-release-plan.md` Section 1.3
- 実装参考: `src/app/admin/sign-session/[deliveryId]/SignSession.tsx`
