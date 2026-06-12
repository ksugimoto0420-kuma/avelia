"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export async function saveArtist(formData: FormData) {
  const admin = await requireAdmin("OPERATOR");
  const id = (formData.get("id") as string | null) || null;
  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("名前は必須です");

  const slug =
    (formData.get("slug") as string)?.trim() ||
    slugify(name) ||
    `artist-${Date.now()}`;

  const data = {
    slug,
    name,
    nameKana: (formData.get("nameKana") as string)?.trim() || null,
    profileText: (formData.get("profileText") as string)?.trim() || null,
    imageUrl: (formData.get("imageUrl") as string)?.trim() || null,
    isPublished: formData.get("isPublished") === "on",
  };

  if (id) {
    await prisma.artist.update({ where: { id }, data });
    await logOperation({
      adminUserId: admin.id,
      action: "artist.update",
      targetType: "Artist",
      targetId: id,
    });
  } else {
    const created = await prisma.artist.create({ data });
    await logOperation({
      adminUserId: admin.id,
      action: "artist.create",
      targetType: "Artist",
      targetId: created.id,
    });
  }

  revalidatePath("/admin/artists");
  redirect("/admin/artists");
}

export async function deleteArtist(formData: FormData) {
  const admin = await requireAdmin("MANAGER");
  const id = formData.get("id") as string;
  if (!id) throw new Error("artistIdが必要です");

  const artist = await prisma.artist.findUnique({
    where: { id },
    include: { _count: { select: { events: true } } },
  });
  if (!artist) throw new Error("アーティストが見つかりません");

  // 紐づくイベントは artistId = null に SetNull で残る（破壊しない）
  await prisma.artist.delete({ where: { id } });
  await logOperation({
    adminUserId: admin.id,
    action: "artist.delete",
    targetType: "Artist",
    targetId: id,
    detail: { name: artist.name, eventsAffected: artist._count.events },
  });

  revalidatePath("/admin/artists");
  redirect("/admin/artists");
}
