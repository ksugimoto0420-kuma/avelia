import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { requireUserPage } from "@/lib/auth/user-page";
import { prisma } from "@/lib/prisma";
import { formatYen } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MypageOverview() {
  const user = await requireUserPage();

  const [
    orderCount,
    paidAgg,
    grantCount,
    deliveryCount,
    wonCount,
    kujiDrawCount,
  ] = await Promise.all([
    // アベリアくじの Order（KujiDraw 紐づき）はマイページ「注文数」から除外
    prisma.order.count({
      where: { userId: user.id, kujiDraws: { none: {} } },
    }),
    prisma.order.aggregate({
      where: {
        userId: user.id,
        status: "PAID",
        kujiDraws: { none: {} },
      },
      _sum: { total: true },
    }),
    prisma.userDigitalContent.count({ where: { userId: user.id } }),
    prisma.digitalDelivery.count({ where: { userId: user.id } }),
    prisma.lotteryEntry.count({
      where: { userId: user.id, status: { in: ["WON", "PURCHASED"] } },
    }),
    prisma.kujiDraw.count({ where: { userId: user.id } }),
  ]);
  const contentCount = grantCount + deliveryCount;

  const stats = [
    { label: "注文数", value: orderCount, href: "/mypage/orders" },
    {
      label: "購入金額",
      value: formatYen(paidAgg._sum.total ?? 0),
      href: "/mypage/orders",
    },
    {
      label: "デジタルコンテンツ",
      value: contentCount,
      href: "/mypage/digital-contents",
    },
    { label: "当選", value: wonCount, href: "/mypage/lottery-results" },
    {
      label: "アベリアくじ",
      value: kujiDrawCount,
      href: "/mypage/kuji",
    },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">{user.email} でログイン中</p>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="transition hover:shadow-md">
              <CardBody>
                <p className="text-sm text-gray-500">{s.label}</p>
                <p className="mt-1 text-2xl font-extrabold text-gray-900">
                  {s.value}
                </p>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
