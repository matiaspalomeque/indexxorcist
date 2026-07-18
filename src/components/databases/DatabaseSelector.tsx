import {
  AlertCircle,
  CheckSquare2,
  Clock,
  Database,
  Loader2,
  RefreshCw,
  Search,
  Square,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import * as api from "../../api/tauri";
import { useT } from "../../i18n";
import { useDatabaseSelectionStore } from "../../store/databaseSelectionStore";
import { useHistoryStore } from "../../store/historyStore";
import { isActiveRunState, useMaintenanceStore } from "../../store/maintenanceStore";
import { useProfileSettingsStore } from "../../store/profileSettingsStore";
import { useProfileStore } from "../../store/profileStore";
import { useUiStore } from "../../store/uiStore";
import { DEFAULT_OPTIONS } from "../../types";
import { computeDbAdvisorInfo, estimateRunDuration } from "../../utils/advisorUtils";
import { formatDuration } from "../../utils/format";
import { prepareNotificationPermission } from "../../utils/notifications";
import { OptionsInspector, OptionsPanel, OptionsSummaryLine } from "./OptionsPanel";

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
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);

  const historyRecords = useHistoryStore((s) => s.records);
  const loadHistory = useHistoryStore((s) => s.loadHistory);

  useEffect(() => {
    void loadHistory(undefined, 200);
  }, [loadHistory]);

  const profileRecords = useMemo(
    () => (activeProfileId ? historyRecords.filter((r) => r.profile_id === activeProfileId) : []),
    [historyRecords, activeProfileId]
  );

  const dbInfoMap = useMemo(() => {
    return new Map(databases.map((db) => [db, computeDbAdvisorInfo(db, profileRecords)]));
  }, [databases, profileRecords]);

  const urgentDatabases = useMemo(
    () => databases.filter((db) => dbInfoMap.get(db)?.level === "high"),
    [databases, dbInfoMap]
  );

  const estimatedSecs = useMemo(
    () =>
      estimateRunDuration(
        [...selected],
        dbInfoMap,
        settings.parallel_databases,
        settings.max_parallel_databases
      ),
    [selectedList, dbInfoMap, settings.parallel_databases, settings.max_parallel_databases]
  );

  const handleSelectUrgent = (urgentDbs: string[]) => {
    if (!activeProfileId) return;
    const next = new Set(selected);
    urgentDbs.forEach((db) => next.add(db));
    setSelectedForProfile(activeProfileId, Array.from(next));
  };

  const filteredDatabases = useMemo(() => {
    const query = filterQuery.trim().toLowerCase();
    const selectedLookup = new Set(selectedList);
    return databases.filter((db) => {
      if (showSelectedOnly && !selectedLookup.has(db)) return false;
      if (query && !db.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [databases, filterQuery, selectedList, showSelectedOnly]);

  const canStart =
    databases.length > 0 &&
    selected.size > 0 &&
    !starting &&
    !isRunActive;

  const loadDatabases = async () => {
    if (!activeProfileId) return;
    setLoading(true);
    setError("");
    try {
      const dbs = await api.getDatabases(activeProfileId);
      setDatabasesForProfile(activeProfileId, dbs);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const toggleAll = () => {
    if (!activeProfileId) return;
    const targetList = filterQuery.trim() !== "" || showSelectedOnly ? filteredDatabases : databases;
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

  const invertVisibleSelection = () => {
    if (!activeProfileId || filteredDatabases.length === 0) return;
    const next = new Set(selected);
    filteredDatabases.forEach((db) => {
      next.has(db) ? next.delete(db) : next.add(db);
    });
    setSelectedForProfile(activeProfileId, Array.from(next));
  };

  const toggle = (db: string) => {
    if (!activeProfileId) return;
    const next = new Set(selected);
    next.has(db) ? next.delete(db) : next.add(db);
    setSelectedForProfile(activeProfileId, Array.from(next));
  };

  const startMaintenance = async () => {
    if (!activeProfile || !activeProfileId || selected.size === 0 || isRunActive) return;
    const selectedDbs = databases.filter((d) => selected.has(d));
    setStarting(true);
    setError("");
    try {
      await prepareNotificationPermission();
      startRun(activeProfile, selectedDbs, settings.parallel_databases);
      await api.runMaintenance(activeProfileId, selectedDbs, settings);
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

  const targetForToggle = filterQuery.trim() !== "" || showSelectedOnly ? filteredDatabases : databases;
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
    <div className="min-h-full p-4 lg:p-5 xl:h-full xl:overflow-hidden">
      <div className="mx-auto flex min-h-full w-full max-w-[1800px] flex-col xl:h-full">
        <div className="grid min-h-0 flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950 xl:grid-cols-[minmax(0,2.4fr)_minmax(320px,0.9fr)]">
          <section className="flex min-h-[520px] min-w-0 flex-col p-4 lg:p-5 xl:min-h-0">
            <div className="mb-4 min-w-0">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {t("databases.title")}
              </h2>
              <p className="mt-0.5 truncate text-sm text-gray-600 dark:text-gray-400">
                {activeProfile.name} — {activeProfile.server}
              </p>
            </div>

            {error && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                <span className="break-words">{error}</span>
              </div>
            )}

            <div className="mb-3 grid gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-800 dark:bg-gray-900/60 lg:grid-cols-[minmax(180px,1fr)_auto] lg:items-center">
              <div className="relative min-w-0">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500"
                />
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(event) => setFilterQuery(event.target.value)}
                  placeholder={t("databases.filterPlaceholder")}
                  className="w-full rounded-md border border-gray-300 bg-white py-2 pl-8 pr-8 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:placeholder-gray-500"
                />
                {filterQuery && (
                  <button
                    type="button"
                    onClick={() => setFilterQuery("")}
                    aria-label={t("databases.filterClear")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setShowSelectedOnly((value) => !value)}
                  aria-pressed={showSelectedOnly}
                  disabled={databases.length === 0}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    showSelectedOnly
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-600/20 dark:text-blue-300"
                      : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                  }`}
                >
                  {showSelectedOnly ? <CheckSquare2 size={14} /> : <Square size={14} />}
                  {showSelectedOnly ? t("databases.showAllDatabases") : t("databases.showSelectedOnly")}
                </button>
                <button
                  type="button"
                  onClick={invertVisibleSelection}
                  disabled={filteredDatabases.length === 0}
                  className="rounded-md px-2 py-1.5 font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-800"
                >
                  {t("databases.invertVisible")}
                </button>
                <button
                  type="button"
                  onClick={toggleAll}
                  disabled={targetForToggle.length === 0}
                  className="rounded-md px-2 py-1.5 font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-blue-400 dark:hover:bg-blue-950/40"
                >
                  {allTargetSelected ? t("databases.deselectAll") : t("databases.selectAll")}
                </button>
                {urgentDatabases.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleSelectUrgent(urgentDatabases)}
                    className="hidden items-center gap-1 rounded-md px-2 py-1.5 font-medium text-violet-600 transition-colors hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/30 2xl:inline-flex"
                  >
                    <Zap size={13} />
                    {t("advisor.selectUrgent", { count: urgentDatabases.length })}
                  </button>
                )}
                <span className="border-l border-gray-200 pl-2 tabular-nums text-gray-500 dark:border-gray-700">
                  {t("databases.selectedCount", {
                    selected: selected.size,
                    total: databases.length,
                  })}
                </span>
                <button
                  type="button"
                  onClick={loadDatabases}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-md bg-gray-200 px-2.5 py-1.5 font-medium text-gray-700 transition-colors hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  <span className="hidden 2xl:inline">
                    {loading ? t("databases.refreshing") : t("databases.refresh")}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
              <div className="grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-3 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500 dark:bg-gray-900/70 dark:text-gray-500 sm:grid-cols-[minmax(0,1fr)_9rem]">
                <div className="flex min-w-0 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={allTargetSelected}
                    onChange={toggleAll}
                    disabled={targetForToggle.length === 0}
                    aria-label={allTargetSelected ? t("databases.deselectAll") : t("databases.selectAll")}
                    className="rounded border-gray-300 bg-white text-blue-500 focus:ring-blue-500 disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800"
                  />
                  <span>{t("databases.databaseName")}</span>
                </div>
                <span className="text-right sm:text-left">{t("databases.lastMaintenance")}</span>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {databases.length === 0 && !error ? (
                  <div className="flex h-full min-h-[300px] flex-col items-center justify-center px-6 text-center">
                    {loading ? (
                      <>
                        <Loader2 size={24} className="mb-3 animate-spin text-gray-500" />
                        <p className="text-sm text-gray-600 dark:text-gray-400">{t("databases.loading")}</p>
                      </>
                    ) : (
                      <>
                        <div className="mb-3 rounded-2xl bg-gray-100 p-3 text-gray-500 dark:bg-gray-900 dark:text-gray-500">
                          <Database size={28} />
                        </div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {t("databases.noDataEmpty")}
                        </p>
                        <p className="mt-1 max-w-md text-xs leading-5 text-gray-500">
                          {t("databases.noDataHint")}
                        </p>
                        <button
                          type="button"
                          onClick={loadDatabases}
                          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
                        >
                          <RefreshCw size={15} />
                          {t("databases.refresh")}
                        </button>
                      </>
                    )}
                  </div>
                ) : filteredDatabases.length === 0 ? (
                  <div className="flex h-full min-h-[240px] items-center justify-center px-6 text-center text-sm text-gray-500">
                    {t("databases.noMatches")}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200 dark:divide-gray-800">
                    {filteredDatabases.map((db) => {
                      const info = dbInfoMap.get(db);
                      const isSelected = selected.has(db);
                      return (
                        <label
                          key={db}
                          className={`grid cursor-pointer grid-cols-[minmax(0,1fr)_7rem] items-center gap-3 px-3 py-3 transition-colors sm:grid-cols-[minmax(0,1fr)_9rem] ${
                            isSelected
                              ? "bg-blue-50/80 hover:bg-blue-100/80 dark:bg-blue-950/45 dark:hover:bg-blue-950/60"
                              : "bg-white hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-900/70"
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggle(db)}
                              className="rounded border-gray-300 bg-white text-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
                            />
                            <Database size={15} className="flex-shrink-0 text-gray-400 dark:text-gray-600" />
                            <span className="min-w-0 truncate font-mono text-sm text-gray-800 dark:text-gray-200">
                              {db}
                            </span>
                          </span>
                          <span className="flex justify-end text-xs tabular-nums text-gray-500 sm:justify-start">
                            {info?.daysSince == null
                              ? t("databases.neverMaintained")
                              : info.daysSince < 1
                                ? t("advisor.today")
                                : t("advisor.daysAgo", { days: Math.floor(info.daysSince) })}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="hidden min-h-0 border-l border-gray-200 bg-gray-50/70 p-5 dark:border-gray-800 dark:bg-gray-900/45 xl:block">
            <OptionsInspector
              settings={settings}
              onChange={(key, value) => {
                if (activeProfileId) updateSetting(activeProfileId, key, value);
              }}
            />
          </aside>

          <div className="border-t border-gray-200 bg-gray-50 px-4 dark:border-gray-800 dark:bg-gray-900 xl:hidden">
            <details>
              <OptionsSummaryLine settings={settings} />
              <div className="pb-4">
                <OptionsPanel
                  settings={settings}
                  onChange={(key, value) => {
                    if (activeProfileId) updateSetting(activeProfileId, key, value);
                  }}
                />
              </div>
            </details>
          </div>
        </div>

        <div className="sticky bottom-0 z-30 mt-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-lg dark:border-gray-800 dark:bg-gray-900 xl:static">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-gray-700 dark:text-gray-300">
                {activeProfile.name} — {activeProfile.server}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {t("databases.statusSelected", {
                  selected: selected.size,
                  total: databases.length,
                })}
              </p>
            </div>

            {estimatedSecs !== null && selected.size > 0 && (
              <div className="flex-shrink-0 border-gray-200 text-xs text-gray-500 sm:border-l sm:pl-4 dark:border-gray-700">
                <p>{t("databases.estimatedDuration")}</p>
                <p className="mt-0.5 inline-flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300">
                  <Clock size={13} />~{formatDuration(estimatedSecs)}
                </p>
              </div>
            )}

            <button
              onClick={startMaintenance}
              disabled={!canStart}
              className="w-full rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-500 disabled:bg-gray-200 disabled:text-gray-400 sm:w-auto sm:min-w-[300px] dark:disabled:bg-gray-700 dark:disabled:text-gray-500"
            >
              {startButtonLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
