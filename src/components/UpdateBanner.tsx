import { Download, X } from "lucide-react";
import { useUpdater } from "../hooks/useUpdater";

export function UpdateBanner() {
  const { update, installing, install, dismiss } = useUpdater();

  if (!update) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg px-4 py-3 text-sm">
      <Download size={16} className="text-blue-500 shrink-0" />
      <span className="text-gray-700 dark:text-gray-300">
        Update{" "}
        <span className="font-semibold text-gray-900 dark:text-white">
          v{update.version}
        </span>{" "}
        available
      </span>
      <button
        onClick={install}
        disabled={installing}
        className="ml-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
      >
        {installing ? "Installing…" : "Update & Restart"}
      </button>
      <button
        onClick={dismiss}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
