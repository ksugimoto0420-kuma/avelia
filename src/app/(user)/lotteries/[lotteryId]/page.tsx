import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { getOptionalUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatYen } from "@/lib/utils";
import { enterLottery } from "../actions";

export const dynamic = "force-dynamic";

export default async function LotteryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ lotteryId: string }>;
  searchParams: Promise<{ entered?: string }>;
}) {
  const { lotteryId } = await params;
  const sp = await searchParams;
  const user = await getOptionalUser();

  const lottery = await prisma.lottery.findUnique({
    where: { id: lotteryId },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          artistName: true,
          coverImageUrl: true,
        },
      },
      product: {
        select: { id: true, name: true, imageUrl: true, basePrice: true },
      },
      _count: { select: { entries: true } },
    },
  });
  if (!lottery) notFound();

  // 対象商品の画像 → なければイベントカバー画像
  const heroImage =
    lottery.product?.imageUrl ?? lottery.event?.coverImageUrl ?? null;

  const now = new Date();
  const isOpen =
    lottery.status === "OPEN" &&
    lottery.entryStartAt <= now &&
    lottery.entryEndAt >= now;

  const myEntry = user
    ? await prisma.lotteryEntry.findUnique({
        where: { lotteryId_userId: { lotteryId, userId: user.id } },
      })
    : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 space-y-6">
      <div>
        <Link
          href="/lotteries"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← 抽選一覧に戻る
        </Link>
      </div>

      {sp.entered === "1" && (
        <Alert tone="success" title="ご応募ありがとうございました">
          応募を受け付けました。抽選結果はマイページからご確認いただけます。
        </Alert>
      )}

      {heroImage && (
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-100 to-brand-50">
          <div className="aspect-[16/9] w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroImage}
              alt={lottery.title}
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {lottery.status === "OPEN" && isOpen && (
            <Badge color="green">受付中</Badge>
          )}
          {lottery.status === "CLOSED" && <Badge color="yellow">締切</Badge>}
          {lottery.status === "DRAWN" && <Badge color="purple">抽選済</Badge>}
          {myEntry?.status === "WON" && <Badge color="green">あなたは当選</Badge>}
          {myEntry?.status === "LOST" && <Badge color="gray">あなたは落選</Badge>}
          {myEntry?.status === "ENTERED" && (
            <Badge color="blue">あなたは応募済み</Badge>
          )}
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{lottery.title}</h1>
        {lottery.event && (
          <p className="text-sm text-brand-600">
            {lottery.event.artistName ?? lottery.event.title}
          </p>
        )}
        {lottery.description && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
            {lottery.description}
          </p>
        )}
      </div>

      <Card>
        <CardHeader title="抽選詳細" />
        <CardBody>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[8rem_1fr]">
            <dt className="font-semibold text-gray-500">応募開始</dt>
            <dd className="text-gray-800">
              {formatDateTime(lottery.entryStartAt)}
            </dd>
            <dt className="font-semibold text-gray-500">応募終了</dt>
            <dd className="text-gray-800">
              {formatDateTime(lottery.entryEndAt)}
            </dd>
            <dt className="font-semibold text-gray-500">当選者数</dt>
            <dd className="text-gray-800">{lottery.winnersCount} 名</dd>
            <dt className="font-semibold text-gray-500">応募者数</dt>
            <dd className="text-gray-800">{lottery._count.entries} 名</dd>
            {lottery.purchaseDeadlineAt && (
              <>
                <dt className="font-semibold text-gray-500">購入期限</dt>
                <dd className="text-gray-800">
                  {formatDateTime(lottery.purchaseDeadlineAt)}
                </dd>
              </>
            )}
            {lottery.product && (
              <>
                <dt className="font-semibold text-gray-500">対象商品</dt>
                <dd className="text-gray-800">
                  <Link
                    href={`/products/${lottery.product.id}`}
                    className="text-brand-600 hover:underline"
                  >
                    {lottery.product.name}
                  </Link>
                  {lottery.product.basePrice > 0 && (
                    <span className="ml-2 text-gray-500">
                      ({formatYen(lottery.product.basePrice)})
                    </span>
                  )}
                </dd>
              </>
            )}
          </dl>
        </CardBody>
      </Card>

      {/* 応募アクション */}
      <Card>
        <CardBody className="space-y-3">
          {!user ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                抽選への応募にはログインが必要です。
              </p>
              <Link
                href={`/auth/login?callbackUrl=/lotteries/${lottery.id}`}
                className="inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700"
              >
                ログインして応募
              </Link>
            </div>
          ) : myEntry ? (
            <p className="text-sm text-gray-600">
              {myEntry.status === "WON" &&
                "おめでとうございます！購入期限内に対象商品をご購入ください。"}
              {myEntry.status === "LOST" && "残念ながら落選となりました。"}
              {myEntry.status === "ENTERED" &&
                "応募を受け付けました。抽選結果をお待ちください。"}
              {myEntry.status === "PURCHASED" && "ご購入ありがとうございました。"}
              {myEntry.status === "EXPIRED" && "購入期限が過ぎました。"}
            </p>
          ) : isOpen ? (
            <form action={enterLottery} className="space-y-3">
              <input type="hidden" name="lotteryId" value={lottery.id} />
              <p className="text-sm text-gray-600">
                応募ボタンを押すとこの抽選に応募します。お一人様1回まで応募可能です。
              </p>
              <button
                type="submit"
                className="inline-flex rounded-lg bg-brand-600 px-6 py-2 text-sm font-bold text-white hover:bg-brand-700"
              >
                この抽選に応募する
              </button>
            </form>
          ) : (
            <p className="text-sm text-gray-600">
              {lottery.entryStartAt > now
                ? "応募はまだ開始していません。"
                : "応募期間は終了しました。"}
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
