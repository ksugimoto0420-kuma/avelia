"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { FileUploader } from "@/components/ui/FileUploader";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

export function DigitalContentForm({
  products,
}: {
  products: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { show } = useToast();
  const [form, setForm] = useState({
    productId: "",
    title: "",
    description: "",
    type: "IMAGE" as "IMAGE" | "VIDEO" | "AUDIO" | "FILE",
    deliveryType: "SHARED" as "SHARED" | "PERSONALIZED",
    fileKey: "",
    baseImageKey: "",
    baseImageUrl: "",
    viewLimitDays: "",
    downloadLimit: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const personalized = form.deliveryType === "PERSONALIZED";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (
      personalized
        ? !form.baseImageKey && !form.baseImageUrl
        : !form.fileKey
    ) {
      setError(
        personalized
          ? "原本画像をアップロードするか、外部URLを指定してください"
          : "配信ファイルをアップロードしてください",
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/digital-contents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: form.productId || null,
          title: form.title,
          description: form.description || null,
          type: form.type,
          deliveryType: form.deliveryType,
          fileKey: form.fileKey || null,
          baseImageKey: form.baseImageKey || null,
          baseImageUrl: form.baseImageUrl || null,
          viewLimitDays: form.viewLimitDays ? Number(form.viewLimitDays) : null,
          downloadLimit: form.downloadLimit ? Number(form.downloadLimit) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "保存に失敗しました");
      show("登録しました");
      router.push("/admin/digital-contents");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラー");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {error && <Alert tone="error">{error}</Alert>}
      <Card>
        <CardHeader title="デジタルコンテンツ登録" />
        <CardBody className="space-y-4">
          <Input
            label="タイトル"
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <Select
            label="紐づける商品（購入者に自動付与）"
            value={form.productId}
            onChange={(e) =>
              setForm((f) => ({ ...f, productId: e.target.value }))
            }
          >
            <option value="">（紐づけなし）</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="種別"
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({ ...f, type: e.target.value as typeof f.type }))
              }
            >
              <option value="IMAGE">画像</option>
              <option value="VIDEO">動画</option>
              <option value="AUDIO">音声</option>
              <option value="FILE">ファイル</option>
            </Select>
            <Select
              label="配信方式"
              value={form.deliveryType}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  deliveryType: e.target.value as typeof f.deliveryType,
                }))
              }
            >
              <option value="SHARED">共通即DL（全員同一ファイル）</option>
              <option value="PERSONALIZED">個別サイン納品（購入後に制作）</option>
            </Select>
          </div>
          <Textarea
            label="説明"
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
          />
          {personalized ? (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                サイン用ベース画像（原本）
              </label>
              <p className="text-xs text-gray-500">
                出演者がこの原本の上に直接サインを書きます。<b>下のどちらか</b>
                を指定してください（外部URL指定が一番楽です）。
              </p>
              <div>
                <p className="mb-1 text-xs font-medium text-gray-600">
                  ① 外部画像URL（MVP / モック向け）
                </p>
                <Input
                  value={form.baseImageUrl}
                  placeholder="https://… 例: 写真集の表紙画像URL"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, baseImageUrl: e.target.value }))
                  }
                  hint="picsum.photos などのテスト用URLでも、本物のCDN URLでもOK"
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-gray-600">
                  ② ファイルアップロード（ローカル保存・本番想定）
                </p>
                <FileUploader
                  onUploaded={(r) =>
                    setForm((f) => ({ ...f, baseImageKey: r.key }))
                  }
                />
                {form.baseImageKey && (
                  <p className="mt-1 text-xs text-green-600">
                    原本アップロード済: {form.baseImageKey}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                配信ファイル（全購入者へ同一配信）
              </label>
              <FileUploader
                onUploaded={(r) => setForm((f) => ({ ...f, fileKey: r.key }))}
              />
              {form.fileKey && (
                <p className="mt-1 text-xs text-green-600">
                  アップロード済: {form.fileKey}
                </p>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="閲覧可能日数（空欄=無期限）"
              type="number"
              value={form.viewLimitDays}
              onChange={(e) =>
                setForm((f) => ({ ...f, viewLimitDays: e.target.value }))
              }
            />
            <Input
              label="DL回数上限（空欄=無制限）"
              type="number"
              value={form.downloadLimit}
              onChange={(e) =>
                setForm((f) => ({ ...f, downloadLimit: e.target.value }))
              }
            />
          </div>
        </CardBody>
      </Card>
      <div className="flex justify-end gap-3">
        <Button href="/admin/digital-contents" variant="outline">
          キャンセル
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "保存中…" : "登録する"}
        </Button>
      </div>
    </form>
  );
}
