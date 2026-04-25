import { memo, useState } from "react";
import { ProgressRing } from "./ProgressRing";
import { IndexDetailDrawer } from "./IndexDetailDrawer";
import { useT } from "../../i18n";
import {
  Database,
  CheckCircle2,
  RefreshCw,
  FastForward,
  Clock,
  AlertCircle,
  Loader2,
  Square,
  SkipForward,
} from "lucide-react";
import type { DatabaseCardData, DatabaseCardState } from "../../types";

interface Props {
  db: DatabaseCardData;
  delay?: number;
  onSkip?: (dbName: string) => void;
  skipPending?: boolean;
}

const BORDER: Record<DatabaseCardState, string> = {
  queued: "border-gray-200 dark:border-gray-800",
  running: "border-blue-300 dark:border-blue-800",
  done: "border-green-200 dark:border-green-900/70",
  error: "border-red-300 dark:border-red-900/80",
  skipped: "border-amber-300 dark:border-amber-900/70",
  stopped: "border-orange-300 dark:border-orange-900/70",
};

const BG: Record<DatabaseCardState, string> = {
  queued: "bg-white dark:bg-gray-900",
  running: "bg-blue-50 dark:bg-blue-950/20",
  done: "bg-white dark:bg-gray-900",
  error: "bg-red-50 dark:bg-red-950/20",
  skipped: "bg-amber-50 dark:bg-amber-950/20",
  stopped: "bg-orange-50 dark:bg-orange-950/20",
};

const STATE_COLOR: Record<DatabaseCardState, string> = {
  queued: "text-gray-600 dark:text-gray-400",
  running: "text-blue-600 dark:text-blue-400",
  done: "text-green-600 dark:text-green-400",
  error: "text-red-600 dark:text-red-400",
  skipped: "text-amber-600 dark:text-amber-400",
  stopped: "text-orange-600 dark:text-orange-400",
};

const RING_COLOR: Record<DatabaseCardState, 'blue' | 'green' | 'amber' | 'red' | 'gray' | 'orange'> = {
  queued: "gray",
  running: "blue",
  done: "green",
  error: "red",
  skipped: "amber",
  stopped: "orange",
};

const STATE_ICON: Record<DatabaseCardState, typeof CheckCircle2 | typeof Loader2 | typeof AlertCircle | typeof FastForward | typeof Square | null> = {
  queued: null,
  running: Loader2,
  done: CheckCircle2,
  error: AlertCircle,
  skipped: FastForward,
  stopped: Square,
};

function fmt(n: number) {
  return n.toFixed(1);
}

function DatabaseCardComponent({ db, delay = 0, onSkip, skipPending = false }: Props) {
  const t = useT();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const totalIndexes = db.indexes.length;
  const processed = Math.min(db.indexes_processed, totalIndexes);
  const completedWithoutIndexes =
    totalIndexes === 0 &&
    (db.state === "done" || db.state === "error" || db.state === "skipped");
  const ringTotal = completedWithoutIndexes ? 1 : totalIndexes;
  const ringProcessed = completedWithoutIndexes ? 1 : processed;
  const StateIcon = STATE_ICON[db.state];
  const hasSkipControl = Boolean((db.state === "running" || db.state === "queued") && (onSkip || skipPending));

  return (
    <div className={`relative h-full rounded-lg border ${BORDER[db.state]} ${BG[db.state]} shadow-sm transition-colors`}>
      <button
        onClick={() => setDrawerOpen(true)}
        className={`group relative w-full h-full text-left rounded-lg p-4 ${hasSkipControl ? "pb-14" : ""} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950 hover:bg-black/[0.015] dark:hover:bg-white/[0.03]`}
        style={{
          animation: `fadeInUp 0.4s ease-out ${delay}ms backwards`,
        }}
      >
        {/* Error Badge */}
        {db.errors.length > 0 && (
          <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-xs font-bold shadow-lg ring-2 ring-white dark:ring-gray-900 animate-pulse">
            {db.errors.length}
          </div>
        )}

        {/* Header Section */}
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex-shrink-0 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-2">
            <Database className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate">
              {db.name}
            </h3>
            <div className="mt-1 flex items-center gap-2">
              {StateIcon && (
                <StateIcon 
                  className={`w-3.5 h-3.5 ${STATE_COLOR[db.state]} ${
                    db.state === 'running' ? 'animate-spin' : ''
                  }`} 
                />
              )}
              <span className={`text-sm font-medium ${STATE_COLOR[db.state]}`}>
                {t(`dbState.${db.state}`)}
              </span>
            </div>
          </div>
          <ProgressRing 
            processed={ringProcessed} 
            total={ringTotal} 
            size={44} 
            strokeWidth={4}
            colorScheme={RING_COLOR[db.state]}
            showPercentage={true}
          />
        </div>

        {/* Progress Section */}
        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs dark:border-gray-800">
          <span className="font-medium text-gray-900 dark:text-white">
            {processed} / {totalIndexes}
          </span>
          <span className="text-gray-600 dark:text-gray-400">
            {t("dbCard.indexes")}
          </span>
        </div>

        {/* Stats Row */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="flex min-w-0 items-center gap-1.5 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 flex-shrink-0" />
            <span className="text-blue-600 dark:text-blue-400 font-medium">
              {db.indexes_rebuilt}
            </span>
            <span className="text-gray-600 dark:text-gray-500 truncate">
              {t("dbCard.rebuilt")}
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400 flex-shrink-0" />
            <span className="text-purple-600 dark:text-purple-400 font-medium">
              {db.indexes_reorganized}
            </span>
            <span className="text-gray-600 dark:text-gray-500 truncate">
              {t("dbCard.reorganized")}
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-1.5 text-xs">
            <FastForward className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
            <span className="text-gray-600 dark:text-gray-400 font-medium">
              {db.indexes_skipped}
            </span>
            <span className="text-gray-600 dark:text-gray-500 truncate">
              {t("dbCard.skipped")}
            </span>
          </div>
        </div>

        {/* Duration Footer */}
        {db.duration_secs > 0 && (
          <div className="mt-3 flex items-center gap-1.5 border-t border-gray-100 pt-3 dark:border-gray-800">
            <Clock className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {fmt(db.duration_secs)}s
            </span>
          </div>
        )}
      </button>

      {hasSkipControl && (
        <button
          onClick={() => onSkip?.(db.name)}
          disabled={skipPending}
          aria-label={t("controls.skipDb")}
          className={`absolute bottom-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors border ${
            skipPending
              ? "bg-white/70 dark:bg-gray-800/70 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed"
              : "bg-white dark:bg-gray-900 border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40"
          }`}
        >
          {skipPending ? <Loader2 size={12} className="animate-spin" /> : <SkipForward size={12} />}
          {t("controls.skipDb")}
        </button>
      )}

      {drawerOpen && (
        <IndexDetailDrawer db={db} onClose={() => setDrawerOpen(false)} />
      )}
    </div>
  );
}

export const DatabaseCard = memo(DatabaseCardComponent, (prev, next) =>
  prev.db === next.db &&
  prev.delay === next.delay &&
  prev.skipPending === next.skipPending &&
  prev.onSkip === next.onSkip
);
