import { redirect } from "next/navigation";
import { auth } from "@/auth";

/** ユーザーページ用ガード。未ログインなら /auth/login へ。 */
export async function requireUserPage(callbackUrl = "/mypage") {
  const session = await auth();
  if (!session?.user || session.user.kind !== "user") {
    redirect(`/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  return session.user;
}
