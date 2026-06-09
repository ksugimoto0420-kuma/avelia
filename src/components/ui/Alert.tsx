import { cn } from "@/lib/utils";

type Tone = "info" | "success" | "warning" | "error";

const tones: Record<Tone, string> = {
  info: "bg-blue-50 text-blue-800 border-blue-200",
  success: "bg-green-50 text-green-800 border-green-200",
  warning: "bg-yellow-50 text-yellow-800 border-yellow-200",
  error: "bg-red-50 text-red-800 border-red-200",
};

export function Alert({
  tone = "info",
  title,
  className,
  children,
}: {
  tone?: Tone;
  title?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-lg border px-4 py-3 text-sm", tones[tone], className)}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={cn(title && "mt-1")}>{children}</div>}
    </div>
  );
}
