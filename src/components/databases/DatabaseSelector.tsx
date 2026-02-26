import { AlertCircle, Loader2, RefreshCw, Search, X } from "lucide-react";
import { useState } from "react";
import * as api from "../../api/tauri";
import { useT } from "../../i18n";
import { useDatabaseSelectionStore } from "../../store/databaseSelectionStore";
import { isActiveRunState, useMaintenanceStore } from "../../store/maintenanceStore";
import { useProfileSettingsStore } from "../../store/profileSettingsStore";
import { useProfileStore } from "../../store/profileStore";
import { useUiStore } from "../../store/uiStore";
import { DEFAULT_OPTIONS } from "../../types";
import { OptionsPanel } from "./OptionsPanel";

export function DatabaseSelector() {
  const t = useT();
  const profiles = useProfileStore((s) => s.profiles);
  const activeProfileId = useUiStore((s) => s.activeProfileId);
  const setView = useUiStore((s) => s.setView);
  const profileOverrides = useProfileSettingsStore((s) =>
    activeProfileId ? (s.byProfile[activeProfileId] ?? null) : null
  );
  const settings = profileOverrides
    ? { ...DEFAULT_OPTIONS, ...profileOverrides }
    : DEFAULT_OPTIONS;
  const updateSetting = useProfileSettingsStore((s) => s.updateSetting);
  const startRun = useMaintenanceStore((s) => s.startRun);
  const resetProfileRun = useMaintenanceStore((s) => s.resetProfile);
  const runForActiveProfile = useMaintenanceStore((s) =>
    activeProfileId ? s.byProfile[activeProfileId] : undefined
  );
  const profileSelection = useDatabaseSelectionStore((s) =>
    activeProfileId ? s.byProfile[activeProfileId] : undefined
  );
  const setDatabasesForProfile = useDatabaseSelectionStore((s) => s.setDatabasesForProfile);
  const setSelectedForProfile = useDatabaseSelectionStore((s) => s.setSelectedForProfile);

  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? null;
  const databases = profileSelection?.databases ?? [];
  const selectedList = profileSelection?.selected ?? [];
  const selected = new Set(selectedList);
  const isRunActive =
    runForActiveProfile !== undefined &&
    isActiveRunState(runForActiveProfile.runState);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [filterQuery, setFilterQuery] = useState("");

  const filteredDatabases =
    filterQuery.trim() === ""
      ? databases
      : databases.filter((db) =>
          db.toLowerCase().includes(filterQuery.toLowerCase())
        );

  const canStart =
    databases.length > 0 &&
    selected.size > 0 &&
    !starting &&
    !isRunActive;

  const loadDatabases = async () => {
    if (!activeProfile || !activeProfileId) return;
    setLoading(true);
    setError("");
    try {
      const dbs = await api.getDatabases(activeProfile);
      setDatabasesForProfile(activeProfileId, dbs);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const toggleAll = () => {
    if (!activeProfileId) return;
    const targetList = filterQuery.trim() !== "" ? filteredDatabases : databases;
    if (targetList.length === 0) return;
    const allTargetSelected = targetList.every((db) => selected.has(db));
    if (allTargetSelected) {
      const next = new Set(selected);
      targetList.forEach((db) => next.delete(db));
      setSelectedForProfile(activeProfileId, Array.from(next));
    } else {
      const next = new Set(selected);
      targetList.forEach((db) => next.add(db));
      setSelectedForProfile(activeProfileId, Array.from(next));
    }
  };

  const toggle = (db: string) => {
    if (!activeProfileId) return;
    const next = new Set(selected);
    next.has(db) ? next.delete(db) : next.add(db);
    setSelectedForProfile(activeProfileId, Array.from(next));
  };

  const startMaintenance = async () => {
    if (!activeProfile || selected.size === 0 || isRunActive) return;
    const selectedDbs = databases.filter((d) => selected.has(d));
    setStarting(true);
    setError("");
    try {
      startRun(activeProfile, selectedDbs, settings.parallel_databases);
      await api.runMaintenance(activeProfile, selectedDbs, settings);
      setView("dashboard");
    } catch (e) {
      resetProfileRun(activeProfile.id);
      setError(String(e));
    } finally {
      setStarting(false);
    }
  };

  if (!activeProfile) {
    return (
      <div className="p-6">
        <p className="text-gray-700 dark:text-gray-400 text-sm">{t("databases.noProfile")}</p>
      </div>
    );
  }

  const targetForToggle = filterQuery.trim() !== "" ? filteredDatabases : databases;
  const allTargetSelected =
    targetForToggle.length > 0 && targetForToggle.every((db) => selected.has(db));

  const startButtonLabel = starting
    ? t("databases.btnStarting")
    : isRunActive
    ? t("databases.btnRunActive")
    : databases.length === 0
    ? loading
      ? t("databases.btnLoading")
      : t("databases.btnLoadFirst")
    : selected.size === 0
    ? t("databases.btnSelectOne")
    : t("databases.btnStart", { count: selected.size });

  return (
    <div className="p-4 lg:p-6 pb-28">
      <div className="mx-auto max-w-[1800px] grid grid-cols-1 2xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)] gap-4 lg:gap-6 items-start">
        <div className="min-h-[520px] bg-gray-100/60 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 rounded-xl p-4 lg:p-5 flex flex-col">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between mb-4">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t("databases.title")}</h2>
              <p className="text-sm text-gray-700 dark:text-gray-400 mt-0.5 truncate">
                {activeProfile.name} — {activeProfile.server}
              </p>
            </div>
            <button
              onClick={loadDatabases}
              disabled={loading}
              className="self-start lg:self-auto inline-flex items-center gap-2 px-3 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {loading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <RefreshCw size={15} />
              )}
              {loading ? t("databases.refreshing") : t("databases.refresh")}
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg mb-4 text-sm text-red-700 dark:text-red-300">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
              <span className="break-words">{error}</span>
            </div>
          )}

          {databases.length === 0 && !error && (
            <div className="flex-1 rounded-lg border border-dashed border-gray-300 dark:border-gray-800 bg-gray-100/40 dark:bg-gray-950/40 flex flex-col items-center justify-center text-center px-4">
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin text-gray-600 dark:text-gray-500 mb-2" />
                  <p className="text-sm text-gray-700 dark:text-gray-400">{t("databases.loading")}</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-700 dark:text-gray-400">{t("databases.noDataEmpty")}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-500 mt-1">
                    {t("databases.noDataHint")}
                  </p>
                </>
              )}
            </div>
          )}

          {databases.length > 0 && (
            <div className="flex-1 min-h-0 flex flex-col">
              {/* Filter input */}
              <div className="relative mb-3">
                <Search
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-500 pointer-events-none"
                />
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder={t("databases.filterPlaceholder")}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg pl-8 pr-8 py-1.5 text-sm text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
                {filterQuery && (
                  <button
                    onClick={() => setFilterQuery("")}
                    aria-label={t("databases.filterClear")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={toggleAll}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors"
                >
                  {filterQuery.trim() !== ""
                    ? allTargetSelected
                      ? t("databases.deselectFiltered", { count: filteredDatabases.length })
                      : t("databases.selectFiltered", { count: filteredDatabases.length })
                    : allTargetSelected
                      ? t("databases.deselectAll")
                      : t("databases.selectAll")}
                </button>
                <span className="text-xs text-gray-600 dark:text-gray-500">
                  {t("databases.selectedCount", {
                    selected: selected.size,
                    total: databases.length,
                  })}
                </span>
              </div>

              <div className="space-y-1 overflow-y-auto max-h-[340px] pr-1">
                {filteredDatabases.length === 0 ? (
                  <p className="text-center py-6 text-sm text-gray-600 dark:text-gray-500">
                    {t("databases.noDataEmpty")}
                  </p>
                ) : (
                  filteredDatabases.map((db) => (
                    <label
                      key={db}
                      className="flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(db)}
                        onChange={() => toggle(db)}
                        className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-800 dark:text-gray-200 font-mono truncate">
                        {db}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="min-h-0">
          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 lg:p-5 2xl:sticky 2xl:top-4">
            <OptionsPanel
              settings={settings}
              onChange={(key, value) => {
                if (activeProfileId) updateSetting(activeProfileId, key, value);
              }}
            />
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-30 mt-4 -mx-4 lg:-mx-6 px-4 lg:px-6 pb-2">
        <div className="mx-auto max-w-[1800px]">
          <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-3 lg:px-4 lg:py-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between shadow-2xl">
            <div className="min-w-0">
              <p className="text-xs text-gray-700 dark:text-gray-400 truncate">
                {activeProfile.name} · {activeProfile.server}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-500">
                {t("databases.statusSelected", {
                  selected: selected.size,
                  total: databases.length,
                })}
              </p>
            </div>
            <button
              onClick={startMaintenance}
              disabled={!canStart}
              className="w-full lg:w-auto lg:min-w-[280px] py-2.5 px-4 bg-green-600 hover:bg-green-500 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 dark:disabled:text-gray-500 text-white font-medium text-sm rounded-lg transition-colors"
            >
              {startButtonLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
