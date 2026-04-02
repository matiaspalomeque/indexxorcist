import { useState, useCallback } from "react";

export type SortDirection = "asc" | "desc";

export interface SortConfig<K extends string = string> {
  key: K;
  direction: SortDirection;
}

export function toggleSort<K extends string>(
  current: SortConfig<K> | null,
  key: K,
): SortConfig<K> | null {
  if (!current || current.key !== key) return { key, direction: "asc" };
  if (current.direction === "asc") return { key, direction: "desc" };
  return null;
}

export function sortData<T>(
  data: readonly T[],
  config: SortConfig<string> | null,
  accessors?: Partial<Record<string, (item: T) => number | string>>,
): T[] {
  if (!config) return data.slice();

  const { key, direction } = config;
  const accessor = accessors?.[key];
  const mult = direction === "asc" ? 1 : -1;

  return data.slice().sort((a, b) => {
    const va = accessor ? accessor(a) : (a as Record<string, unknown>)[key];
    const vb = accessor ? accessor(b) : (b as Record<string, unknown>)[key];

    if (typeof va === "number" && typeof vb === "number") return (va - vb) * mult;
    const sa = String(va ?? "").toLowerCase();
    const sb = String(vb ?? "").toLowerCase();
    if (sa < sb) return -1 * mult;
    if (sa > sb) return 1 * mult;
    return 0;
  });
}

export function useSortableColumns<K extends string>() {
  const [sortConfig, setSortConfig] = useState<SortConfig<K> | null>(null);

  const handleSort = useCallback((key: K) => {
    setSortConfig((prev) => toggleSort(prev, key));
  }, []);

  return { sortConfig, handleSort } as const;
}
