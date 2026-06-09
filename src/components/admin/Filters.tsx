import Link from "next/link";

// 管理画面の絞り込みフォーム部品（GET送信・サーバーレンダリング）

const fieldCls =
  "h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

export function FilterBar({
  action,
  clearHref,
  children,
}: {
  action: string;
  clearHref: string;
  children: React.ReactNode;
}) {
  return (
    <form
      method="get"
      action={action}
      className="flex flex-wrap items-end gap-2 rounded-xl border border-gray-100 bg-white p-3"
    >
      {children}
      <button
        type="submit"
        className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
      >
        絞り込み
      </button>
      <Link
        href={clearHref}
        className="flex h-9 items-center rounded-lg px-3 text-sm text-gray-500 hover:bg-gray-100"
      >
        クリア
      </Link>
    </form>
  );
}

export function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      {children}
    </label>
  );
}

export function FilterText({
  name,
  defaultValue,
  placeholder,
  className,
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="search"
      name={name}
      defaultValue={defaultValue}
      placeholder={placeholder}
      className={`${fieldCls} ${className ?? "w-56"}`}
    />
  );
}

export function FilterSelect({
  name,
  defaultValue,
  options,
  className,
}: {
  name: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className={`${fieldCls} ${className ?? "w-40"}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
