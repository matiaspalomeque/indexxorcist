import { Pause, Play, SkipForward, Square } from "lucide-react";
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
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <button
          onClick={handlePauseResume}
          disabled={busy !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy === "pause" ? (
            <>{t("controls.updating")}</>
          ) : runState === "paused" ? (
            <><Play size={14} /> {t("controls.resume")}</>
          ) : (
            <><Pause size={14} /> {t("controls.pause")}</>
          )}
        </button>

        <button
          onClick={handleSkip}
          disabled={busy !== null || isParallel}
          title={isParallel ? t("controls.skipDisabledParallel") : undefined}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-amber-600 hover:text-white text-sm text-gray-700 dark:text-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy === "skip" ? (
            <>{t("controls.skipping")}</>
          ) : (
            <><SkipForward size={14} /> {t("controls.skipDb")}</>
          )}
        </button>

        <button
          onClick={handleStop}
          disabled={busy !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-900/60 hover:bg-red-600 hover:text-white text-sm text-red-600 dark:text-red-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy === "stop" ? (
            <>{t("controls.stopping")}</>
          ) : (
            <><Square size={14} /> {t("controls.stop")}</>
          )}
        </button>
      </div>
      {controlError && (
        <p className="text-xs text-red-500 dark:text-red-400 max-w-[320px] text-right">{controlError}</p>
      )}
    </div>
  );
}
