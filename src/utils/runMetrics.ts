import type { DatabaseCardData, MaintenanceSummary } from "../types";

export interface RunMetrics {
  doneCount: number;
  runningDbs: DatabaseCardData[];
  queuedDbs: DatabaseCardData[];
  completedDbs: DatabaseCardData[];
  failedDbs: DatabaseCardData[];
  activeIndexesProcessed: number;
  activeIndexesTotal: number;
  totalIndexesRebuilt: number;
  totalIndexesReorganized: number;
  totalIndexesSkipped: number;
}

export interface LiveSummaryMetrics {
  rebuilt: number;
  reorganized: number;
  skipped: number;
  failedDbs: number;
}

const EMPTY_METRICS: RunMetrics = {
  doneCount: 0,
  runningDbs: [],
  queuedDbs: [],
  completedDbs: [],
  failedDbs: [],
  activeIndexesProcessed: 0,
  activeIndexesTotal: 0,
  totalIndexesRebuilt: 0,
  totalIndexesReorganized: 0,
  totalIndexesSkipped: 0,
};

function isTerminalState(state: DatabaseCardData["state"]): boolean {
  return state === "done" || state === "error" || state === "skipped" || state === "stopped";
}

function dbProgress(db: Pick<DatabaseCardData, "indexes" | "indexes_processed">): number {
  return db.indexes.length === 0 ? 0 : Math.min(db.indexes_processed / db.indexes.length, 1);
}

export function computeRunMetrics(databases: readonly DatabaseCardData[] | undefined): RunMetrics {
  if (!databases) return EMPTY_METRICS;

  const metrics: RunMetrics = {
    doneCount: 0,
    runningDbs: [],
    queuedDbs: [],
    completedDbs: [],
    failedDbs: [],
    activeIndexesProcessed: 0,
    activeIndexesTotal: 0,
    totalIndexesRebuilt: 0,
    totalIndexesReorganized: 0,
    totalIndexesSkipped: 0,
  };

  for (const db of databases) {
    metrics.totalIndexesRebuilt += db.indexes_rebuilt;
    metrics.totalIndexesReorganized += db.indexes_reorganized;
    metrics.totalIndexesSkipped += db.indexes_skipped;

    if (isTerminalState(db.state)) {
      metrics.doneCount++;
    }

    if (db.state === "running") {
      metrics.runningDbs.push(db);
      metrics.activeIndexesProcessed += Math.min(db.indexes_processed, db.indexes.length);
      metrics.activeIndexesTotal += db.indexes.length;
    } else if (db.state === "queued") {
      metrics.queuedDbs.push(db);
    } else if (db.state === "error") {
      metrics.failedDbs.push(db);
    } else {
      metrics.completedDbs.push(db);
    }
  }

  return metrics;
}

export function computeOverallProgress(
  metrics: RunMetrics,
  totalDbs: number,
  isParallel: boolean,
): number {
  const runningProgress = isParallel
    ? metrics.runningDbs.reduce((sum, db) => sum + dbProgress(db), 0)
    : dbProgress(metrics.runningDbs[0] ?? { indexes: [], indexes_processed: 0 });

  return Math.min(metrics.doneCount + runningProgress, totalDbs);
}

export function computeLiveSummary(
  summary: MaintenanceSummary | null | undefined,
  metrics: RunMetrics,
): LiveSummaryMetrics {
  return {
    rebuilt: summary?.total_indexes_rebuilt ?? metrics.totalIndexesRebuilt,
    reorganized: summary?.total_indexes_reorganized ?? metrics.totalIndexesReorganized,
    skipped: summary?.total_indexes_skipped ?? metrics.totalIndexesSkipped,
    failedDbs: summary?.databases_failed ?? metrics.failedDbs.length,
  };
}
