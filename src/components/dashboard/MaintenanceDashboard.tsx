import { DatabaseCard } from "./DatabaseCard";
import { OverallProgressBar } from "./OverallProgressBar";
import { RunControls } from "./RunControls";
import { SkeletonCard } from "./SkeletonCard";
import { useT } from "../../i18n";
import { useMaintenanceStore } from "../../store/maintenanceStore";
import { useUiStore } from "../../store/uiStore";

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
    (d) => d.state === "done" || d.state === "error" || d.state === "skipped" || d.state === "stopped"
  ).length;
  
  const runningDbCount = run.databases.filter((d) => d.state === "running").length;
  
  const overallCurrent = run.isParallel
    ? (() => {
        // In parallel mode, count completed DBs + sum of running DB progress
        const runningDbs = run.databases.filter((d) => d.state === "running");
        const runningProgress = runningDbs.reduce((sum, db) => {
          return sum + (db.indexes.length === 0 ? 0 : Math.min(db.indexes_processed / db.indexes.length, 1));
        }, 0);
        return Math.min(doneCount + runningProgress, run.totalDbs);
      })()
    : (() => {
        const runningDb = run.databases.find((d) => d.state === "running");
        const runningDbProgress =
          !runningDb || runningDb.indexes.length === 0
            ? 0
            : Math.min(runningDb.indexes_processed / runningDb.indexes.length, 1);
        return Math.min(doneCount + runningDbProgress, run.totalDbs);
      })();

  return (
    <div className="h-full flex flex-col" role="region" aria-label="Maintenance Dashboard">
      {/* Sticky Header with Progress */}
      {run.totalDbs > 0 && (
        <OverallProgressBar 
          current={overallCurrent} 
          total={run.totalDbs}
          profileName={run.profileName}
          profileServer={run.profileServer}
          runState={run.runState}
          isParallel={run.isParallel}
          runningDbCount={runningDbCount}
          startedAtMs={run.startedAtMs}
        />
      )}

      {/* Screen reader announcements for progress updates */}
      <div 
        role="status" 
        aria-live="polite" 
        aria-atomic="true" 
        className="sr-only"
      >
        {run.runState === "running" && doneCount > 0 && (
          `${doneCount} of ${run.totalDbs} databases completed`
        )}
        {run.runState === "finished" && (
          `Maintenance finished. ${doneCount} databases processed.`
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 lg:p-6 pb-32">
          <div className="mx-auto max-w-[1800px] space-y-5">
            {/* Stats Cards */}
            {run.summary && (
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                <StatCard label={t("dashboard.rebuilt")} value={run.summary.total_indexes_rebuilt} color="text-blue-500" />
                <StatCard label={t("dashboard.reorganized")} value={run.summary.total_indexes_reorganized} color="text-purple-500" />
                <StatCard label={t("dashboard.skipped")} value={run.summary.total_indexes_skipped} color="text-gray-500" />
                <StatCard label={t("dashboard.failedDbs")} value={run.summary.databases_failed} color="text-red-500" />
              </div>
            )}

            {/* Database Grid */}
            {run.databases.length === 0 ? (
              run.runState === "running" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 auto-rows-fr">
                  <SkeletonCard delay={0} />
                  <SkeletonCard delay={100} />
                  <SkeletonCard delay={200} />
                  <SkeletonCard delay={300} />
                </div>
              ) : (
                <div className="flex items-center justify-center py-20 text-gray-600 dark:text-gray-500 text-sm">
                  {t("dashboard.waiting")}
                </div>
              )
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 auto-rows-fr">
                {run.databases.map((db, idx) => (
                  <DatabaseCard key={`${run.profileId}:${db.name}`} db={db} delay={idx * 50} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Footer Controls */}
      <div className="sticky bottom-0 z-30 border-t border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl shadow-2xl">
        <div className="px-4 lg:px-6 py-3">
          <div className="mx-auto max-w-[1800px] flex items-center justify-between gap-3">
            <RunControls profileId={run.profileId} />
            {(run.runState === "finished" || run.runState === "stopped") && run.summary && (
              <button
                onClick={() => setView("summary")}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                {t("dashboard.viewSummary")}
              </button>
            )}
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
