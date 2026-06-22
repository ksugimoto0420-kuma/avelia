import { prisma } from "../src/lib/prisma";

async function main() {
  const e = await prisma.event.findUnique({
    where: { id: "8876ecb4-865f-4b86-93df-f4a5c4749076" },
    select: { id: true, title: true, coverImageUrl: true },
  });
  console.log(e);
  if (e?.coverImageUrl) {
    const ctrl = new AbortController();
    const tm = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(e.coverImageUrl, { method: "HEAD", redirect: "follow", signal: ctrl.signal });
      console.log(`HTTP=${res.status}`);
    } catch (err) {
      console.log("fetch error:", err);
    } finally {
      clearTimeout(tm);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
