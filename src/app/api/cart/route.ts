import { handleError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/guards";
import { getCartView } from "@/lib/cart";

export async function GET() {
  try {
    const user = await requireUser();
    const view = await getCartView(user.id);
    return ok(view);
  } catch (err) {
    return handleError(err);
  }
}
