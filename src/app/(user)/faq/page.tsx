import { Card, CardBody } from "@/components/ui/Card";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = { title: "よくある質問" };

export default async function FaqPage() {
  const faqs = await prisma.faq.findMany({
    where: { isPublished: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900">よくある質問</h1>
      <p className="mt-2 text-sm text-gray-500">
        オンライン特典会・サイン会、サイン入り商品について。
      </p>
      {faqs.length === 0 ? (
        <p className="mt-12 rounded-xl border border-dashed border-gray-200 py-12 text-center text-gray-400">
          現在掲載中の質問はありません
        </p>
      ) : (
        <div className="mt-8 space-y-4">
          {faqs.map((f) => (
            <Card key={f.id}>
              <CardBody>
                <p className="font-semibold text-gray-900">Q. {f.question}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
                  A. {f.answer}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
