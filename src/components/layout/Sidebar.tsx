import { Clock, Home, Moon, Sun, X } from "lucide-react";
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
  const activeRunState = activeProfileId ? runsByProfile[activeProfileId]?.runState : undefined;
  const wizardLocked = activeRunState ? isActiveRunState(activeRunState) : false;

  const { theme, toggleTheme } = useThemeStore();
  const { lang, setLang } = useI18nStore();

  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    if (profiles.length === 0) {
      void loadProfiles();
    }
  }, [loadProfiles, profiles.length]);

  return (
    <aside className="w-56 xl:w-64 2xl:w-72 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
      <div className="p-3 border-b border-gray-200 dark:border-gray-800 space-y-1">
        <button
          onClick={goToProfilesHome}
          className={`flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            currentView === "profiles"
              ? "bg-blue-600 text-white"
              : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
        >
          <Home size={15} />
          {t("sidebar.profilesHome")}
        </button>
        <button
          onClick={() => setView("history")}
          className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            currentView === "history"
              ? "bg-blue-600 text-white"
              : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
        >
          <Clock size={15} />
          {t("sidebar.history")}
        </button>
      </div>

      <div className="flex-1 p-3 min-h-0">
        <p className="text-[11px] uppercase tracking-wide text-gray-600 dark:text-gray-500 px-2 mb-2">
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
                      <p className="text-[11px] text-gray-700 dark:text-gray-400 truncate">
                        {profile?.server ?? runsByProfile[profileId]?.profileServer ?? "Server"}
                      </p>
                      <p className={`text-[11px] mt-0.5 ${runStateColor(runState)}`}>
                        {runStateLabel(runState, t)}
                      </p>
                    </button>
                    <button
                      onClick={() => closeProfileTab(profileId)}
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

      <div className="p-3 border-t border-gray-200 dark:border-gray-800 space-y-2">
        {wizardLocked && activeProfileId && (
          <p className="text-xs text-amber-600 dark:text-amber-500 mb-1">
            {t("sidebar.wizardLocked")}
          </p>
        )}

        {/* Theme + Language controls */}
        <div className="flex items-center justify-between gap-2">
          {/* Language toggle */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
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
            className="text-xs text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
          >
            v{__APP_VERSION__}
          </button>
        </div>
      </div>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </aside>
  );
}
