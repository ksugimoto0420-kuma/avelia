import { EventForm } from "@/components/admin/EventForm";
import { requireAdminPage } from "@/lib/auth/admin-page";

export default async function NewEventPage() {
  await requireAdminPage("OPERATOR");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">新規イベント</h1>
      <EventForm />
    </div>
  );
}
