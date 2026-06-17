import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { requireUserPage } from "@/lib/auth/user-page";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; color: "green" | "gray" | "yellow" | "purple" | "red" }> =
  {
    ENTERED: { label: "抽選待ち", color: "yellow" },
    WON: { label: "当選", color: "green" },
    LOST: { label: "落選", color: "gray" },
    PURCHASED: { label: "購入済", color: "purple" },
    EXPIRED: { label: "期限切れ", color: "red" },
  };

export default async function MypageLotteryResults() {
  const user = await requireUserPage("/mypage/lottery-results");
  const now = new Date();

  const entries = await prisma.lotteryEntry.findMany({
    where: { userId: user.id },
    orderBy: { enteredAt: "desc" },
    include: { lottery: { include: { product: true } } },
  });

  if (entries.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-gray-400">
        抽選への応募はありません
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map((e) => {
        const conf = STATUS[e.status];
        const canBuy =
          e.status === "WON" &&
          e.lottery.product &&
          (!e.purchaseDeadlineAt || e.purchaseDeadlineAt >= now);
        return (
          <Card key={e.id}>
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Link
                  href={`/lotteries/${e.lottery.id}`}
                  className="font-semibold text-gray-900 hover:text-brand-600"
                >
                  {e.lottery.title}
                </Link>
                {e.purchaseDeadlineAt && (
                  <p className="text-xs text-gray-400">
                    購入期限: {formatDateTime(e.purchaseDeadlineAt)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Badge color={conf.color}>{conf.label}</Badge>
                {canBuy && e.lottery.product && (
                  <Button href={`/products/${e.lottery.product.id}`} size="sm">
                    購入する
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
