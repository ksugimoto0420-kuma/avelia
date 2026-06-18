"use client";

import { useState } from "react";
import {
  SearchableSelect,
  type SearchableOption,
} from "@/components/ui/SearchableSelect";

/**
 * Server Component から使えるよう、内部 state を持つ SearchableSelect ラッパー。
 * `name` 属性で hidden input に同期されるので、Server Action の form 送信に
 * そのまま対応できる。
 */
export function SearchableSelectField({
  name,
  defaultValue,
  options,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  allowEmpty,
  emptyLabel,
  emptyValue,
  required,
  id,
}: {
  name: string;
  defaultValue?: string;
  options: SearchableOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  emptyValue?: string;
  required?: boolean;
  id?: string;
}) {
  const [value, setValue] = useState<string>(defaultValue ?? "");
  return (
    <SearchableSelect
      id={id}
      name={name}
      value={value}
      onChange={setValue}
      options={options}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyMessage={emptyMessage}
      allowEmpty={allowEmpty}
      emptyLabel={emptyLabel}
      emptyValue={emptyValue}
      required={required}
    />
  );
}
