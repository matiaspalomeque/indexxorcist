import { useT } from "../../i18n";
import { useMaintenanceStore } from "../../store/maintenanceStore";
import { useUiStore } from "../../store/uiStore";
import type { DatabaseResult } from "../../types";

function fmt(secs: number): string {
  if (secs < 60) return `${secs.toFixed(1)}s`;
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}m ${s}s`;
}

function DbRow({ r, t }: { r: DatabaseResult; t: ReturnType<typeof useT> }) {
  const statusColor = r.critical_failure
    ? "text-red-500 dark:text-red-400"
    : r.manually_skipped
    ? "text-amber-600 dark:text-amber-400"
    : "text-green-600 dark:text-green-400";

  const statusText = r.critical_failure
    ? t("summary.statusFailed")
    : r.manually_skipped
    ? t("summary.statusSkipped")
    : t("summary.statusDone");

  return (
    <tr className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40">
      <td className="px-4 py-3 text-sm font-mono text-gray-700 dark:text-gray-200">{r.database_name}</td>
      <td className={`px-4 py-3 text-sm font-medium ${statusColor}`}>{statusText}</td>
      <td className="px-4 py-3 text-sm text-blue-500 dark:text-blue-400 text-right">{r.indexes_rebuilt}</td>
      <td className="px-4 py-3 text-sm text-purple-500 dark:text-purple-400 text-right">
        {r.indexes_reorganized}
      </td>
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-400 text-right">{r.indexes_skipped}</td>
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-400 text-right">
        {fmt(r.total_duration_secs)}
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

  const columns = [
    t("summary.colDatabase"),
    t("summary.colStatus"),
    t("summary.colRebuilt"),
    t("summary.colReorganized"),
    t("summary.colSkipped"),
    t("summary.colDuration"),
    t("summary.colErrors"),
  ];

  return (
    <div className="p-4 lg:p-6">
      <div className="mx-auto max-w-[1800px]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t("summary.title")}</h2>
            <p className="text-sm text-gray-700 dark:text-gray-400 mt-0.5">
              {run.profileName} · {run.profileServer}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-500 mt-0.5">
              {t("summary.completedIn", { duration: fmt(run.summary.total_duration_secs) })}
            </p>
          </div>
          <button
            onClick={handleRunAgain}
            className="self-start px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {t("summary.runAgain")}
          </button>
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
                  {columns.map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {run.summary.database_results.map((r) => (
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
