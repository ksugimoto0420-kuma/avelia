// PAY.JP Webhook（将来拡張用スタブ）。
// MVP では Stripe を利用。PAY.JP 採用時に署名検証と注文確定処理を実装する。

export async function POST() {
  return new Response(
    JSON.stringify({ received: true, note: "PAY.JP は未実装です" }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}
