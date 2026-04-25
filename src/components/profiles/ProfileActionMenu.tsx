import { Copy, Download, Edit2, MoreVertical, Pin, PinOff, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={ref} className="relative">
      <button
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
          className="absolute right-0 top-full mt-1 z-30 min-w-[180px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1"
        >
          <Item
            icon={isPinned ? <PinOff size={14} /> : <Pin size={14} />}
            label={isPinned ? t("profileCard.unpin") : t("profileCard.pin")}
            onClick={() => {
              close();
              onTogglePin();
            }}
          />
          <Item
            icon={<Edit2 size={14} />}
            label={t("profileCard.edit")}
            onClick={() => {
              close();
              onEdit();
            }}
          />
          <Item
            icon={<Copy size={14} />}
            label={t("profileCard.duplicate")}
            onClick={() => {
              close();
              onDuplicate();
            }}
          />
          <Item
            icon={<Download size={14} />}
            label={t("profileCard.export")}
            onClick={() => {
              close();
              onExport();
            }}
          />
          <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
          <Item
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

function Item({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
        danger
          ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
