import { cn } from "@/lib/utils";

const tones = {
  brand: "from-brand-500 to-brand-400",
  green: "from-emerald-500 to-emerald-400",
  blue: "from-sky-500 to-sky-400",
  amber: "from-amber-500 to-amber-400",
  purple: "from-violet-500 to-violet-400",
  red: "from-red-500 to-red-400",
} as const;

export function DashboardCard({
  label,
  value,
  sub,
  icon,
  tone = "brand",
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon?: string;
  tone?: keyof typeof tones;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className={cn("h-1.5 bg-gradient-to-r", tones[tone])} />
      <div className="flex items-start justify-between p-5">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-extrabold text-gray-900">{value}</p>
          {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
        </div>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
    </div>
  );
}
