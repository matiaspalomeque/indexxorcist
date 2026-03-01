import { Pause, Play, SkipForward, Square, Loader2 } from "lucide-react";
import { useState } from "react";
import * as api from "../../api/tauri";
import { useT } from "../../i18n";
import { useMaintenanceStore } from "../../store/maintenanceStore";

interface RunControlsProps {
  profileId: string;
}

export function RunControls({ profileId }: RunControlsProps) {
  const t = useT();
  const run = useMaintenanceStore((s) => s.byProfile[profileId]);
  const setRunState = useMaintenanceStore((s) => s.setRunState);
  const setDatabaseState = useMaintenanceStore((s) => s.setDatabaseState);
  const [busy, setBusy] = useState<null | "pause" | "skip" | "stop">(null);
  const [controlError, setControlError] = useState("");

  if (!run) {
    return null;
  }

  const { runState, isParallel } = run;

  if (runState === "idle" || runState === "finished" || runState === "stopped") {
    return null;
  }

  const handlePauseResume = async () => {
    setControlError("");
    setBusy("pause");
    try {
      if (runState === "paused") {
        await api.resumeMaintenance(profileId);
        setRunState(profileId, "running");
      } else {
        await api.pauseMaintenance(profileId);
        setRunState(profileId, "paused");
      }
    } catch (error) {
      console.error(`Failed to toggle pause state for ${profileId}:`, error);
      setControlError(String(error));
    } finally {
      setBusy(null);
    }
  };

  const handleSkip = async () => {
    setControlError("");
    setBusy("skip");
    const snapshot = useMaintenanceStore.getState().byProfile[profileId];
    const activeDb =
      snapshot?.databases.find((db) => db.state === "running") ??
      (snapshot && snapshot.currentDbIndex > 0
        ? snapshot.databases[snapshot.currentDbIndex - 1]
        : undefined);
    const optimisticDbName = activeDb?.name;

    if (optimisticDbName) {
      setDatabaseState(profileId, optimisticDbName, "skipped");
    }

    try {
      await api.skipDatabase(profileId);
    } catch (error) {
      if (optimisticDbName) {
        setDatabaseState(profileId, optimisticDbName, "running");
      }
      console.error(`Failed to skip database for ${profileId}:`, error);
      setControlError(String(error));
    } finally {
      setBusy(null);
    }
  };

  const handleStop = async () => {
    setControlError("");
    const prevState = runState;
    setRunState(profileId, "stopped");
    setBusy("stop");
    try {
      await api.stopMaintenance(profileId);
    } catch (error) {
      setRunState(profileId, prevState);
      console.error(`Failed to stop maintenance for ${profileId}:`, error);
      setControlError(String(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex items-center gap-2">
        {/* Pause/Resume Button */}
        <button
          onClick={handlePauseResume}
          disabled={busy !== null}
          aria-label={runState === "paused" ? t("controls.resume") : t("controls.pause")}
          aria-busy={busy === "pause"}
          className={`group flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all transform-gpu shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${
            runState === "paused"
              ? "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white hover:scale-105"
              : "bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 hover:from-gray-200 hover:to-gray-300 dark:hover:from-gray-700 dark:hover:to-gray-600 text-gray-700 dark:text-gray-200 hover:scale-105"
          }`}
        >
          {busy === "pause" ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>{t("controls.updating")}</span>
            </>
          ) : runState === "paused" ? (
            <>
              <Play size={16} className="group-hover:scale-110 transition-transform" />
              <span>{t("controls.resume")}</span>
            </>
          ) : (
            <>
              <Pause size={16} className="group-hover:scale-110 transition-transform" />
              <span>{t("controls.pause")}</span>
            </>
          )}
        </button>

        {/* Skip Button */}
        <button
          onClick={handleSkip}
          disabled={busy !== null || isParallel}
          aria-label={t("controls.skipDb")}
          aria-busy={busy === "skip"}
          aria-disabled={isParallel}
          title={isParallel ? t("controls.skipDisabledParallel") : undefined}
          className="group flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-100 to-amber-200 dark:from-amber-900/40 dark:to-amber-800/40 hover:from-amber-500 hover:to-amber-600 text-amber-700 dark:text-amber-300 hover:text-white rounded-lg text-sm font-medium transition-all transform-gpu shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 disabled:hover:scale-100"
        >
          {busy === "skip" ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>{t("controls.skipping")}</span>
            </>
          ) : (
            <>
              <SkipForward size={16} className="group-hover:scale-110 transition-transform" />
              <span>{t("controls.skipDb")}</span>
            </>
          )}
        </button>

        {/* Stop Button */}
        <button
          onClick={handleStop}
          disabled={busy !== null}
          aria-label={t("controls.stop")}
          aria-busy={busy === "stop"}
          className="group flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-100 to-red-200 dark:from-red-900/60 dark:to-red-800/60 hover:from-red-600 hover:to-red-700 text-red-700 dark:text-red-300 hover:text-white rounded-lg text-sm font-medium transition-all transform-gpu shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 disabled:hover:scale-100"
        >
          {busy === "stop" ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>{t("controls.stopping")}</span>
            </>
          ) : (
            <>
              <Square size={16} className="group-hover:scale-110 transition-transform" />
              <span>{t("controls.stop")}</span>
            </>
          )}
        </button>
      </div>
      
      {/* Error Display */}
      {controlError && (
        <div 
          role="alert"
          className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
        >
          <p className="text-xs text-red-600 dark:text-red-400 max-w-[400px]">{controlError}</p>
        </div>
      )}
    </div>
  );
}
