"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type TabItem = {
  key: string;
  label: React.ReactNode;
  content: React.ReactNode;
};

export function Tabs({
  items,
  defaultKey,
  className,
}: {
  items: TabItem[];
  defaultKey?: string;
  className?: string;
}) {
  const [active, setActive] = useState(defaultKey ?? items[0]?.key);
  const current = items.find((i) => i.key === active) ?? items[0];

  return (
    <div className={className}>
      <div className="flex gap-1 border-b border-gray-200">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => setActive(item.key)}
            className={cn(
              "px-4 py-2 text-sm font-medium -mb-px border-b-2",
              item.key === active
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-gray-500 hover:text-gray-800",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="pt-4">{current?.content}</div>
    </div>
  );
}
