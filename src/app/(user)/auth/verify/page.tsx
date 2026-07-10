import { Suspense } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { VerifyPageClient } from "./VerifyPageClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "メールアドレスの確認 | Avelia FunClub" };

export default function VerifyPage() {
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-10">
      <h1 className="text-xl font-bold text-gray-900">メールアドレスの確認</h1>
      <Card>
        <CardBody>
          <Suspense fallback={<p className="text-sm text-gray-500">確認中...</p>}>
            <VerifyPageClient />
          </Suspense>
        </CardBody>
      </Card>
    </div>
  );
}
