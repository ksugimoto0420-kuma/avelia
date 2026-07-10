"use client";

import { useState } from "react";
import { ImageUploadButton } from "./ImageUploadButton";

type Props = {
  /** input の name (form 送信用) */
  name: string;
  /** 初期値 */
  defaultValue?: string;
  /** input の placeholder */
  placeholder?: string;
  /** アップロード先バケット */
  bucket: "public-assets" | "private-digital" | "private-admin";
  /** アップロード API に渡す purpose */
  purpose: "product" | "event" | "content" | "delivery-base-image" | "generic";
  /** 対象エンティティのID (編集時のみ) */
  targetId?: string | null;
  /** 追加の入力欄クラス */
  inputClassName?: string;
  /** ラベルクラス */
  labelClassName?: string;
  /** ラベル文字列 (省略可) */
  label?: string;
  /** 説明文 (input の下に出す) */
  hint?: string;
  /**
   * プレビューの表示方法。
   *   - "cover-16-9" : 16:9 カバー画像 (イベントバナー等)
   *   - "square"     : 正方形 (商品サムネイル等)
   *   - "auto"       : オリジナル比率
   *   - "none"       : プレビューなし
   */
  previewAspect?: "cover-16-9" | "square" | "auto" | "none";
};

/**
 * 「URL 手入力 + 画像アップロード + プレビュー」をまとめた入力コンポーネント。
 *
 * サーバーコンポーネントのフォーム内に埋め込んで使う。
 * URL 値をローカル state で持ち、アップロード成功時に自動セット。
 * form submit 時は input[name={name}] の value がそのまま POST される。
 */
export function ImageUrlFieldWithUpload({
  name,
  defaultValue = "",
  placeholder = "https://…",
  bucket,
  purpose,
  targetId = null,
  inputClassName,
  labelClassName,
  label,
  hint,
  previewAspect = "cover-16-9",
}: Props) {
  const [url, setUrl] = useState(defaultValue);

  return (
    <div>
      {label && <label className={labelClassName}>{label}</label>}
      <div className="flex items-start gap-2">
        <input
          name={name}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className={inputClassName}
          placeholder={placeholder}
        />
        <ImageUploadButton
          bucket={bucket}
          purpose={purpose}
          targetId={targetId}
          onUploaded={(u) => setUrl(u)}
          className="pt-0.5"
        />
      </div>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt="プレビュー"
              className={
                previewAspect === "auto"
                  ? "block max-h-64 w-auto"
                  : "h-full w-full object-cover"
              }
            />
          </div>
          <p className="bg-gray-50 px-2 py-1 text-xs text-gray-500">
            プレビュー
            {previewAspect === "cover-16-9" && "（16:9 でトリミングされます）"}
          </p>
        </div>
      )}
    </div>
  );
}
