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
  Square
} from "lucide-react";
import type { DatabaseCardData, DatabaseCardState } from "../../types";

interface Props {
  db: DatabaseCardData;
  delay?: number;
}

const BORDER: Record<DatabaseCardState, string> = {
  queued: "border-gray-300 dark:border-gray-600",
  running: "border-blue-500 ring-2 ring-blue-500/20",
  done: "border-green-500",
  error: "border-red-500 ring-2 ring-red-500/20",
  skipped: "border-amber-500",
  stopped: "border-orange-500",
};

const BG: Record<DatabaseCardState, string> = {
  queued: "bg-white dark:bg-gray-900",
  running: "bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20",
  done: "bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/10",
  error: "bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/10",
  skipped: "bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10",
  stopped: "bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/20 dark:to-orange-900/10",
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

function DatabaseCardComponent({ db, delay = 0 }: Props) {
  const t = useT();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const totalIndexes = db.indexes.length;
  const processed = db.indexes_processed;
  const completedWithoutIndexes =
    totalIndexes === 0 &&
    (db.state === "done" || db.state === "error" || db.state === "skipped");
  const ringTotal = completedWithoutIndexes ? 1 : totalIndexes;
  const ringProcessed = completedWithoutIndexes ? 1 : processed;
  const StateIcon = STATE_ICON[db.state];

  return (
    <>
      <button
        onClick={() => setDrawerOpen(true)}
        className={`group relative w-full text-left border-2 rounded-xl p-6 transition-all duration-300 transform-gpu ${
          BORDER[db.state]
        } ${BG[db.state]} hover:scale-[1.02] hover:shadow-xl focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 shadow-lg`}
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
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0">
            <div className="p-2 bg-white/80 dark:bg-gray-800/80 rounded-lg shadow-sm">
              <Database className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white truncate mb-1">
              {db.name}
            </h3>
            <div className="flex items-center gap-2">
              {StateIcon && (
                <StateIcon 
                  className={`w-4 h-4 ${STATE_COLOR[db.state]} ${
                    db.state === 'running' ? 'animate-spin' : ''
                  }`} 
                />
              )}
              <span className={`text-sm font-medium ${STATE_COLOR[db.state]}`}>
                {t(`dbState.${db.state}`)}
              </span>
            </div>
          </div>
        </div>

        {/* Progress Section */}
        <div className="flex items-center justify-center mb-4">
          <div className="flex flex-col items-center gap-2">
            <ProgressRing 
              processed={ringProcessed} 
              total={ringTotal} 
              size={72} 
              strokeWidth={6}
              colorScheme={RING_COLOR[db.state]}
              showPercentage={true}
            />
            <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">
              {processed} / {totalIndexes} {t("dbCard.indexes")}
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="flex items-center gap-1.5 text-xs">
            <CheckCircle2 className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
            <span className="text-blue-600 dark:text-blue-400 font-medium">
              {db.indexes_rebuilt}
            </span>
            <span className="text-gray-600 dark:text-gray-500 truncate">
              {t("dbCard.rebuilt")}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <RefreshCw className="w-4 h-4 text-purple-500 dark:text-purple-400 flex-shrink-0" />
            <span className="text-purple-600 dark:text-purple-400 font-medium">
              {db.indexes_reorganized}
            </span>
            <span className="text-gray-600 dark:text-gray-500 truncate">
              {t("dbCard.reorganized")}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <FastForward className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
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
          <div className="flex items-center gap-1.5 pt-3 border-t border-gray-200 dark:border-gray-700">
            <Clock className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {fmt(db.duration_secs)}s
            </span>
          </div>
        )}
      </button>

      {drawerOpen && (
        <IndexDetailDrawer db={db} onClose={() => setDrawerOpen(false)} />
      )}
    </>
  );
}

export const DatabaseCard = memo(DatabaseCardComponent, (prev, next) => 
  prev.db === next.db && prev.delay === next.delay
);
