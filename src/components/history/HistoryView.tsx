import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "../../i18n";
import { useHistoryStore } from "../../store/historyStore";
import type { DatabaseResult, IndexResult, RunRecord } from "../../types";

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.round(secs % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

const COL_COUNT = 9; // 8 data columns + 1 expand chevron

function dbStatusLabel(r: DatabaseResult, t: ReturnType<typeof useT>): { text: string; color: string } {
  if (r.critical_failure) return { text: t("history.statusFailed"), color: "text-red-500 dark:text-red-400" };
  if (r.manually_skipped) return { text: t("history.statusSkipped"), color: "text-amber-600 dark:text-amber-400" };
  return { text: t("history.statusDone"), color: "text-green-600 dark:text-green-400" };
}

function indexStatusLabel(r: IndexResult, t: ReturnType<typeof useT>): { text: string; color: string } {
  if (!r.success) return { text: t("history.statusFailed"), color: "text-red-500 dark:text-red-400" };
  if (r.action === "SKIP") return { text: t("history.statusSkipped"), color: "text-gray-500 dark:text-gray-400" };
  return { text: t("history.statusDone"), color: "text-green-600 dark:text-green-400" };
}

function ExpandedDetail({ record, t }: { record: RunRecord; t: ReturnType<typeof useT> }) {
  const dbResults = record.database_results;

  if (!dbResults || dbResults.length === 0) {
    return (
      <tr>
        <td colSpan={COL_COUNT} className="px-6 py-4 bg-gray-50 dark:bg-gray-900/60">
          <p className="text-xs text-gray-500 dark:text-gray-500 italic">{t("history.noDetails")}</p>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={COL_COUNT} className="p-0">
        <div className="bg-gray-50 dark:bg-gray-900/60 px-6 py-4 space-y-4">
          {dbResults.map((db) => {
            const status = dbStatusLabel(db, t);
            return (
              <div key={db.database_name} className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                {/* Database header */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-gray-900">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono font-medium text-gray-900 dark:text-white">{db.database_name}</span>
                    <span className={`text-xs font-medium ${status.color}`}>{status.text}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span>{t("history.colRebuilt")}: <span className="text-blue-500">{db.indexes_rebuilt}</span></span>
                    <span>{t("history.colReorganized")}: <span className="text-purple-500">{db.indexes_reorganized}</span></span>
                    <span>{t("history.colSkipped")}: {db.indexes_skipped}</span>
                    <span>{formatDuration(db.total_duration_secs)}</span>
                  </div>
                </div>

                {/* Error list */}
                {db.errors.length > 0 && (
                  <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 bg-red-50/50 dark:bg-red-900/10">
                    {db.errors.map((err, i) => (
                      <p key={i} className="text-xs text-red-600 dark:text-red-400 font-mono">{err}</p>
                    ))}
                  </div>
                )}

                {/* Index results table */}
                {db.index_results && db.index_results.length > 0 && (
                  <div className="border-t border-gray-100 dark:border-gray-800">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-100/60 dark:bg-gray-800/40">
                          <th className="text-left px-4 py-1.5 text-gray-500 dark:text-gray-500 font-medium uppercase tracking-wide">{t("history.colIndex")}</th>
                          <th className="text-left px-4 py-1.5 text-gray-500 dark:text-gray-500 font-medium uppercase tracking-wide">{t("history.colTable")}</th>
                          <th className="text-right px-4 py-1.5 text-gray-500 dark:text-gray-500 font-medium uppercase tracking-wide">{t("history.colFrag")}</th>
                          <th className="text-left px-4 py-1.5 text-gray-500 dark:text-gray-500 font-medium uppercase tracking-wide">{t("history.colAction")}</th>
                          <th className="text-left px-4 py-1.5 text-gray-500 dark:text-gray-500 font-medium uppercase tracking-wide">{t("history.colStatus")}</th>
                          <th className="text-right px-4 py-1.5 text-gray-500 dark:text-gray-500 font-medium uppercase tracking-wide">{t("history.colDuration")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {db.index_results.map((idx) => {
                          const idxStatus = indexStatusLabel(idx, t);
                          return (
                            <tr key={`${idx.schema_name}.${idx.table_name}.${idx.index_name}`} className="border-t border-gray-100 dark:border-gray-800/40">
                              <td className="px-4 py-1.5 font-mono text-gray-700 dark:text-gray-300">{idx.index_name}</td>
                              <td className="px-4 py-1.5 text-gray-600 dark:text-gray-400">{idx.schema_name}.{idx.table_name}</td>
                              <td className="px-4 py-1.5 text-right text-gray-600 dark:text-gray-400">{idx.fragmentation_percent.toFixed(1)}%</td>
                              <td className="px-4 py-1.5 text-gray-600 dark:text-gray-400">{idx.action}</td>
                              <td className={`px-4 py-1.5 font-medium ${idxStatus.color}`}>{idxStatus.text}</td>
                              <td className="px-4 py-1.5 text-right text-gray-600 dark:text-gray-400">
                                {idx.duration_secs > 0 ? formatDuration(idx.duration_secs) : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </td>
    </tr>
  );
}

export function HistoryView() {
  const t = useT();
  const { records, loading, error, loadHistory, clearHistory } = useHistoryStore();
  const [confirming, setConfirming] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handleClear = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    await clearHistory();
  };

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="mx-auto max-w-[1800px]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t("history.title")}
          </h2>
          {records.length > 0 && (
            <div className="flex items-center gap-2">
              {confirming && (
                <button
                  onClick={() => setConfirming(false)}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  {t("history.cancel")}
                </button>
              )}
              <button
                onClick={handleClear}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  confirming
                    ? "text-white bg-red-600 border-red-600 hover:bg-red-700"
                    : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40"
                }`}
              >
                <Trash2 size={14} />
                {confirming ? t("history.confirmClear") : t("history.clearAll")}
              </button>
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
        )}

        {loading ? (
          <p className="text-sm text-gray-600 dark:text-gray-500">{t("history.loading")}</p>
        ) : records.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-500">{t("history.noRuns")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="w-8" />
                  {(
                    [
                      "history.colProfile",
                      "history.colServer",
                      "history.colStarted",
                      "history.colDuration",
                      "history.colDbs",
                      "history.colRebuilt",
                      "history.colReorganized",
                      "history.colSkipped",
                    ] as const
                  ).map((key) => (
                    <th
                      key={key}
                      className="text-left py-2 pr-4 text-xs font-medium text-gray-600 dark:text-gray-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      {t(key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const isExpanded = expandedId === r.id;
                  const hasDetails = r.database_results && r.database_results.length > 0;
                  return (
                    <>
                      <tr
                        key={r.id}
                        onClick={() => toggleExpand(r.id)}
                        className={`border-b border-gray-100 dark:border-gray-800/60 cursor-pointer transition-colors ${
                          isExpanded
                            ? "bg-blue-50/50 dark:bg-blue-900/10"
                            : "hover:bg-gray-50 dark:hover:bg-gray-900/40"
                        }`}
                      >
                        <td className="py-3 pl-2 pr-1 text-gray-400 dark:text-gray-600">
                          {hasDetails ? (
                            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                          ) : (
                            <span className="inline-block w-[14px]" />
                          )}
                        </td>
                        <td className="py-3 pr-4 text-gray-900 dark:text-white font-medium">
                          {r.profile_name}
                        </td>
                        <td className="py-3 pr-4 text-gray-700 dark:text-gray-300 font-mono text-xs">
                          {r.server}
                        </td>
                        <td className="py-3 pr-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {formatDate(r.started_at)}
                        </td>
                        <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">
                          {formatDuration(r.total_duration_secs)}
                        </td>
                        <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">
                          {r.databases_processed}
                        </td>
                        <td className="py-3 pr-4 text-blue-600 dark:text-blue-400">
                          {r.total_indexes_rebuilt}
                        </td>
                        <td className="py-3 pr-4 text-purple-600 dark:text-purple-400">
                          {r.total_indexes_reorganized}
                        </td>
                        <td className="py-3 pr-4 text-gray-600 dark:text-gray-400">
                          {r.total_indexes_skipped}
                        </td>
                      </tr>
                      {isExpanded && <ExpandedDetail key={`detail-${r.id}`} record={r} t={t} />}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
