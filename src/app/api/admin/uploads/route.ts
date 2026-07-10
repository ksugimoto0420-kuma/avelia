import { AppError, handleError, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guards";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await requireAdmin("OPERATOR");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new AppError("ファイルが指定されていません", 400);
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storage.put(buffer, file.name);
    return ok(stored, 201);
  } catch (err) {
    return handleError(err);
  }
}
