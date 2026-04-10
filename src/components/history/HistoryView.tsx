import { ChevronDown, ChevronRight, Download, Search, Trash2 } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useT } from "../../i18n";
import { useHistoryStore } from "../../store/historyStore";
import type { RunRecord } from "../../types";
import { exportRunRecordsToCsv } from "../../utils/export";
import { EMPTY_FILTERS, filterRecords, type HistoryFilters } from "../../utils/filter";
import { dbStatusInfo, formatDuration, indexStatusInfo } from "../../utils/format";
import { sortData, useSortableColumns } from "../../utils/sort";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { Select } from "../shared/Select";
import { SortableHeader } from "../shared/SortableHeader";

const INITIAL_HISTORY_LIMIT = 100;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

const COL_COUNT = 9;

const TH_CLASS =
  "text-left py-2 pr-4 text-xs font-medium text-gray-600 dark:text-gray-500 uppercase tracking-wide whitespace-nowrap";

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
            const { labelKey, color } = dbStatusInfo(db);
            const status = { text: t(`history.${labelKey}`), color };
            return (
              <div key={db.database_name} className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
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

                {db.errors.length > 0 && (
                  <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 bg-red-50/50 dark:bg-red-900/10">
                    {db.errors.map((err, i) => (
                      <p key={i} className="text-xs text-red-600 dark:text-red-400 font-mono">{err}</p>
                    ))}
                  </div>
                )}

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
                          const { labelKey: idxLabelKey, color: idxColor } = indexStatusInfo(idx);
                          return (
                            <tr key={`${idx.schema_name}.${idx.table_name}.${idx.index_name}`} className="border-t border-gray-100 dark:border-gray-800/40">
                              <td className="px-4 py-1.5 font-mono text-gray-700 dark:text-gray-300">{idx.index_name}</td>
                              <td className="px-4 py-1.5 text-gray-600 dark:text-gray-400">{idx.schema_name}.{idx.table_name}</td>
                              <td className="px-4 py-1.5 text-right text-gray-600 dark:text-gray-400">{idx.fragmentation_percent.toFixed(1)}%</td>
                              <td className="px-4 py-1.5 text-gray-600 dark:text-gray-400">{idx.action}</td>
                              <td className={`px-4 py-1.5 font-medium ${idxColor}`}>{t(`history.${idxLabelKey}`)}</td>
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

type HistoryCol =
  | "profile_name"
  | "server"
  | "started_at"
  | "total_duration_secs"
  | "databases_processed"
  | "total_indexes_rebuilt"
  | "total_indexes_reorganized"
  | "total_indexes_skipped";

// ISO 8601 strings sort lexicographically — no need to parse into Date objects
const HISTORY_SORT_ACCESSORS: Partial<Record<HistoryCol, (r: RunRecord) => number | string>> = {
  started_at: (r) => r.started_at,
};

export function HistoryView() {
  const t = useT();
  const { records, loading, error, loadHistory, clearHistory } = useHistoryStore();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filters, setFilters] = useState<HistoryFilters>(EMPTY_FILTERS);
  const { sortConfig, handleSort } = useSortableColumns<HistoryCol>();

  useEffect(() => {
    void loadHistory(undefined, INITIAL_HISTORY_LIMIT);
  }, [loadHistory]);

  const filteredRecords = useMemo(
    () => filterRecords(records, filters),
    [records, filters],
  );

  const sortedRecords = useMemo(
    () => sortData(filteredRecords, sortConfig, HISTORY_SORT_ACCESSORS),
    [filteredRecords, sortConfig],
  );

  const handleClear = async () => {
    setShowClearConfirm(false);
    await clearHistory();
  };

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const updateFilter = <K extends keyof HistoryFilters>(key: K, value: HistoryFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const hasActiveFilters =
    filters.search !== "" || filters.dateFrom !== "" || filters.dateTo !== "" || filters.status !== "all";

  const columnDefs = useMemo((): { key: HistoryCol; label: string }[] => [
    { key: "profile_name", label: t("history.colProfile") },
    { key: "server", label: t("history.colServer") },
    { key: "started_at", label: t("history.colStarted") },
    { key: "total_duration_secs", label: t("history.colDuration") },
    { key: "databases_processed", label: t("history.colDbs") },
    { key: "total_indexes_rebuilt", label: t("history.colRebuilt") },
    { key: "total_indexes_reorganized", label: t("history.colReorganized") },
    { key: "total_indexes_skipped", label: t("history.colSkipped") },
  ], [t]);

  return (
    <div className="p-4 lg:p-6">
      <div className="mx-auto max-w-[1800px]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t("history.title")}
          </h2>
          {records.length > 0 && (
            <div className="flex items-center gap-2 print:hidden">
              <button
                onClick={() => void exportRunRecordsToCsv(sortedRecords, t)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Download size={14} />
                {t("history.exportCsv")}
              </button>
              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40"
              >
                <Trash2 size={14} />
                {t("history.clearAll")}
              </button>
            </div>
          )}
        </div>

        {records.length > 0 && (
          <div className="flex flex-wrap items-end gap-3 mb-4 print:hidden">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => updateFilter("search", e.target.value)}
                placeholder={t("history.searchPlaceholder")}
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500 dark:text-gray-400">{t("history.dateFrom")}</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => updateFilter("dateFrom", e.target.value)}
                className="px-2 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500 dark:text-gray-400">{t("history.dateTo")}</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => updateFilter("dateTo", e.target.value)}
                className="px-2 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            <Select<HistoryFilters["status"]>
              value={filters.status}
              onChange={(v) => updateFilter("status", v)}
              aria-label={t("history.statusFilterLabel")}
              className="min-w-[140px]"
              options={[
                { value: "all", label: t("history.statusAll") },
                { value: "hasErrors", label: t("history.statusHasErrors") },
                { value: "allSuccess", label: t("history.statusAllSuccess") },
              ]}
            />
            {hasActiveFilters && (
              <button
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                {t("databases.filterClear")}
              </button>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
        )}

        {loading ? (
          <p className="text-sm text-gray-600 dark:text-gray-500">{t("history.loading")}</p>
        ) : records.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-500">{t("history.noRuns")}</p>
        ) : sortedRecords.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-500">{t("history.noFilterResults")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="w-8" />
                  {columnDefs.map((col) => (
                    <SortableHeader
                      key={col.key}
                      label={col.label}
                      sortKey={col.key}
                      sortConfig={sortConfig}
                      onSort={handleSort}
                      className={TH_CLASS}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRecords.map((r) => {
                  const isExpanded = expandedId === r.id;
                  const hasDetails = r.database_results && r.database_results.length > 0;
                  return (
                    <Fragment key={r.id}>
                      <tr
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
                        <td className="py-3 pr-4 text-gray-700 dark:text-gray-300 whitespace-nowrap text-xs">
                          {formatDate(r.started_at)}
                        </td>
                        <td className="py-3 pr-4 text-gray-700 dark:text-gray-300 text-xs">
                          {formatDuration(r.total_duration_secs)}
                        </td>
                        <td className="py-3 pr-4 text-gray-700 dark:text-gray-300 text-xs">
                          {r.databases_processed}
                        </td>
                        <td className="py-3 pr-4 text-blue-600 dark:text-blue-400 text-xs">
                          {r.total_indexes_rebuilt}
                        </td>
                        <td className="py-3 pr-4 text-purple-600 dark:text-purple-400 text-xs">
                          {r.total_indexes_reorganized}
                        </td>
                        <td className="py-3 pr-4 text-gray-600 dark:text-gray-400 text-xs">
                          {r.total_indexes_skipped}
                        </td>
                      </tr>
                      {isExpanded && <ExpandedDetail key={`detail-${r.id}`} record={r} t={t} />}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showClearConfirm && (
        <ConfirmDialog
          title={t("confirm.clearHistoryTitle")}
          message={t("confirm.clearHistoryMessage")}
          confirmLabel={t("confirm.clearHistoryConfirm")}
          cancelLabel={t("confirm.cancel")}
          variant="danger"
          onConfirm={() => void handleClear()}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
    </div>
  );
}
