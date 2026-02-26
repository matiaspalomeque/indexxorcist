import { DatabaseCard } from "./DatabaseCard";
import { OverallProgressBar } from "./OverallProgressBar";
import { RunControls } from "./RunControls";
import { useT } from "../../i18n";
import { useMaintenanceStore } from "../../store/maintenanceStore";
import { useUiStore } from "../../store/uiStore";

function runStateColor(runState: string): string {
  if (runState === "running") return "text-blue-400";
  if (runState === "paused") return "text-amber-400";
  if (runState === "finished") return "text-green-400";
  if (runState === "stopped") return "text-red-400";
  return "text-gray-400";
}

export function MaintenanceDashboard() {
  const t = useT();
  const activeProfileId = useUiStore((s) => s.activeProfileId);
  const setView = useUiStore((s) => s.setView);
  const run = useMaintenanceStore((s) =>
    activeProfileId ? s.byProfile[activeProfileId] : undefined
  );

  if (!activeProfileId) {
    return (
      <div className="p-6 text-gray-700 dark:text-gray-400 text-sm">
        {t("dashboard.noProfile")}
      </div>
    );
  }

  if (!run) {
    return (
      <div className="p-6 text-gray-700 dark:text-gray-400 text-sm">
        {t("dashboard.noRun")}
      </div>
    );
  }

  const doneCount = run.databases.filter(
    (d) => d.state === "done" || d.state === "error" || d.state === "skipped"
  ).length;
  const overallCurrent = run.isParallel
    ? doneCount
    : (() => {
        const runningDb = run.databases.find((d) => d.state === "running");
        const runningDbProgress =
          !runningDb || runningDb.indexes.length === 0
            ? 0
            : Math.min(runningDb.indexes_processed / runningDb.indexes.length, 1);
        return Math.min(doneCount + runningDbProgress, run.totalDbs);
      })();

  return (
    <div className="p-4 lg:p-6 pb-28">
      <div className="mx-auto max-w-[1800px] h-full min-h-0 flex flex-col gap-4 lg:gap-5">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t("dashboard.title")}</h2>
          <p className="text-sm text-gray-700 dark:text-gray-400 mt-0.5 truncate">
            {run.profileName} · {run.profileServer}
          </p>
          <p className={`text-sm mt-0.5 ${runStateColor(run.runState)}`}>
            {t(`runState.${run.runState}`)}
          </p>
        </div>

        {run.totalDbs > 0 && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
            <OverallProgressBar current={overallCurrent} total={run.totalDbs} />
          </div>
        )}

        {run.summary && (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <StatCard label={t("dashboard.rebuilt")} value={run.summary.total_indexes_rebuilt} color="text-blue-400" />
            <StatCard label={t("dashboard.reorganized")} value={run.summary.total_indexes_reorganized} color="text-purple-400" />
            <StatCard label={t("dashboard.skipped")} value={run.summary.total_indexes_skipped} color="text-gray-400" />
            <StatCard label={t("dashboard.failedDbs")} value={run.summary.databases_failed} color="text-red-400" />
          </div>
        )}

        {run.databases.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-600 dark:text-gray-500 text-sm">
            {t("dashboard.waiting")}
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto flex-1 min-h-[220px] pr-1">
            {run.databases.map((db) => (
              <DatabaseCard key={`${run.profileId}:${db.name}`} db={db} />
            ))}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 z-30 mt-4 -mx-4 lg:-mx-6 px-4 lg:px-6 pb-2">
        <div className="mx-auto max-w-[1800px]">
          <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-3 lg:px-4 lg:py-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between shadow-2xl">
            <div className="min-w-0">
              <p className="text-xs text-gray-700 dark:text-gray-400 truncate">
                {run.profileName} · {run.profileServer}
              </p>
              <p className={`text-xs ${runStateColor(run.runState)}`}>
                {t(`runState.${run.runState}`)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <RunControls profileId={run.profileId} />
              {(run.runState === "finished" || run.runState === "stopped") && (
                <button
                  onClick={() => setView("summary")}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {t("dashboard.viewSummary")}
                </button>
              )}
            </div>
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
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</p>
      <p className="text-xs text-gray-600 dark:text-gray-500 mt-1">{label}</p>
    </div>
  );
}
