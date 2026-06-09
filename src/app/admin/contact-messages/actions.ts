"use server";

import { revalidatePath } from "next/cache";
import type { ContactStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/guards";
import { logOperation } from "@/lib/operation-log";
import { prisma } from "@/lib/prisma";

const VALID_STATUSES: ContactStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "SPAM",
];

export async function updateContactStatus(formData: FormData) {
  const admin = await requireAdmin("OPERATOR");
  const id = formData.get("id") as string | null;
  const status = formData.get("status") as ContactStatus | null;
  const adminNote = (formData.get("adminNote") as string | null)?.trim() || null;
  if (!id || !status || !VALID_STATUSES.includes(status)) {
    throw new Error("不正な入力です");
  }
  await prisma.contactMessage.update({
    where: { id },
    data: { status, adminNote },
  });
  await logOperation({
    adminUserId: admin.id,
    action: "contact.update",
    targetType: "ContactMessage",
    targetId: id,
    detail: { status, adminNote },
  });
  revalidatePath("/admin/contact-messages");
}
