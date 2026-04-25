import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { DatabaseCard } from "./DatabaseCard";
import { IndexDetailDrawer } from "./IndexDetailDrawer";
import { OverallProgressBar } from "./OverallProgressBar";
import { ProgressRing } from "./ProgressRing";
import { RunControls } from "./RunControls";
import { SkeletonCard } from "./SkeletonCard";
import { useT } from "../../i18n";
import * as api from "../../api/tauri";
import { useMaintenanceStore } from "../../store/maintenanceStore";
import { useUiStore } from "../../store/uiStore";
import { computeStaggerMs } from "../../utils/stagger";
import type { DatabaseCardData, IndexDetail } from "../../types";
import {
  AlertCircle,
  CheckCircle2,
  Database,
  FastForward,
  Loader2,
  RefreshCw,
  Search,
  SkipForward,
} from "lucide-react";

export function MaintenanceDashboard() {
  const t = useT();
  const activeProfileId = useUiStore((s) => s.activeProfileId);
  const setView = useUiStore((s) => s.setView);
  const run = useMaintenanceStore((s) =>
    activeProfileId ? s.byProfile[activeProfileId] : undefined
  );
  const setDatabaseState = useMaintenanceStore((s) => s.setDatabaseState);
  // Tracks "running" databases where skip was requested but not yet confirmed by the backend.
  // We don't do an optimistic state change for running databases because they may be
  // mid-SQL-operation — inflating doneCount to 100% while the backend is still working
  // is misleading. Queued databases are updated optimistically since they complete instantly.
  const [pendingSkips, setPendingSkips] = useState<Set<string>>(new Set());

  // Clear stale entries when databases leave "running" state (e.g. backend confirmed the skip).
  const databases = run?.databases;
  useEffect(() => {
    if (!databases) return;
    setPendingSkips((prev) => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Set(prev);
      for (const name of prev) {
        const db = databases.find((d) => d.name === name);
        if (db && db.state !== "running") {
          next.delete(name);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [databases]);

  const handleSkip = useCallback(async (dbName: string) => {
    if (!activeProfileId) return;
    const db = useMaintenanceStore.getState().byProfile[activeProfileId]
      ?.databases.find((d) => d.name === dbName);

    if (db?.state === "queued") {
      // Queued databases complete almost instantly once spawned — optimistic update is accurate.
      setDatabaseState(activeProfileId, dbName, "skipped");
    } else {
      // Running databases are mid-SQL-operation. Just disable the button and wait for
      // maintenance:db-complete to confirm the skip rather than jumping to 100% prematurely.
      setPendingSkips((prev) => new Set(prev).add(dbName));
    }

    try {
      await api.skipDatabase(activeProfileId, dbName);
    } catch (error) {
      // Roll back on IPC failure
      if (db?.state === "queued") {
        const currentDb = useMaintenanceStore.getState().byProfile[activeProfileId]
          ?.databases.find((d) => d.name === dbName);
        if (currentDb?.state === "skipped") {
          setDatabaseState(activeProfileId, dbName, "queued");
        }
      } else {
        setPendingSkips((prev) => { const s = new Set(prev); s.delete(dbName); return s; });
      }
      console.error(`Failed to skip ${dbName}:`, error);
    }
  }, [activeProfileId, setDatabaseState]);

  const isParallel = run?.isParallel ?? false;
  const totalDbs = run?.totalDbs ?? 0;

  const runMetrics = useMemo(() => {
    const empty = {
      doneCount: 0,
      runningDbs: [] as DatabaseCardData[],
      queuedDbs: [] as DatabaseCardData[],
      completedDbs: [] as DatabaseCardData[],
      failedDbs: [] as DatabaseCardData[],
      activeIndexesProcessed: 0,
      activeIndexesTotal: 0,
      totalIndexesRebuilt: 0,
      totalIndexesReorganized: 0,
      totalIndexesSkipped: 0,
    };
    if (!databases) return empty;
    let done = 0;
    let activeIndexesProcessed = 0;
    let activeIndexesTotal = 0;
    let totalIndexesRebuilt = 0;
    let totalIndexesReorganized = 0;
    let totalIndexesSkipped = 0;
    const running: DatabaseCardData[] = [];
    const queued: DatabaseCardData[] = [];
    const completed: DatabaseCardData[] = [];
    const failed: DatabaseCardData[] = [];
    for (const db of databases) {
      totalIndexesRebuilt += db.indexes_rebuilt;
      totalIndexesReorganized += db.indexes_reorganized;
      totalIndexesSkipped += db.indexes_skipped;
      if (db.state === "done" || db.state === "error" || db.state === "skipped" || db.state === "stopped") {
        done++;
      }
      if (db.state === "running") {
        running.push(db);
        activeIndexesProcessed += Math.min(db.indexes_processed, db.indexes.length);
        activeIndexesTotal += db.indexes.length;
      } else if (db.state === "queued") {
        queued.push(db);
      } else if (db.state === "error") {
        failed.push(db);
      } else {
        completed.push(db);
      }
    }
    return {
      doneCount: done,
      runningDbs: running,
      queuedDbs: queued,
      completedDbs: completed,
      failedDbs: failed,
      activeIndexesProcessed,
      activeIndexesTotal,
      totalIndexesRebuilt,
      totalIndexesReorganized,
      totalIndexesSkipped,
    };
  }, [databases]);

  const overallCurrent = useMemo(() => {
    const dbProgress = (db: { indexes: unknown[]; indexes_processed: number }) =>
      db.indexes.length === 0 ? 0 : Math.min(db.indexes_processed / db.indexes.length, 1);
    const runningProgress = isParallel
      ? runMetrics.runningDbs.reduce((sum, db) => sum + dbProgress(db), 0)
      : dbProgress(runMetrics.runningDbs[0] ?? { indexes: [], indexes_processed: 0 });
    return Math.min(runMetrics.doneCount + runningProgress, totalDbs);
  }, [runMetrics.doneCount, runMetrics.runningDbs, isParallel, totalDbs]);

  const staggerMs = useMemo(
    () => computeStaggerMs(databases?.length ?? 0),
    [databases?.length],
  );

  const liveSummary = useMemo(() => ({
    rebuilt: run?.summary?.total_indexes_rebuilt ?? runMetrics.totalIndexesRebuilt,
    reorganized: run?.summary?.total_indexes_reorganized ?? runMetrics.totalIndexesReorganized,
    skipped: run?.summary?.total_indexes_skipped ?? runMetrics.totalIndexesSkipped,
    failedDbs: run?.summary?.databases_failed ?? runMetrics.failedDbs.length,
  }), [
    run?.summary,
    runMetrics.failedDbs.length,
    runMetrics.totalIndexesRebuilt,
    runMetrics.totalIndexesReorganized,
    runMetrics.totalIndexesSkipped,
  ]);

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
          startedAtMs={run.startedAtMs}
          activeIndexesProcessed={runMetrics.activeIndexesProcessed}
          activeIndexesTotal={runMetrics.activeIndexesTotal}
          runningDatabaseCount={runMetrics.runningDbs.length}
          queuedDatabaseCount={runMetrics.queuedDbs.length}
        />
      )}

      {/* Screen reader announcements for progress updates */}
      <div 
        role="status" 
        aria-live="polite" 
        aria-atomic="true" 
        className="sr-only"
      >
        {run.runState === "running" && runMetrics.doneCount > 0 && (
          `${runMetrics.doneCount} of ${run.totalDbs} databases completed`
        )}
        {run.runState === "finished" && (
          `Maintenance finished. ${runMetrics.doneCount} databases processed.`
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 lg:p-6 pb-32">
          <div className="mx-auto max-w-[1800px] space-y-5">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <StatCard label={t("dashboard.rebuilt")} value={liveSummary.rebuilt} color="text-blue-600 dark:text-blue-400" />
              <StatCard label={t("dashboard.reorganized")} value={liveSummary.reorganized} color="text-purple-600 dark:text-purple-400" />
              <StatCard label={t("dashboard.skipped")} value={liveSummary.skipped} color="text-gray-700 dark:text-gray-300" />
              <StatCard label={t("dashboard.failedDbs")} value={liveSummary.failedDbs} color="text-red-600 dark:text-red-400" />
            </div>

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
              run.runState === "running" || run.runState === "paused" ? (
                <div className="space-y-6">
                  {runMetrics.runningDbs.length > 0 ? (
                    <DatabaseSection
                      title={t("dashboard.activeWork")}
                      count={runMetrics.runningDbs.length}
                      description={run.isParallel ? t("dashboard.parallelActiveHint") : t("dashboard.serialActiveHint")}
                    >
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {runMetrics.runningDbs.map((db) => (
                          <ActiveDatabasePanel
                            key={`${run.profileId}:active:${db.name}`}
                            db={db}
                            onSkip={!pendingSkips.has(db.name) ? handleSkip : undefined}
                            skipPending={pendingSkips.has(db.name)}
                          />
                        ))}
                      </div>
                    </DatabaseSection>
                  ) : (
                    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-5 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
                      {t("dashboard.waitingForActiveDb")}
                    </div>
                  )}

                  {runMetrics.queuedDbs.length > 0 && (
                    <DatabaseSection
                      title={t("dashboard.queuedWork")}
                      count={runMetrics.queuedDbs.length}
                      description={t("dashboard.queuedHint")}
                    >
                      <DatabaseCardGrid>
                        {runMetrics.queuedDbs.map((db, idx) => (
                          <DatabaseCard
                            key={`${run.profileId}:queued:${db.name}`}
                            db={db}
                            delay={Math.round(idx * staggerMs)}
                            onSkip={!pendingSkips.has(db.name) ? handleSkip : undefined}
                            skipPending={false}
                          />
                        ))}
                      </DatabaseCardGrid>
                    </DatabaseSection>
                  )}

                  {runMetrics.failedDbs.length > 0 && (
                    <DatabaseSection
                      title={t("dashboard.failedWork")}
                      count={runMetrics.failedDbs.length}
                      description={t("dashboard.failedHint")}
                    >
                      <DatabaseCardGrid>
                        {runMetrics.failedDbs.map((db, idx) => (
                          <DatabaseCard
                            key={`${run.profileId}:failed:${db.name}`}
                            db={db}
                            delay={Math.round(idx * staggerMs)}
                          />
                        ))}
                      </DatabaseCardGrid>
                    </DatabaseSection>
                  )}

                  {runMetrics.completedDbs.length > 0 && (
                    <DatabaseSection
                      title={t("dashboard.completedWork")}
                      count={runMetrics.completedDbs.length}
                      description={t("dashboard.completedHint")}
                    >
                      <DatabaseCardGrid>
                        {runMetrics.completedDbs.map((db, idx) => (
                          <DatabaseCard
                            key={`${run.profileId}:completed:${db.name}`}
                            db={db}
                            delay={Math.round(idx * staggerMs)}
                          />
                        ))}
                      </DatabaseCardGrid>
                    </DatabaseSection>
                  )}
                </div>
              ) : (
                <DatabaseCardGrid>
                  {run.databases.map((db, idx) => (
                    <DatabaseCard
                      key={`${run.profileId}:${db.name}`}
                      db={db}
                      delay={Math.round(idx * staggerMs)}
                    />
                  ))}
                </DatabaseCardGrid>
              )
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

function DatabaseCardGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 auto-rows-fr">
      {children}
    </div>
  );
}

function DatabaseSection({
  title,
  count,
  description,
  children,
}: {
  title: string;
  count: number;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            {title}
            <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {count}
            </span>
          </h2>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-500">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function ActiveDatabasePanel({
  db,
  onSkip,
  skipPending,
}: {
  db: DatabaseCardData;
  onSkip?: (dbName: string) => void;
  skipPending: boolean;
}) {
  const t = useT();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const totalIndexes = db.indexes.length;
  const processed = Math.min(db.indexes_processed, totalIndexes);
  const activeIndex = getActiveIndex(db);
  const isDiscovering = totalIndexes === 0;
  const latestError = db.errors[0] ?? activeIndex?.error;
  const progressTotal = isDiscovering ? 1 : totalIndexes;
  const progressProcessed = isDiscovering ? 0 : processed;

  return (
    <div className="rounded-lg border border-blue-300 bg-white p-4 shadow-sm dark:border-blue-900/80 dark:bg-gray-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-md border border-blue-200 bg-blue-50 p-2 dark:border-blue-900 dark:bg-blue-950/40">
            <Database className="h-4 w-4 text-blue-700 dark:text-blue-300" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                {db.name}
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t("dbState.running")}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              {isDiscovering
                ? t("dashboard.discoveringIndexes")
                : t("dashboard.indexProgress", { current: processed, total: totalIndexes })}
            </p>
          </div>
        </div>
        <ProgressRing
          processed={progressProcessed}
          total={progressTotal}
          size={52}
          strokeWidth={5}
          colorScheme="blue"
          showPercentage={!isDiscovering}
        />
      </div>

      <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-500">
              {t("dashboard.currentIndex")}
            </p>
            {activeIndex ? (
              <div className="mt-1 min-w-0">
                <p className="truncate font-mono text-sm text-gray-900 dark:text-gray-100">
                  {activeIndex.schema_name}.{activeIndex.table_name}
                </p>
                <p className="truncate font-mono text-xs text-gray-600 dark:text-gray-400">
                  {activeIndex.index_name}
                </p>
              </div>
            ) : (
              <div className="mt-1 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Search className="h-4 w-4" />
                {t("dashboard.discoveringIndexes")}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {activeIndex?.action && (
              <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
                {activeIndex.action}
              </span>
            )}
            {activeIndex && (
              <span className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 dark:border-gray-800 dark:text-gray-300">
                {t("dashboard.fragmentationShort", { value: activeIndex.fragmentation_percent.toFixed(1) })}
              </span>
            )}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {t("dashboard.details")}
            </button>
            <button
              type="button"
              onClick={() => onSkip?.(db.name)}
              disabled={skipPending || !onSkip}
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400 dark:border-amber-700 dark:bg-gray-950 dark:text-amber-300 dark:hover:bg-amber-950/30 dark:disabled:border-gray-700 dark:disabled:text-gray-600"
            >
              {skipPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SkipForward className="h-3.5 w-3.5" />}
              {skipPending ? t("controls.skipping") : t("controls.skipDb")}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3 text-xs dark:border-gray-800">
        <ActiveMetric icon={<CheckCircle2 className="h-3.5 w-3.5" />} label={t("dbCard.rebuilt")} value={db.indexes_rebuilt} tone="text-blue-600 dark:text-blue-400" />
        <ActiveMetric icon={<RefreshCw className="h-3.5 w-3.5" />} label={t("dbCard.reorganized")} value={db.indexes_reorganized} tone="text-purple-600 dark:text-purple-400" />
        <ActiveMetric icon={<FastForward className="h-3.5 w-3.5" />} label={t("dbCard.skipped")} value={db.indexes_skipped} tone="text-gray-700 dark:text-gray-300" />
      </div>

      {latestError && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/70 dark:bg-red-950/20 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <p className="line-clamp-2">{latestError}</p>
        </div>
      )}

      {drawerOpen && (
        <IndexDetailDrawer db={db} onClose={() => setDrawerOpen(false)} />
      )}
    </div>
  );
}

function ActiveMetric({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className={tone}>{icon}</span>
      <span className={`font-semibold ${tone}`}>{value}</span>
      <span className="truncate text-gray-600 dark:text-gray-500">{label}</span>
    </div>
  );
}

function getActiveIndex(db: DatabaseCardData): IndexDetail | undefined {
  const processing = db.indexes.find((idx) => idx.status === "processing");
  if (processing) return processing;
  const pending = db.indexes.find((idx) => idx.status === "pending");
  if (pending) return pending;
  for (let i = db.indexes.length - 1; i >= 0; i--) {
    const idx = db.indexes[i]!;
    if (idx.status === "done" || idx.status === "error" || idx.status === "skipped") return idx;
  }
  return undefined;
}

const StatCard = memo(function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 text-center shadow-sm">
      <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</p>
      <p className="text-xs text-gray-600 dark:text-gray-500 mt-1">{label}</p>
    </div>
  );
});
