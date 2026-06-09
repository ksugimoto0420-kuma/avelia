import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  /** セル描画。省略時は row[key] を表示。 */
  cell?: (row: T) => React.ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
};

/**
 * 汎用テーブル。Server Component から利用できるよう描画専用。
 * 空状態は emptyMessage を表示する。
 */
export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  emptyMessage = "データがありません",
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  emptyMessage?: string;
  className?: string;
}) {
  const alignCls = (a?: "left" | "center" | "right") =>
    a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

  return (
    <div className={cn("overflow-x-auto rounded-xl border border-gray-200", className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-50 text-gray-600">
            {columns.map((c) => (
              <th
                key={c.key}
                className={cn(
                  "whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide",
                  alignCls(c.align),
                  c.className,
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-10 text-center text-gray-400"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50/60">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-4 py-3 text-gray-800",
                      alignCls(c.align),
                      c.className,
                    )}
                  >
                    {c.cell ? c.cell(row) : String(row[c.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
