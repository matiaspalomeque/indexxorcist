import { useT } from "../../i18n";
import { Activity, Clock, Timer } from "lucide-react";
import { useElapsedTime, formatElapsedTime, calculateETA } from "../../hooks/useElapsedTime";

interface Props {
  current: number;
  total: number;
  profileName: string;
  profileServer: string;
  runState: string;
  isParallel: boolean;
  runningDbCount?: number;
  startedAtMs: number;
}

interface RunStateDisplay {
  color: string;
  label: string;
}

export function OverallProgressBar({ 
  current, 
  total,
  profileName,
  profileServer,
  runState,
  isParallel,
  runningDbCount = 0,
  startedAtMs
}: Props) {
  const t = useT();
  const clampedCurrent = total === 0 ? 0 : Math.min(Math.max(current, 0), total);
  const completedDbs = Math.floor(clampedCurrent);
  const displayPct = total === 0 ? 0 : Math.round((completedDbs / total) * 100);
  const barPct = total === 0 ? 0 : Math.round((clampedCurrent / total) * 100);
  
  const isActive = runState === "running" || runState === "paused";
  const elapsedSecs = useElapsedTime(startedAtMs, isActive);
  const eta = runState === "running" ? calculateETA(completedDbs, total, elapsedSecs) : null;

  const getRunStateDisplay = (): RunStateDisplay => {
    switch (runState) {
      case "running":
        return { color: "text-blue-500 dark:text-blue-400", label: t(`runState.${runState}`) };
      case "paused":
        return { color: "text-amber-500 dark:text-amber-400", label: t(`runState.${runState}`) };
      case "finished":
        return { color: "text-green-500 dark:text-green-400", label: t(`runState.${runState}`) };
      case "stopped":
        return { color: "text-red-500 dark:text-red-400", label: t(`runState.${runState}`) };
      default:
        return { color: "text-gray-500 dark:text-gray-400", label: t(`runState.${runState}`) };
    }
  };

  const stateDisplay = getRunStateDisplay();

  return (
    <div className="sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800 shadow-lg">
      <div className="px-4 lg:px-6 py-4">
        <div className="mx-auto max-w-[1800px]">
          {/* Top row: Profile info + Status */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                  {profileName}
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                  {profileServer}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className={`flex items-center gap-1.5 text-sm font-medium ${stateDisplay.color}`}>
                {runState === "running" && (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                  </span>
                )}
                {stateDisplay.label}
              </div>
              {isParallel && runningDbCount > 1 && (
                <span className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                  {runningDbCount} running
                </span>
              )}
            </div>
          </div>

          {/* Progress bar row */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400 font-medium">
                {t("progress.label")}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-gray-900 dark:text-white font-semibold">
                  {completedDbs} / {total} databases ({displayPct}%)
                </span>
                {elapsedSecs > 0 && (
                  <div className="flex items-center gap-4 text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatElapsedTime(elapsedSecs)}</span>
                    </div>
                    {eta && (
                      <div className="flex items-center gap-1">
                        <Timer className="w-3.5 h-3.5" />
                        <span>~{eta} remaining</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500 shadow-lg shadow-blue-500/30"
                style={{ width: `${barPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
