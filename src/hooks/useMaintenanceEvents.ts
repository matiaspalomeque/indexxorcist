import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import type {
  DbCompletePayload,
  DbStartPayload,
  IndexActionPayload,
  IndexCompletePayload,
  IndexFoundPayload,
  MaintenanceControlPayload,
  MaintenanceErrorPayload,
  MaintenanceFinishedPayload,
} from "../types";
import { useMaintenanceStore } from "../store/maintenanceStore";
import { useUiStore } from "../store/uiStore";
import { useHistoryStore } from "../store/historyStore";

// Mounted once at App root — persists across view navigation.
// Store methods are read via getState() inside the effect so the dep array is
// truly empty and listeners are never torn down and re-registered mid-run.
export function useMaintenanceEvents() {
  useEffect(() => {
    let disposed = false;
    let unlisteners: Array<() => void> = [];

    const register = async () => {
      const store = useMaintenanceStore.getState;
      const listeners = await Promise.all([
        listen<DbStartPayload>("maintenance:db-start", (e) =>
          store().handleDbStart(e.payload)
        ),
        listen<IndexFoundPayload>("maintenance:index-found", (e) =>
          store().handleIndexFound(e.payload)
        ),
        listen<IndexActionPayload>("maintenance:index-action", (e) =>
          store().handleIndexAction(e.payload)
        ),
        listen<IndexCompletePayload>("maintenance:index-complete", (e) =>
          store().handleIndexComplete(e.payload)
        ),
        listen<DbCompletePayload>("maintenance:db-complete", (e) =>
          store().handleDbComplete(e.payload)
        ),
        listen<MaintenanceFinishedPayload>("maintenance:finished", (e) => {
          store().handleFinished(e.payload);
          // Refresh history so the completed/stopped run is immediately visible
          void useHistoryStore.getState().loadHistory(undefined, 100);
          // Auto-navigate to summary if the user is viewing this profile's dashboard
          const ui = useUiStore.getState();
          if (
            ui.activeProfileId === e.payload.profile_id &&
            ui.currentView !== "profiles" &&
            ui.currentView !== "history"
          ) {
            useUiStore.getState().setView("summary");
          }
        }),
        listen<MaintenanceControlPayload>("maintenance:control", (e) => {
          store().setRunState(e.payload.profile_id, e.payload.state);
          if (e.payload.state === "stopped") {
            store().handleStopSignal(e.payload.profile_id);
          }
        }),
        listen<MaintenanceErrorPayload>("maintenance:error", (e) =>
          console.error(
            `[Maintenance:${e.payload.profile_id}]`,
            e.payload.message
          )
        ),
      ]);

      if (disposed) {
        listeners.forEach((u) => u());
        return;
      }

      unlisteners = listeners;
    };

    register().catch((err) =>
      console.error("[MaintenanceEvents] Failed to register event listeners:", err)
    );

    return () => {
      disposed = true;
      unlisteners.forEach((u) => u());
      unlisteners = [];
    };
  }, []); // stable: store methods come from getState(), not reactive subscriptions
}
