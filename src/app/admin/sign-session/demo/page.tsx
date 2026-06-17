import { requireAdminPage } from "@/lib/auth/admin-page";
import { DemoSignSession } from "./DemoSignSession";

export const dynamic = "force-dynamic";

export const metadata = { title: "サイン記入デモ" };

export default async function SignSessionDemoPage() {
  await requireAdminPage("OPERATOR");
  return <DemoSignSession />;
}
