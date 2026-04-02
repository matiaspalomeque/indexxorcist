import { ArrowDown, ArrowUp } from "lucide-react";
import { memo } from "react";
import type { SortConfig } from "../../utils/sort";

interface SortableHeaderProps<K extends string> {
  label: string;
  sortKey: K;
  sortConfig: SortConfig<K> | null;
  onSort: (key: K) => void;
  className?: string;
}

function SortableHeaderInner<K extends string>({
  label,
  sortKey,
  sortConfig,
  onSort,
  className = "",
}: SortableHeaderProps<K>) {
  const isActive = sortConfig?.key === sortKey;
  const Icon = isActive && sortConfig.direction === "desc" ? ArrowDown : ArrowUp;

  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`cursor-pointer select-none ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && (
          <Icon size={12} className="text-blue-500 dark:text-blue-400 shrink-0" />
        )}
      </span>
    </th>
  );
}

export const SortableHeader = memo(SortableHeaderInner) as typeof SortableHeaderInner;
