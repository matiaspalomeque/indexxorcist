import { X } from "lucide-react";
import { useT } from "../../i18n";
import appIcon from "../../assets/icon.png";

interface Props {
  onClose: () => void;
}

export function AboutModal({ onClose }: Props) {
  const t = useT();
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-8 w-80 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <img
          src={appIcon}
          alt="Indexxorcist icon"
          className="w-64 h-64 rounded-2xl mx-auto mb-5"
        />

        <h2 className="text-blue-500 dark:text-blue-400 font-semibold text-lg mb-1">
          {t("sidebar.appName")}
        </h2>
        <p className="text-gray-600 dark:text-gray-500 text-xs mb-4">v{__APP_VERSION__}</p>

        <p className="text-gray-600 dark:text-gray-500 text-xs">{t("about.madeBy")}</p>
        <p className="text-gray-700 dark:text-gray-300 text-sm font-medium">Matías Palomeque</p>
      </div>
    </div>
  );
}
