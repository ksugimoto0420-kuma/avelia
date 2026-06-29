"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";
import { drawKuji } from "@/lib/kuji/draw";
import { generateOrderNumber } from "@/lib/utils";

/**
 * アベリアくじを購入して即時抽選する。
 *
 * デモ段階のためStripe等の決済を介さず、サーバーアクションで
 * Order を直接 PAID として生成 + KujiDraw を作成する。
 * 本番化時は決済成功 webhook 内で drawKuji を呼ぶ形に差し替える。
 */
export async function purchaseKujiBundle(formData: FormData): Promise<void> {
  const user = await requireUser();
  const campaignId = formData.get("campaignId") as string;
  const bundleId = formData.get("bundleId") as string;
  if (!campaignId || !bundleId) throw new Error("入力が不正です");

  // ガード
  const campaign = await prisma.kujiCampaign.findUnique({
    where: { id: campaignId },
    include: { bundles: { where: { id: bundleId } } },
  });
  if (!campaign) throw new Error("くじが見つかりません");
  if (campaign.status !== "OPEN") {
    throw new Error("販売中ではないため購入できません");
  }
  const now = new Date();
  if (now < campaign.saleStartAt) throw new Error("販売開始前です");
  if (now > campaign.saleEndAt) throw new Error("販売は終了しています");
  const bundle = campaign.bundles[0];
  if (!bundle) throw new Error("連数SKUが見つかりません");

  // 配送先用に DB ユーザーを取得
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) throw new Error("ユーザーが見つかりません");

  // トランザクション: 抽選実行 + 注文作成 + KujiDraw 作成
  const result = await prisma.$transaction(async (tx) => {
    // 抽選
    const draws = await drawKuji(
      tx,
      campaignId,
      bundle.drawCount,
      bundle.bonusPrizeId,
    );

    // 注文作成（デモ前提のため PAID 即確定）
    const orderNumber = generateOrderNumber(now);
    const subtotal = bundle.priceTotal;
    const order = await tx.order.create({
      data: {
        orderNumber,
        userId: user.id,
        status: "PAID",
        currency: "jpy",
        subtotal,
        shippingFee: 0,
        total: subtotal,
        recipientName: dbUser.name,
        recipientPhone: dbUser.phone,
        recipientPostal: dbUser.postalCode,
        recipientAddress: dbUser.address,
        paidAt: now,
      },
    });

    // KujiDraw 作成
    await tx.kujiDraw.createMany({
      data: draws.map((d) => ({
        campaignId,
        userId: user.id,
        orderId: order.id,
        prizeId: d.prizeId,
        isBundleBonus: d.isBundleBonus,
      })),
    });

    return { orderId: order.id, drawCount: bundle.drawCount };
  });

  await logOperation({
    adminUserId: null,
    action: "kuji.purchase",
    targetType: "KujiCampaign",
    targetId: campaignId,
    detail: {
      userId: user.id,
      bundleId,
      drawCount: result.drawCount,
      orderId: result.orderId,
    },
  });

  revalidatePath(`/kuji/${campaignId}`);
  revalidatePath(`/mypage/orders`);
  redirect(`/kuji/${campaignId}/result/${result.orderId}`);
}
