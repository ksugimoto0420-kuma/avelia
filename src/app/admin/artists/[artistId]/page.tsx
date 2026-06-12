import { notFound } from "next/navigation";
import { ArtistForm } from "@/components/admin/ArtistForm";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { prisma } from "@/lib/prisma";
import { deleteArtist } from "../actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "アーティスト編集" };

export default async function EditArtistPage({
  params,
}: {
  params: Promise<{ artistId: string }>;
}) {
  await requireAdminPage("OPERATOR");
  const { artistId } = await params;

  const artist = await prisma.artist.findUnique({
    where: { id: artistId },
    include: { _count: { select: { events: true } } },
  });
  if (!artist) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">アーティスト編集</h1>
      <ArtistForm artist={artist} />

      <Card className="border-red-200">
        <CardHeader title="削除" />
        <CardBody className="space-y-3">
          <p className="text-sm text-gray-600">
            紐づくイベント {artist._count.events}{" "}
            件は残ります（artistName のみのテキスト表示にフォールバック）。
          </p>
          <form action={deleteArtist}>
            <input type="hidden" name="id" value={artist.id} />
            <button
              type="submit"
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              このアーティストを削除する
            </button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
