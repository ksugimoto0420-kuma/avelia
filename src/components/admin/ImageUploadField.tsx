"use client";

import { useRef, useState } from "react";

type Bucket = "public-assets" | "private-digital" | "private-admin";
type Purpose =
  | "product"
  | "event"
  | "artist"
  | "kuji-banner"
  | "kuji-prize"
  | "content"
  | "delivery-base-image"
  | "generic";

export type ImageUploadFieldProps = {
  /** form 送信用の input name。Server Component 側から hidden input で送るために必須。 */
  name: string;
  /** 初期値 (アップロード済みURL or 手入力URL)。 */
  defaultValue?: string;
  /** 制御コンポーネント化する場合に使う。指定するとローカル state を使わない。 */
  value?: string;
  /** value を指定した場合の変更ハンドラ。 */
  onChange?: (url: string) => void;
  /** アップロード先バケット。 */
  bucket: Bucket;
  /** アップロード API に渡す purpose。 */
  purpose: Purpose;
  /** 対象エンティティのID (編集時のみ)。 */
  targetId?: string | null;
  /** アップロードエリア上部のラベル。 */
  label?: string;
  /** 「対応形式」等の説明。 */
  hint?: string;
  /**
   * プレビューの表示方法。
   *   - "cover-16-9" : 16:9 カバー (イベントバナー等)
   *   - "square"     : 正方形 (商品サムネイル、アーティスト画像等)
   *   - "auto"       : オリジナル比率
   *   - "none"       : プレビューなし
   */
  previewAspect?: "cover-16-9" | "square" | "auto" | "none";
  /** input が受け付ける MIME (デフォルト image/*)。 */
  accept?: string;
  /**
   * メディア種別。UI の文言 (「画像」/「動画」)、プレビュー表示方式、
   * スマホでのカメラ起動属性 (capture) を切り替える。既定 "image"。
   */
  mediaKind?: "image" | "video";
  /**
   * URL 手入力欄を表示するかどうか。デフォルト true。
   * サイン用ベース画像/動画のようにアップロード専用で運用する項目では false にする。
   */
  showUrlInput?: boolean;
  /** ラッパの追加クラス。 */
  className?: string;
};

/**
 * 管理画面用の統一画像入力フィールド。
 *
 * 上段: ドラッグ&ドロップ or クリックでアップロード
 * 下段: URL 手入力 (補助、showUrlInput=false で無効化)
 * 排他制御: どちらか一方を使うと、もう一方は disabled になる。
 * クリアボタンで両方リセット可能。
 *
 * form 送信用に hidden input[name={name}] を出力する。
 * Server Action ベースのフォームでも FormData でこの URL が受け取れる。
 *
 * アップロード済みの場合、URL 手入力欄には内部URL (/api/admin/blob/...) を
 * そのまま出さず、「アップロード済み」バッジで済ませる (UX / URLバリデーション対策)。
 */
export function ImageUploadField({
  name,
  defaultValue = "",
  value: controlledValue,
  onChange,
  bucket,
  purpose,
  targetId = null,
  label = "画像",
  hint = "JPG / PNG / WebP に対応。",
  previewAspect = "cover-16-9",
  accept = "image/*",
  mediaKind = "image",
  showUrlInput = true,
  className,
}: ImageUploadFieldProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const url = controlledValue ?? uncontrolled;
  const setUrl = (v: string) => {
    if (onChange) onChange(v);
    else setUncontrolled(v);
  };

  // モード判定は「初期値がアップロード成果物 (内部URL) っぽいか外部URLか」で決める。
  // 内部URLの見た目: /api/admin/blob/... または /api/user/... または Vercel Blob CDN URL
  const detectMode = (v: string): "uploaded" | "url-input" | null => {
    if (!v) return null;
    if (v.startsWith("/api/")) return "uploaded";
    if (v.includes(".blob.vercel-storage.com")) return "uploaded";
    return "url-input";
  };
  const [mode, setMode] = useState<"uploaded" | "url-input" | null>(() =>
    detectMode(defaultValue),
  );
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  /** アップロード進捗 (0-100)。fetch は progress 非対応なので XHR を使う。 */
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const noun = mediaKind === "video" ? "動画" : "画像";

  const inputRef = useRef<HTMLInputElement | null>(null);
  const openPicker = () => {
    if (mode === "url-input") return;
    setError(null);
    inputRef.current?.click();
  };

  const upload = (file: File) => {
    setUploading(true);
    setProgress(0);
    setError(null);

    const form = new FormData();
    form.append("file", file);
    form.append("bucket", bucket);
    form.append("purpose", purpose);
    if (
      purpose === "product" ||
      purpose === "event" ||
      purpose === "artist" ||
      purpose === "kuji-banner" ||
      purpose === "kuji-prize"
    ) {
      form.append("entityId", targetId ?? "");
    } else {
      form.append("contentId", targetId ?? "");
    }

    // XHR で進捗を取る (fetch は progress 非対応)
    return new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/admin/uploads");
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
      xhr.addEventListener("load", () => {
        try {
          if (xhr.status < 200 || xhr.status >= 300) {
            const body = xhr.responseText || "";
            // 代表的なエラーを人間向け文言に変換
            if (xhr.status === 413) {
              throw new Error(
                `${noun}のサイズが大きすぎます (アップロード可能な上限を超えました)`,
              );
            }
            throw new Error(
              `${noun}のアップロードに失敗しました (${xhr.status}${body ? `: ${body}` : ""})`,
            );
          }
          const json = JSON.parse(xhr.responseText || "{}") as {
            data?: { url?: string };
          };
          const uploadedUrl = json.data?.url;
          if (!uploadedUrl) throw new Error("URLが取得できませんでした");
          setUrl(uploadedUrl);
          setMode("uploaded");
          setUploadedFilename(file.name);
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        } finally {
          setUploading(false);
          setProgress(null);
          resolve();
        }
      });
      xhr.addEventListener("error", () => {
        setError(
          `${noun}のアップロード中にネットワークエラーが発生しました。電波の良い場所で再度お試しください。`,
        );
        setUploading(false);
        setProgress(null);
        resolve();
      });
      xhr.send(form);
    });
  };

  const onFilesSelected = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    await upload(file);
  };

  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (mode === "url-input") return;
    await onFilesSelected(e.dataTransfer.files);
  };

  const clearAll = () => {
    setUrl("");
    setMode(null);
    setUploadedFilename(null);
    setError(null);
  };

  const isUrlInputDisabled = mode === "uploaded";
  const isUploadDisabled = mode === "url-input";

  return (
    <div className={className}>
      {/* 隠し input: form submit 時に値が送信される。JS state を hidden input 経由で反映 */}
      <input type="hidden" name={name} value={url} />

      {/* ラベル */}
      <div className="mb-1 flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        {url && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-gray-500 hover:text-red-600"
          >
            クリア
          </button>
        )}
      </div>

      {/* アップロードエリア */}
      <div
        role="button"
        tabIndex={isUploadDisabled ? -1 : 0}
        aria-disabled={isUploadDisabled}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragEnter={(e) => {
          if (isUploadDisabled) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          if (isUploadDisabled) return;
          e.preventDefault();
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition " +
          (isUploadDisabled
            ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400"
            : mode === "uploaded"
              ? "cursor-pointer border-green-300 bg-green-50/40 text-green-700 hover:border-green-400"
              : dragging
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "cursor-pointer border-gray-300 bg-white text-gray-600 hover:border-brand-400 hover:bg-brand-50/40")
        }
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          // capture 属性は付けない。付けると iOS でカメラアプリが直接起動し、
          // アルバムから選ぶことができなくなる。属性なしなら OS 標準の
          // 「写真ライブラリ / カメラで撮影 / ファイルを選択」のシートが出る。
          onChange={(e) => {
            void onFilesSelected(e.target.files);
            e.target.value = "";
          }}
        />
        {uploading ? (
          <>
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <span className="text-sm">
              {noun}をアップロード中
              {progress != null ? ` … ${progress}%` : "…"}
            </span>
            {progress != null && (
              <div className="mt-1 h-2 w-full max-w-xs overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-brand-500 transition-[width] duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
            <span className="text-xs text-gray-500">
              画面を閉じずにお待ちください
            </span>
          </>
        ) : mode === "uploaded" ? (
          <>
            <span className="text-2xl leading-none">✅</span>
            <span className="text-sm font-medium">
              アップロード済み
              {uploadedFilename ? `: ${uploadedFilename}` : ""}
            </span>
            <span className="text-xs">
              差し替えるには、ここをタップして{noun}を選び直してください
            </span>
          </>
        ) : (
          <>
            <span className="text-2xl leading-none">
              {isUploadDisabled ? "🔒" : mediaKind === "video" ? "🎬" : "📷"}
            </span>
            <span className="text-sm font-medium">
              {isUploadDisabled
                ? "URL入力が有効なため無効化されています"
                : mediaKind === "video"
                  ? "タップしてアルバムから動画を選択"
                  : "画像をタップして選択（PCではドラッグ&ドロップも可）"}
            </span>
            <span className="text-xs">{hint}</span>
          </>
        )}
      </div>

      {/* 排他ヒント + URL 手入力 (showUrlInput=false のとき非表示) */}
      {showUrlInput && (
        <>
          <div className="mt-3 text-center text-xs text-gray-500">
            — または、URL を貼り付ける —
          </div>
          <input
            type="url"
            value={mode === "uploaded" ? "" : url}
            onChange={(e) => {
              const v = e.target.value;
              setUrl(v);
              setMode(v ? "url-input" : null);
              setError(null);
            }}
            disabled={isUrlInputDisabled}
            placeholder={
              isUrlInputDisabled
                ? "アップロード済みのため無効化されています"
                : "https://…"
            }
            className={
              "mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 " +
              (isUrlInputDisabled
                ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400"
                : "border-gray-300 focus:border-brand-500 focus:ring-brand-200")
            }
          />
        </>
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {/* プレビュー */}
      {url && previewAspect !== "none" && (
        <div className="mt-2 overflow-hidden rounded-lg border border-gray-200">
          <div
            className={
              previewAspect === "cover-16-9"
                ? "aspect-[16/9] w-full bg-gray-50"
                : previewAspect === "square"
                  ? "aspect-square w-40 bg-gray-50"
                  : "w-full bg-gray-50"
            }
          >
            {mediaKind === "video" ? (
              <video
                src={url}
                controls
                playsInline
                className={
                  previewAspect === "auto"
                    ? "block max-h-64 w-auto"
                    : "h-full w-full object-contain"
                }
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt="プレビュー"
                className={
                  previewAspect === "auto"
                    ? "block max-h-64 w-auto"
                    : "h-full w-full object-cover"
                }
              />
            )}
          </div>
          <p className="bg-gray-50 px-2 py-1 text-xs text-gray-500">
            プレビュー
            {mediaKind !== "video" && previewAspect === "cover-16-9" &&
              "（16:9 でトリミング）"}
            {mediaKind !== "video" && previewAspect === "square" &&
              "（1:1 でトリミング）"}
          </p>
        </div>
      )}
    </div>
  );
}
