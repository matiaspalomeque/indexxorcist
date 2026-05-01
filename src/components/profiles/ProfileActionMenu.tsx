import { Copy, Download, Edit2, MoreVertical, Pin, PinOff, Trash2 } from "lucide-react";
import { forwardRef, useEffect, useRef, useState } from "react";
import { useT } from "../../i18n";

interface Props {
  isPinned: boolean;
  onTogglePin: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onDelete: () => void;
}

export function ProfileActionMenu({
  isPinned,
  onTogglePin,
  onEdit,
  onDuplicate,
  onExport,
  onDelete,
}: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
  }, [open]);

  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = itemRefs.current.filter((item): item is HTMLButtonElement => Boolean(item));
    if (items.length === 0) return;
    const currentIndex = items.findIndex((item) => item === document.activeElement);

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        close(true);
        break;
      case "ArrowDown":
        e.preventDefault();
        items[(currentIndex + 1 + items.length) % items.length]?.focus();
        break;
      case "ArrowUp":
        e.preventDefault();
        items[(currentIndex - 1 + items.length) % items.length]?.focus();
        break;
      case "Home":
        e.preventDefault();
        items[0]?.focus();
        break;
      case "End":
        e.preventDefault();
        items[items.length - 1]?.focus();
        break;
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-white transition-colors"
        aria-label={t("profileCard.menu")}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVertical size={15} />
      </button>

      {open && (
        <div
          role="menu"
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 top-full mt-1 z-30 min-w-[180px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1"
        >
          <Item
            ref={(node) => {
              itemRefs.current[0] = node;
            }}
            icon={isPinned ? <PinOff size={14} /> : <Pin size={14} />}
            label={isPinned ? t("profileCard.unpin") : t("profileCard.pin")}
            onClick={() => {
              close();
              onTogglePin();
            }}
          />
          <Item
            ref={(node) => {
              itemRefs.current[1] = node;
            }}
            icon={<Edit2 size={14} />}
            label={t("profileCard.edit")}
            onClick={() => {
              close();
              onEdit();
            }}
          />
          <Item
            ref={(node) => {
              itemRefs.current[2] = node;
            }}
            icon={<Copy size={14} />}
            label={t("profileCard.duplicate")}
            onClick={() => {
              close();
              onDuplicate();
            }}
          />
          <Item
            ref={(node) => {
              itemRefs.current[3] = node;
            }}
            icon={<Download size={14} />}
            label={t("profileCard.export")}
            onClick={() => {
              close();
              onExport();
            }}
          />
          <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
          <Item
            ref={(node) => {
              itemRefs.current[4] = node;
            }}
            icon={<Trash2 size={14} />}
            label={t("profileCard.delete")}
            danger
            onClick={() => {
              close();
              onDelete();
            }}
          />
        </div>
      )}
    </div>
  );
}

interface ItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

const Item = forwardRef<HTMLButtonElement, ItemProps>(function Item(
  {
    icon,
    label,
    onClick,
    danger,
  },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors focus:outline-none ${
        danger
          ? "text-red-600 dark:text-red-400 hover:bg-red-50 focus:bg-red-50 dark:hover:bg-red-900/20 dark:focus:bg-red-900/20"
          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 focus:bg-gray-100 dark:hover:bg-gray-800 dark:focus:bg-gray-800"
      }`}
    >
      {icon}
      {label}
    </button>
  );
});
