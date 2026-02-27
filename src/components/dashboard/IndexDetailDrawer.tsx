import { X } from "lucide-react";
import { useT } from "../../i18n";
import type { DatabaseCardData, IndexDetail } from "../../types";

interface Props {
  db: DatabaseCardData;
  onClose: () => void;
}

const ACTION_BADGE: Record<string, string> = {
  REBUILD: "bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  REORGANIZE: "bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  SKIP: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-700",
};

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400",
  processing: "bg-yellow-100 dark:bg-yellow-900/60 text-yellow-700 dark:text-yellow-300 animate-pulse",
  done: "bg-green-100 dark:bg-green-900/60 text-green-700 dark:text-green-300",
  skipped: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-500",
  error: "bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300",
};

function Badge({ text, cls }: { text: string; cls: string }) {
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-xs border ${cls}`}>
      {text}
    </span>
  );
}

function IndexRow({ idx }: { idx: IndexDetail }) {
  return (
    <tr className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
      <td className="px-3 py-2 text-xs text-gray-700 dark:text-gray-400 font-mono whitespace-nowrap">
        {idx.schema_name}.{idx.table_name}
      </td>
      <td className="px-3 py-2 text-xs text-gray-700 dark:text-gray-200 font-mono whitespace-nowrap">
        {idx.index_name}
      </td>
      <td className="px-3 py-2 text-xs text-right">
        <span
          className={
            idx.fragmentation_percent >= 30
              ? "text-red-500 dark:text-red-400"
              : idx.fragmentation_percent >= 10
              ? "text-yellow-600 dark:text-yellow-400"
              : "text-gray-700 dark:text-gray-400"
          }
        >
          {idx.fragmentation_percent.toFixed(1)}%
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-right text-gray-700 dark:text-gray-400">
        {idx.page_count.toLocaleString()}
      </td>
      <td className="px-3 py-2">
        {idx.action && (
          <Badge text={idx.action} cls={ACTION_BADGE[idx.action] ?? ""} />
        )}
      </td>
      <td className="px-3 py-2">
        <Badge text={idx.status} cls={STATUS_BADGE[idx.status] ?? ""} />
      </td>
      <td className="px-3 py-2 text-xs text-right text-gray-700 dark:text-gray-400">
        {idx.duration_secs != null ? `${idx.duration_secs.toFixed(1)}s` : "—"}
      </td>
      <td className="px-3 py-2 text-xs text-right text-gray-700 dark:text-gray-400">
        {idx.retry_attempts != null && idx.retry_attempts > 1
          ? idx.retry_attempts
          : "—"}
      </td>
      <td
        className="px-3 py-2 text-xs text-red-500 dark:text-red-400 max-w-[320px] break-words"
        title={idx.error}
      >
        {idx.error ?? "—"}
      </td>
    </tr>
  );
}

export function IndexDetailDrawer({ db, onClose }: Props) {
  const t = useT();
  const headers = [
    t("drawer.colSchemaTable"),
    t("drawer.colIndex"),
    t("drawer.colFrag"),
    t("drawer.colPages"),
    t("drawer.colAction"),
    t("drawer.colStatus"),
    t("drawer.colDuration"),
    t("drawer.colRetries"),
    t("drawer.colError"),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-t-2xl w-full max-h-[70vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{db.name}</h3>
            <p className="text-xs text-gray-700 dark:text-gray-400 mt-0.5">
              {t("drawer.indexesTotal", { count: db.indexes.length })}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white">
            <X size={18} />
          </button>
        </div>

        {db.errors.length > 0 && (
          <div className="px-5 py-3 border-b border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20">
            <p className="text-xs font-medium text-red-600 dark:text-red-300 uppercase tracking-wide">
              {t("drawer.dbErrors", { count: db.errors.length })}
            </p>
            <div className="mt-2 max-h-24 overflow-y-auto space-y-1">
              {db.errors.map((error, i) => (
                <p key={i} className="text-xs text-red-700 dark:text-red-200 font-mono break-words">
                  {error}
                </p>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-auto flex-1">
          {db.indexes.length === 0 ? (
            <p className="text-center py-8 text-sm text-gray-600 dark:text-gray-500">
              {t("drawer.noIndexData")}
            </p>
          ) : (
            <table className="w-full min-w-[900px]">
              <thead className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  {headers.map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {db.indexes.map((idx) => (
                  <IndexRow key={`${idx.schema_name}.${idx.table_name}.${idx.index_name}`} idx={idx} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
