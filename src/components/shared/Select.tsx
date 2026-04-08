import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface SelectProps<T extends string> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  "aria-label"?: string;
  className?: string;
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  "aria-label": ariaLabel,
  className,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open]);

  // Reset highlight when opening
  const handleOpenToggle = () => {
    if (!open) {
      setHighlightedIndex(options.findIndex((o) => o.value === value));
    }
    setOpen((prev) => !prev);
  };

  const commit = (index: number) => {
    onChange(options[index].value);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex(options.findIndex((o) => o.value === value));
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, options.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        setHighlightedIndex(0);
        break;
      case "End":
        e.preventDefault();
        setHighlightedIndex(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (highlightedIndex >= 0) commit(highlightedIndex);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  const activeDescendant =
    open && highlightedIndex >= 0
      ? `${listId}-option-${highlightedIndex}`
      : undefined;

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={activeDescendant}
        aria-label={ariaLabel}
        onClick={handleOpenToggle}
        onKeyDown={handleKeyDown}
        className="flex items-center gap-1.5 px-2 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
      >
        <span>{selectedLabel}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          onKeyDown={handleKeyDown}
          className="absolute left-0 top-full mt-1 z-50 min-w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden"
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${listId}-option-${index}`}
              role="option"
              aria-selected={option.value === value}
              onPointerDown={(e) => {
                // Prevent the document pointerdown handler from closing before we commit
                e.stopPropagation();
                commit(index);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`px-3 py-1.5 text-sm cursor-pointer select-none ${
                option.value === value
                  ? "text-blue-600 dark:text-blue-400 font-medium"
                  : "text-gray-900 dark:text-white"
              } ${
                index === highlightedIndex
                  ? "bg-gray-100 dark:bg-gray-800"
                  : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
              }`}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
