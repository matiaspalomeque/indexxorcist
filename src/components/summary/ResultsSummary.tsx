import { Download, Printer } from "lucide-react";
import { useMemo } from "react";
import { useT } from "../../i18n";
import { useMaintenanceStore } from "../../store/maintenanceStore";
import { useUiStore } from "../../store/uiStore";
import type { DatabaseResult } from "../../types";
import { exportDatabaseResultsToCsv, triggerPrint } from "../../utils/export";
import { dbStatusInfo, formatDuration } from "../../utils/format";
import { sortData, useSortableColumns } from "../../utils/sort";
import { SortableHeader } from "../shared/SortableHeader";

type SummaryCol =
  | "database_name"
  | "status"
  | "indexes_rebuilt"
  | "indexes_reorganized"
  | "indexes_skipped"
  | "total_duration_secs"
  | "errors";

function statusPriority(r: DatabaseResult): number {
  if (r.critical_failure) return 0;
  if (r.interrupted) return 1;
  if (r.manually_skipped) return 2;
  return 3;
}

const SORT_ACCESSORS: Partial<Record<SummaryCol, (r: DatabaseResult) => number | string>> = {
  status: (r) => statusPriority(r),
  errors: (r) => r.errors.length,
};

const TH_CLASS =
  "px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-500 uppercase tracking-wide";

function DbRow({ r, t }: { r: DatabaseResult; t: ReturnType<typeof useT> }) {
  const { labelKey, color } = dbStatusInfo(r);

  return (
    <tr className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40">
      <td className="px-4 py-3 text-sm font-mono text-gray-700 dark:text-gray-200">{r.database_name}</td>
      <td className={`px-4 py-3 text-sm font-medium ${color}`}>{t(`summary.${labelKey}`)}</td>
      <td className="px-4 py-3 text-sm text-blue-500 dark:text-blue-400 text-right">{r.indexes_rebuilt}</td>
      <td className="px-4 py-3 text-sm text-purple-500 dark:text-purple-400 text-right">
        {r.indexes_reorganized}
      </td>
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-400 text-right">{r.indexes_skipped}</td>
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-400 text-right">
        {formatDuration(r.total_duration_secs)}
      </td>
      <td className="px-4 py-3 text-sm text-red-500 dark:text-red-400">{r.errors.length || "—"}</td>
    </tr>
  );
}

export function ResultsSummary() {
  const t = useT();
  const activeProfileId = useUiStore((s) => s.activeProfileId);
  const setView = useUiStore((s) => s.setView);
  const resetProfile = useMaintenanceStore((s) => s.resetProfile);
  const run = useMaintenanceStore((s) =>
    activeProfileId ? s.byProfile[activeProfileId] : undefined
  );
  const { sortConfig, handleSort } = useSortableColumns<SummaryCol>();

  const dbResults = run?.summary?.database_results;
  const sortedResults = useMemo(
    () => (dbResults ? sortData(dbResults, sortConfig, SORT_ACCESSORS) : []),
    [dbResults, sortConfig],
  );

  if (!activeProfileId) {
    return (
      <div className="p-6 text-gray-700 dark:text-gray-400 text-sm">
        {t("summary.noProfile")}
      </div>
    );
  }

  if (!run?.summary) {
    return (
      <div className="p-6 text-gray-700 dark:text-gray-400 text-sm">
        {t("summary.noSummary")}
      </div>
    );
  }

  const handleRunAgain = () => {
    resetProfile(run.profileId);
    setView("databases");
  };

  const handleExportCsv = () => {
    void exportDatabaseResultsToCsv(
      sortedResults,
      `${run.profileName}-${run.profileServer}`,
      t,
    );
  };

  const columnDefs = useMemo((): { key: SummaryCol; label: string }[] => [
    { key: "database_name", label: t("summary.colDatabase") },
    { key: "status", label: t("summary.colStatus") },
    { key: "indexes_rebuilt", label: t("summary.colRebuilt") },
    { key: "indexes_reorganized", label: t("summary.colReorganized") },
    { key: "indexes_skipped", label: t("summary.colSkipped") },
    { key: "total_duration_secs", label: t("summary.colDuration") },
    { key: "errors", label: t("summary.colErrors") },
  ], [t]);

  return (
    <div className="p-4 lg:p-6">
      <div className="mx-auto max-w-[1600px]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t("summary.title")}</h2>
            <p className="text-sm text-gray-700 dark:text-gray-400 mt-0.5">
              {run.profileName} · {run.profileServer}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-500 mt-0.5">
              {t("summary.completedIn", { duration: formatDuration(run.summary.total_duration_secs) })}
            </p>
          </div>
          <div className="flex items-center gap-2 self-start print:hidden">
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Download size={14} />
              {t("summary.exportCsv")}
            </button>
            <button
              onClick={triggerPrint}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Printer size={14} />
              {t("summary.print")}
            </button>
            <button
              onClick={handleRunAgain}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {t("summary.runAgain")}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
          <StatCard label={t("summary.statDatabases")} value={run.summary.databases_processed} color="text-gray-900 dark:text-white" />
          <StatCard label={t("summary.statRebuilt")} value={run.summary.total_indexes_rebuilt} color="text-blue-500 dark:text-blue-400" />
          <StatCard label={t("summary.statReorganized")} value={run.summary.total_indexes_reorganized} color="text-purple-500 dark:text-purple-400" />
          <StatCard label={t("summary.statSkipped")} value={run.summary.total_indexes_skipped} color="text-gray-700 dark:text-gray-400" />
          <StatCard label={t("summary.statFailedDbs")} value={run.summary.databases_failed} color="text-red-500 dark:text-red-400" />
          <StatCard label={t("summary.statSkippedDbs")} value={run.summary.databases_skipped} color="text-amber-600 dark:text-amber-400" />
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px]">
              <thead>
                <tr className="bg-gray-100/60 dark:bg-gray-800/60">
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
                {sortedResults.map((r) => (
                  <DbRow key={r.database_name} r={r} t={t} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
      <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</p>
      <p className="text-xs text-gray-600 dark:text-gray-500 mt-1">{label}</p>
    </div>
  );
}
