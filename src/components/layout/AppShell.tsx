import { Sidebar } from "./Sidebar";
import { ProfileList } from "../profiles/ProfileList";
import { DatabaseSelector } from "../databases/DatabaseSelector";
import { MaintenanceDashboard } from "../dashboard/MaintenanceDashboard";
import { ResultsSummary } from "../summary/ResultsSummary";
import { HistoryView } from "../history/HistoryView";
import { InsightsView } from "../insights/InsightsView";
import { isActiveRunState, useMaintenanceStore } from "../../store/maintenanceStore";
import { useUiStore } from "../../store/uiStore";
import { useT } from "../../i18n";
import type { View, WizardView } from "../../types";
import type { ComponentType } from "react";
import { Lock } from "lucide-react";

const VIEW_COMPONENTS: Partial<Record<View, ComponentType>> = {
  databases: DatabaseSelector,
  dashboard: MaintenanceDashboard,
  summary: ResultsSummary,
  history: HistoryView,
  insights: InsightsView,
};

export function AppShell() {
  const t = useT();
  const currentView = useUiStore((s) => s.currentView);
  const activeProfileId = useUiStore((s) => s.activeProfileId);
  const setView = useUiStore((s) => s.setView);

  const activeRunState = useMaintenanceStore((s) =>
    activeProfileId ? s.byProfile[activeProfileId]?.runState : undefined
  );

  const wizardLocked = activeRunState ? isActiveRunState(activeRunState) : false;
  const showProfilesHome = currentView === "profiles" || (!activeProfileId && currentView !== "history" && currentView !== "insights");
  const showWizardBar = !showProfilesHome && currentView !== "history" && currentView !== "insights";

  const WIZARD_STEPS: Array<{ view: WizardView; label: string; step: number }> = [
    { view: "databases", label: t("wizard.databases"), step: 1 },
    { view: "dashboard", label: t("wizard.run"), step: 2 },
    { view: "summary", label: t("wizard.summary"), step: 3 },
  ];

  const ActiveView = showProfilesHome ? ProfileList : VIEW_COMPONENTS[currentView] ?? null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {showWizardBar && (
          <div className="border-b border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 px-3 py-2.5 lg:px-6 lg:py-3">
            <div className="flex items-center gap-2 overflow-x-auto">
              {WIZARD_STEPS.map((step) => {
                const active = currentView === step.view;
                const disabled = wizardLocked && !active;

                return (
                  <button
                    key={step.view}
                    onClick={() => setView(step.view)}
                    disabled={disabled}
                    aria-disabled={disabled}
                    title={disabled ? t("wizard.lockedHint") : undefined}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors whitespace-nowrap ${
                      active
                        ? "bg-blue-50 dark:bg-blue-600/20 border-blue-400 dark:border-blue-500 text-blue-600 dark:text-blue-300"
                        : disabled
                        ? "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed"
                        : "bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-500"
                    }`}
                  >
                    <span className="text-xs font-semibold opacity-80">{step.step}</span>
                    {step.label}
                  </button>
                );
              })}
              {wizardLocked && (
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300">
                  <Lock size={13} />
                  {t("wizard.lockedHint")}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto">
          {ActiveView && <ActiveView />}
        </div>
      </main>
    </div>
  );
}
