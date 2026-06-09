import { cn } from "@/lib/utils";

export type BadgeColor =
  | "gray"
  | "green"
  | "yellow"
  | "red"
  | "blue"
  | "purple"
  | "pink";

const colors: Record<BadgeColor, string> = {
  gray: "bg-gray-100 text-gray-700",
  green: "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-800",
  red: "bg-red-100 text-red-700",
  blue: "bg-blue-100 text-blue-700",
  purple: "bg-purple-100 text-purple-700",
  pink: "bg-brand-100 text-brand-700",
};

export function Badge({
  color = "gray",
  className,
  children,
}: {
  color?: BadgeColor;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        colors[color],
        className,
      )}
    >
      {children}
    </span>
  );
}
