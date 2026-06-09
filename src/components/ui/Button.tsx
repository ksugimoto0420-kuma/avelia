import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 shadow-sm disabled:bg-brand-300",
  secondary:
    "bg-gray-900 text-white hover:bg-gray-800 disabled:bg-gray-400",
  outline:
    "border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-50",
  ghost: "text-gray-700 hover:bg-gray-100 disabled:opacity-50",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-1 disabled:cursor-not-allowed";

type CommonProps = {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
};

type ButtonAsButton = CommonProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type ButtonAsLink = CommonProps &
  React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export function Button(props: ButtonAsButton | ButtonAsLink) {
  const {
    variant = "primary",
    size = "md",
    fullWidth,
    className,
    ...rest
  } = props;

  const classes = cn(
    base,
    variants[variant],
    sizes[size],
    fullWidth && "w-full",
    className,
  );

  if ("href" in props && props.href !== undefined) {
    const { href, ...anchorRest } = rest as ButtonAsLink;
    return (
      <Link href={href} className={classes} {...anchorRest} />
    );
  }

  return (
    <button
      className={classes}
      {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    />
  );
}
