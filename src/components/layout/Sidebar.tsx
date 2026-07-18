import { BarChart2, Clock, Home, Lock, Moon, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "../../i18n";
import { AboutModal } from "../about/AboutModal";
import { isActiveRunState, useMaintenanceStore } from "../../store/maintenanceStore";
import { useProfileStore } from "../../store/profileStore";
import { useUiStore } from "../../store/uiStore";
import { useThemeStore } from "../../store/themeStore";
import { useI18nStore, type Lang } from "../../store/i18nStore";

function runStateLabel(runState: string | undefined, t: ReturnType<typeof useT>): string {
  if (!runState || runState === "idle") return t("runState.idle");
  return t(`runState.${runState}`) ?? runState;
}

function runStateColor(runState: string | undefined): string {
  if (runState === "running") return "text-blue-400";
  if (runState === "paused") return "text-amber-400";
  if (runState === "finished") return "text-green-400";
  if (runState === "stopped") return "text-red-400";
  return "text-gray-500";
}

function runStateDotColor(runState: string | undefined): string {
  if (runState === "running") return "bg-blue-500";
  if (runState === "paused") return "bg-amber-500";
  if (runState === "finished") return "bg-green-500";
  if (runState === "stopped") return "bg-red-500";
  return "bg-gray-400 dark:bg-gray-600";
}

function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "DB";
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function Sidebar() {
  const t = useT();
  const profiles = useProfileStore((s) => s.profiles);
  const loadProfiles = useProfileStore((s) => s.load);

  const currentView = useUiStore((s) => s.currentView);
  const activeProfileId = useUiStore((s) => s.activeProfileId);
  const connectedProfileIds = useUiStore((s) => s.connectedProfileIds);
  const setActiveProfileId = useUiStore((s) => s.setActiveProfileId);
  const closeProfileTab = useUiStore((s) => s.closeProfileTab);
  const goToProfilesHome = useUiStore((s) => s.goToProfilesHome);
  const setView = useUiStore((s) => s.setView);

  const runsByProfile = useMaintenanceStore((s) => s.byProfile);
  const resetProfile = useMaintenanceStore((s) => s.resetProfile);
  const activeRunState = activeProfileId ? runsByProfile[activeProfileId]?.runState : undefined;
  const wizardLocked = activeRunState ? isActiveRunState(activeRunState) : false;

  const { theme, toggleTheme } = useThemeStore();
  const { lang, setLang } = useI18nStore();

  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    if (profiles.length === 0) {
      void loadProfiles();
    }
  }, [loadProfiles, profiles.length]);

  return (
    <aside className="w-16 lg:w-56 2xl:w-64 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
      <div className="p-2 lg:p-3 border-b border-gray-200 dark:border-gray-800 space-y-1">
        <button
          onClick={goToProfilesHome}
          aria-label={t("sidebar.profilesHome")}
          title={t("sidebar.profilesHome")}
          className={`flex items-center justify-center gap-2 w-full px-2 lg:px-3 py-2.5 rounded-lg text-sm font-medium transition-colors lg:justify-start ${
            currentView === "profiles"
              ? "bg-blue-600 text-white"
              : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
        >
          <Home size={15} className="flex-shrink-0" />
          <span className="hidden truncate lg:inline">{t("sidebar.profilesHome")}</span>
        </button>
        <button
          onClick={() => setView("history")}
          aria-label={t("sidebar.history")}
          title={t("sidebar.history")}
          className={`flex items-center justify-center gap-2 w-full px-2 lg:px-3 py-2 rounded-lg text-sm font-medium transition-colors lg:justify-start ${
            currentView === "history"
              ? "bg-blue-600 text-white"
              : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
        >
          <Clock size={15} className="flex-shrink-0" />
          <span className="hidden truncate lg:inline">{t("sidebar.history")}</span>
        </button>
        <button
          onClick={() => setView("insights")}
          aria-label={t("sidebar.insights")}
          title={t("sidebar.insights")}
          className={`flex items-center justify-center gap-2 w-full px-2 lg:px-3 py-2 rounded-lg text-sm font-medium transition-colors lg:justify-start ${
            currentView === "insights"
              ? "bg-blue-600 text-white"
              : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
        >
          <BarChart2 size={15} className="flex-shrink-0" />
          <span className="hidden truncate lg:inline">{t("sidebar.insights")}</span>
        </button>
      </div>

      <div className="hidden flex-1 p-3 min-h-0 lg:block">
        <p className="text-2xs uppercase tracking-wide text-gray-600 dark:text-gray-500 px-2 mb-2">
          {t("sidebar.connectedTabs")}
        </p>
        {connectedProfileIds.length === 0 ? (
          <p className="text-xs text-gray-600 dark:text-gray-500 px-2">
            {t("sidebar.noTabs")}
          </p>
        ) : (
          <div className="space-y-1 overflow-y-auto max-h-full pr-1">
            {connectedProfileIds.map((profileId) => {
              const profile = profiles.find((p) => p.id === profileId);
              const runState = runsByProfile[profileId]?.runState;
              const runActive = runState ? isActiveRunState(runState) : false;
              const active = activeProfileId === profileId && currentView !== "profiles";

              return (
                <div
                  key={profileId}
                  className={`group border rounded-lg ${
                    active
                      ? "bg-blue-50 dark:bg-blue-600/20 border-blue-300 dark:border-blue-500/40"
                      : "bg-gray-50 dark:bg-gray-950/50 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                  }`}
                >
                  <div className="flex items-start gap-1 p-2">
                    <button
                      onClick={() => setActiveProfileId(profileId)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                        {profile?.name ?? runsByProfile[profileId]?.profileName ?? profileId}
                      </p>
                      <p className="text-2xs text-gray-700 dark:text-gray-400 truncate">
                        {profile?.server ?? runsByProfile[profileId]?.profileServer ?? "Server"}
                      </p>
                      <p className={`text-2xs mt-0.5 ${runStateColor(runState)}`}>
                        {runStateLabel(runState, t)}
                      </p>
                    </button>
                    <button
                      onClick={() => { closeProfileTab(profileId); resetProfile(profileId); }}
                      disabled={runActive}
                      title={runActive ? t("sidebar.closeTabDisabled") : t("sidebar.closeTab")}
                      className="p-1 text-gray-400 hover:text-red-500 disabled:text-gray-300 dark:disabled:text-gray-700 disabled:cursor-not-allowed"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 px-2 py-3 lg:hidden">
        <p className="sr-only">{t("sidebar.connectedTabs")}</p>
        <div className="flex max-h-full flex-col items-center gap-2 overflow-y-auto py-0.5">
          {connectedProfileIds.map((profileId) => {
            const profile = profiles.find((candidate) => candidate.id === profileId);
            const profileName = profile?.name ?? runsByProfile[profileId]?.profileName ?? profileId;
            const runState = runsByProfile[profileId]?.runState;
            const runActive = runState ? isActiveRunState(runState) : false;
            const active = activeProfileId === profileId && currentView !== "profiles";

            return (
              <div key={profileId} className="group relative">
                <button
                  type="button"
                  onClick={() => setActiveProfileId(profileId)}
                  aria-label={`${profileName} · ${runStateLabel(runState, t)}`}
                  title={`${profileName} · ${runStateLabel(runState, t)}`}
                  className={`relative flex h-10 w-10 items-center justify-center rounded-lg border text-xs font-semibold transition-colors ${
                    active
                      ? "border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-500/70 dark:bg-blue-600/20 dark:text-blue-200"
                      : "border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-950/50 dark:text-gray-300 dark:hover:border-gray-700 dark:hover:bg-gray-800"
                  }`}
                >
                  {profileInitials(profileName)}
                  <span
                    className={`absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full ring-2 ring-white dark:ring-gray-900 ${runStateDotColor(runState)}`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => { closeProfileTab(profileId); resetProfile(profileId); }}
                  disabled={runActive}
                  aria-label={runActive ? t("sidebar.closeTabDisabled") : t("sidebar.closeTab")}
                  title={runActive ? t("sidebar.closeTabDisabled") : t("sidebar.closeTab")}
                  className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm hover:text-red-500 disabled:cursor-not-allowed disabled:text-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:disabled:text-gray-700"
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-2 lg:p-3 border-t border-gray-200 dark:border-gray-800 space-y-2">
        {wizardLocked && activeProfileId && (
          <>
            <p className="hidden text-xs text-amber-600 dark:text-amber-500 mb-1 lg:block">
              {t("sidebar.wizardLocked")}
            </p>
            <div
              className="flex justify-center text-amber-500 lg:hidden"
              title={t("sidebar.wizardLocked")}
              aria-label={t("sidebar.wizardLocked")}
            >
              <Lock size={14} />
            </div>
          </>
        )}

        {/* Theme + Language controls */}
        <div className="flex flex-col items-center gap-2 lg:flex-row lg:justify-between">
          {/* Language toggle */}
          <button
            type="button"
            onClick={() => setLang(lang === "en" ? "es-AR" : "en")}
            aria-label={lang === "en" ? "Cambiar a Español" : "Switch to English"}
            title={lang === "en" ? "Cambiar a Español" : "Switch to English"}
            className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 lg:hidden"
          >
            {lang === "en" ? "EN" : "ES"}
          </button>
          <div className="hidden items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 lg:flex">
            {(["en", "es-AR"] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-2 py-1 text-xs rounded-md font-medium transition-colors ${
                  lang === l
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-700 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                {l === "en" ? "EN" : "ES"}
              </button>
            ))}
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? t("settings.lightMode") : t("settings.darkMode")}
            className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {/* About / version */}
          <button
            onClick={() => setShowAbout(true)}
            aria-label={`Indexxorcist v${__APP_VERSION__}`}
            title={`Indexxorcist v${__APP_VERSION__}`}
            className="text-xs text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
          >
            <span className="hidden lg:inline">v{__APP_VERSION__}</span>
            <span className="lg:hidden">v</span>
          </button>
        </div>
      </div>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </aside>
  );
}
