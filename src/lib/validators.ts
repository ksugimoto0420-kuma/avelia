import { z } from "zod";

// ---- 認証 ----
export const registerSchema = z.object({
  email: z.string().email("メールアドレスの形式が正しくありません"),
  password: z.string().min(8, "パスワードは8文字以上にしてください"),
  name: z.string().min(1, "お名前を入力してください").optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const requestResetSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "パスワードは8文字以上にしてください"),
});

// ---- カート ----
// 数量分のニックネーム1件分
export const unitNicknameSchema = z.object({
  nickname: z.string().max(10).optional().nullable(),
  nicknameKana: z.string().max(20).optional().nullable(),
  note: z.string().max(200).optional().nullable(),
});

export const addCartItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
  nickname: z.string().max(10, "ニックネームは10文字以内です").optional().nullable(),
  nicknameKana: z.string().max(20).optional().nullable(),
  note: z.string().max(200).optional().nullable(),
  unitNicknames: z.array(unitNicknameSchema).max(99).optional(),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(1).max(99).optional(),
  nickname: z.string().max(10).optional().nullable(),
  nicknameKana: z.string().max(20).optional().nullable(),
  note: z.string().max(200).optional().nullable(),
  unitNicknames: z.array(unitNicknameSchema).max(99).optional(),
});

// ---- 注文 ----
export const checkoutSchema = z.object({
  recipientName: z.string().min(1, "お名前を入力してください"),
  recipientKana: z.string().optional(),
  recipientPhone: z.string().optional(),
  recipientPostal: z.string().optional(),
  recipientAddress: z.string().optional(),
  shippingMethod: z.string().optional(),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().int().min(1),
        nickname: z.string().optional(),
        nicknameKana: z.string().optional(),
        note: z.string().optional(),
      }),
    )
    .optional(),
});

// ---- 管理: イベント ----
export const eventInputSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  coverImageUrl: z.string().optional().nullable(),
  isPublished: z.boolean().optional(),
  saleStartAt: z.string().datetime().optional().nullable(),
  saleEndAt: z.string().datetime().optional().nullable(),
  maxPerUser: z.number().int().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
});

// ---- 管理: 商品 ----
export const productInputSchema = z.object({
  eventId: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  type: z.enum(["PHYSICAL", "DIGITAL"]),
  basePrice: z.number().int().min(0),
  imageUrl: z.string().optional().nullable(),
  benefit: z.string().optional().nullable(),
  deliveryDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
  nicknameNote: z.string().optional().nullable(),
  isPublished: z.boolean().optional(),
  saleStartAt: z.string().datetime().optional().nullable(),
  saleEndAt: z.string().datetime().optional().nullable(),
  maxPerOrder: z.number().int().min(1).optional().nullable(),
  maxPerUser: z.number().int().min(1).optional().nullable(),
  lotteryOnly: z.boolean().optional(),
  requiresNickname: z.boolean().optional(),
  variants: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1),
        sku: z.string().min(1),
        price: z.number().int().min(0),
        quantity: z.number().int().min(0),
        isDefault: z.boolean().optional(),
        requiresNickname: z.boolean().optional(),
      }),
    )
    .min(1, "バリエーションを1つ以上登録してください"),
});

// ---- 管理: 在庫調整 ----
export const inventoryAdjustSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(0),
});
