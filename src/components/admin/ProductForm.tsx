"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DateTimeField } from "@/components/ui/DateTimeField";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { useToast } from "@/components/ui/Toast";
import { ImageUploadField } from "./ImageUploadField";

type VariantRow = {
  id?: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  isDefault: boolean;
  requiresNickname: boolean;
};

export type ProductFormData = {
  id?: string;
  eventId: string;
  slug: string;
  name: string;
  description: string;
  type: "PHYSICAL" | "DIGITAL";
  fulfillmentSource: "IN_HOUSE" | "WAREHOUSE";
  basePrice: number;
  imageUrl: string;
  benefit: string;
  deliveryDate: string;
  notes: string;
  nicknameNote: string;
  isPublished: boolean;
  saleStartAt: string;
  saleEndAt: string;
  maxPerOrder: string;
  maxPerUser: string;
  lotteryOnly: boolean;
  variants: VariantRow[];
};

export function ProductForm({
  initial,
  events,
}: {
  initial: ProductFormData;
  events: { id: string; title: string }[];
}) {
  const router = useRouter();
  const { show } = useToast();
  const [form, setForm] = useState<ProductFormData>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateVariant(idx: number, patch: Partial<VariantRow>) {
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v, i) => (i === idx ? { ...v, ...patch } : v)),
    }));
  }

  function addVariant() {
    setForm((f) => ({
      ...f,
      variants: [
        ...f.variants,
        {
          name: "標準",
          sku: "",
          price: f.basePrice,
          quantity: 0,
          isDefault: false,
          requiresNickname: false,
        },
      ],
    }));
  }

  function removeVariant(idx: number) {
    setForm((f) => ({ ...f, variants: f.variants.filter((_, i) => i !== idx) }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        eventId: form.eventId,
        slug: form.slug || form.name,
        name: form.name,
        description: form.description || null,
        type: form.type,
        basePrice: Number(form.basePrice),
        imageUrl: form.imageUrl || null,
        benefit: form.benefit || null,
        deliveryDate: form.deliveryDate
          ? new Date(form.deliveryDate).toISOString()
          : null,
        notes: form.notes || null,
        nicknameNote: form.nicknameNote || null,
        fulfillmentSource: form.fulfillmentSource,
        isPublished: form.isPublished,
        saleStartAt: form.saleStartAt
          ? new Date(form.saleStartAt).toISOString()
          : null,
        saleEndAt: form.saleEndAt
          ? new Date(form.saleEndAt).toISOString()
          : null,
        maxPerOrder: form.maxPerOrder ? Number(form.maxPerOrder) : null,
        maxPerUser: form.maxPerUser ? Number(form.maxPerUser) : null,
        lotteryOnly: form.lotteryOnly,
        variants: form.variants.map((v) => ({
          id: v.id,
          name: v.name,
          sku: v.sku,
          price: Number(v.price),
          quantity: Number(v.quantity),
          isDefault: v.isDefault,
          requiresNickname: v.requiresNickname,
        })),
      };

      const url = form.id
        ? `/api/admin/products/${form.id}`
        : "/api/admin/products";
      const res = await fetch(url, {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "保存に失敗しました");

      show("保存しました");
      router.push("/admin/products");
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
        <CardHeader title="基本情報" />
        <CardBody className="space-y-4">
          <div>
            <label
              htmlFor="product-event"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              対象イベント
              <span className="ml-0.5 text-red-500">*</span>
            </label>
            <SearchableSelect
              id="product-event"
              value={form.eventId}
              onChange={(v) => set("eventId", v)}
              placeholder="イベントを選択"
              searchPlaceholder="イベント名で検索…"
              options={events.map((ev) => ({
                value: ev.id,
                label: ev.title,
              }))}
            />
          </div>
          <Input
            label="商品名"
            required
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="区分"
              value={form.type}
              onChange={(e) =>
                set("type", e.target.value as "PHYSICAL" | "DIGITAL")
              }
            >
              <option value="PHYSICAL">物販</option>
              <option value="DIGITAL">デジタル</option>
            </Select>
            <Input
              label="表示価格（円）"
              type="number"
              value={form.basePrice}
              onChange={(e) => set("basePrice", Number(e.target.value))}
            />
          </div>
          {form.type === "PHYSICAL" && (
            <Select
              label="発送元（CSV出力時に振り分けられます）"
              value={form.fulfillmentSource}
              onChange={(e) =>
                set(
                  "fulfillmentSource",
                  e.target.value as "IN_HOUSE" | "WAREHOUSE",
                )
              }
              hint="手元出荷=ポストカード等、社内で印字して発送。倉庫出荷=新潟倉庫から佐川急便で発送（写真集等）"
            >
              <option value="IN_HOUSE">手元出荷</option>
              <option value="WAREHOUSE">倉庫出荷（新潟・佐川）</option>
            </Select>
          )}
          <ImageUploadField
            name="imageUrl"
            value={form.imageUrl}
            onChange={(url) => set("imageUrl", url)}
            bucket="public-assets"
            purpose="product"
            targetId={form.id ?? null}
            label="商品画像"
            hint="推奨: 600×600px 以上の正方形 (1:1)。商品カードと詳細ページで使用。"
            previewAspect="square"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="特典内容"
              value={form.benefit}
              onChange={(e) => set("benefit", e.target.value)}
              placeholder="例: 直筆サイン入り / 2ショットチェキ"
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                配信予定日 / お届け予定日
              </label>
              <DateTimeField
                value={form.deliveryDate}
                onChange={(v) => set("deliveryDate", v)}
              />
            </div>
          </div>
          <Textarea
            label="説明（イベント内容・特典内容・配信内容など）"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            className="min-h-40"
            placeholder={"例:\n■イベント内容\n…\n■特典内容\n宛名・サイン・一言コメント付き生写真\n■配信方法\n公式YouTubeチャンネル"}
          />
          <Textarea
            label="注意事項"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            className="min-h-40"
            placeholder={"例:\n■商品の購入について\n…\n■ニックネームに関する注意事項\n…\n■キャンセルについて\n原則としてお受けできません。"}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="バリエーション・在庫"
          subtitle="サイズ・メンバー等。各バリエーションに在庫を設定します。"
          action={
            <Button type="button" size="sm" variant="outline" onClick={addVariant}>
              ＋ 追加
            </Button>
          }
        />
        <CardBody className="space-y-3">
          {form.variants.map((v, i) => (
            <div
              key={i}
              className="space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3"
            >
              <div className="grid grid-cols-12 items-end gap-2">
                <div className="col-span-3">
                  <Input
                    label="名称"
                    value={v.name}
                    onChange={(e) => updateVariant(i, { name: e.target.value })}
                  />
                </div>
                <div className="col-span-4">
                  <Input
                    label="SKU"
                    value={v.sku}
                    onChange={(e) => updateVariant(i, { sku: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    label="価格"
                    type="number"
                    value={v.price}
                    onChange={(e) =>
                      updateVariant(i, { price: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    label="在庫数"
                    type="number"
                    value={v.quantity}
                    onChange={(e) =>
                      updateVariant(i, { quantity: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={v.requiresNickname}
                    onChange={(e) =>
                      updateVariant(i, { requiresNickname: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-gray-300 text-brand-600"
                  />
                  このSKUはニックネーム（サイン宛名）入力が必要
                </label>
                {form.variants.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeVariant(i)}
                    className="text-xs text-gray-400 hover:text-red-600"
                  >
                    削除
                  </button>
                )}
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="販売・購入制限" />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                販売開始日時（空欄=イベントに従う）
              </label>
              <DateTimeField
                value={form.saleStartAt}
                onChange={(v) => set("saleStartAt", v)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                販売終了日時
              </label>
              <DateTimeField
                value={form.saleEndAt}
                onChange={(v) => set("saleEndAt", v)}
              />
            </div>
            <Input
              label="1注文あたり上限（空欄=無制限）"
              type="number"
              value={form.maxPerOrder}
              onChange={(e) => set("maxPerOrder", e.target.value)}
            />
            <Input
              label="1ユーザー累計上限（空欄=無制限）"
              type="number"
              value={form.maxPerUser}
              onChange={(e) => set("maxPerUser", e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) => set("isPublished", e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-brand-600"
              />
              公開する
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={form.lotteryOnly}
                onChange={(e) => set("lotteryOnly", e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-brand-600"
              />
              当選者限定購入
            </label>
          </div>
          <Input
            label="ニックネーム入力欄の案内文（必須SKUで表示）"
            value={form.nicknameNote}
            onChange={(e) => set("nicknameNote", e.target.value)}
            hint="ニックネーム必須はSKU（バリエーション）ごとに上で設定します。"
            placeholder="例: サインの宛名になります。10文字以内・よみがな必須。"
          />
        </CardBody>
      </Card>

      <div className="flex justify-end gap-3">
        <Button href="/admin/products" variant="outline">
          キャンセル
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "保存中…" : form.id ? "更新する" : "作成する"}
        </Button>
      </div>
    </form>
  );
}
