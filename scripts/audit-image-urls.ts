/**
 * DB 上の画像URLを全件監査して、HTTP 200 以外のものを洗い出す。
 * 同じURLが複数レコードで使われている前提で、ユニークURL単位でチェック。
 */
import { prisma } from "../src/lib/prisma";

async function head(url: string): Promise<number> {
  try {
    const ctrl = new AbortController();
    const tm = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: ctrl.signal,
    });
    clearTimeout(tm);
    return res.status;
  } catch {
    return 0;
  }
}

async function main() {
  // 全ての URL を集約
  const set = new Set<string>();

  const events = await prisma.event.findMany({
    where: { coverImageUrl: { not: null } },
    select: { coverImageUrl: true },
  });
  events.forEach((e) => e.coverImageUrl && set.add(e.coverImageUrl));

  const products = await prisma.product.findMany({
    where: { imageUrl: { not: null } },
    select: { imageUrl: true },
  });
  products.forEach((p) => p.imageUrl && set.add(p.imageUrl));

  const artists = await prisma.artist.findMany({
    where: { imageUrl: { not: null } },
    select: { imageUrl: true },
  });
  artists.forEach((a) => a.imageUrl && set.add(a.imageUrl));

  const contents = await prisma.digitalContent.findMany({
    where: { baseImageUrl: { not: null } },
    select: { baseImageUrl: true },
  });
  contents.forEach((c) => c.baseImageUrl && set.add(c.baseImageUrl));

  const urls = Array.from(set);
  console.log(`ユニークURL: ${urls.length} 件`);

  // 並列5本で HEAD チェック
  const BAD: { url: string; status: number }[] = [];
  let done = 0;
  const POOL = 5;
  const queue = [...urls];
  async function worker() {
    while (queue.length > 0) {
      const url = queue.shift();
      if (!url) break;
      const status = await head(url);
      done++;
      if (status !== 200) BAD.push({ url, status });
      if (done % 50 === 0) console.log(`  進捗: ${done}/${urls.length}`);
    }
  }
  await Promise.all(Array.from({ length: POOL }, () => worker()));

  console.log(`\n✗ 200以外: ${BAD.length} 件`);

  // ホスト別 / status別の集計
  const byHost: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const b of BAD) {
    let host = "?";
    try {
      host = new URL(b.url).host;
    } catch {}
    byHost[host] = (byHost[host] ?? 0) + 1;
    byStatus[String(b.status)] = (byStatus[String(b.status)] ?? 0) + 1;
  }
  console.log("ホスト別:", JSON.stringify(byHost));
  console.log("status別:", JSON.stringify(byStatus));

  // サンプル20件
  console.log("\nサンプル (先頭20):");
  for (const b of BAD.slice(0, 20)) {
    console.log(`  [${b.status}] ${b.url}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
