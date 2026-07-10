import { createHash, randomBytes } from "node:crypto";

/**
 * URL 埋め込み用のランダムトークンとそのハッシュを生成する。
 * DB には hash 側のみを保存し、平文はメール送信時のみ利用する。
 */
export function generateToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}

/** URL/リクエストから受け取った平文トークンを検証用の hash に変換する。 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
