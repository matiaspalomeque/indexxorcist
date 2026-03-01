import { create } from "zustand";
import type { View, WizardView } from "../types";

interface UiState {
  currentView: View;
  activeProfileId: string | null;
  profileViews: Record<string, WizardView>;
  connectedProfileIds: string[];
  setView: (view: View) => void;
  setActiveProfileId: (id: string | null) => void;
  openProfileTab: (id: string) => void;
  closeProfileTab: (id: string) => void;
  goToProfilesHome: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  currentView: "profiles",
  activeProfileId: null,
  profileViews: {},
  connectedProfileIds: [],

  setView: (view) =>
    set((state) => {
      if (view === "profiles" || view === "history" || !state.activeProfileId) {
        return { currentView: view };
      }

      return {
        currentView: view,
        profileViews: {
          ...state.profileViews,
          [state.activeProfileId]: view as WizardView,
        },
      };
    }),

  setActiveProfileId: (id) =>
    set((state) => {
      if (!id) {
        return { activeProfileId: null, currentView: "profiles" };
      }

      const savedView = state.profileViews[id];
      const fallbackView: WizardView =
        state.currentView !== "profiles" && state.currentView !== "history"
          ? state.currentView
          : "databases";
      const nextView: WizardView = savedView ?? fallbackView;
      const connectedProfileIds = state.connectedProfileIds.includes(id)
        ? state.connectedProfileIds
        : [...state.connectedProfileIds, id];

      return {
        activeProfileId: id,
        connectedProfileIds,
        currentView: nextView,
      };
    }),

  openProfileTab: (id) =>
    set((state) => {
      const connectedProfileIds = state.connectedProfileIds.includes(id)
        ? state.connectedProfileIds
        : [...state.connectedProfileIds, id];
      const nextView = state.profileViews[id] ?? "databases";

      return {
        activeProfileId: id,
        connectedProfileIds,
        currentView: nextView,
      };
    }),

  closeProfileTab: (id) =>
    set((state) => {
      const { [id]: _removed, ...remainingViews } = state.profileViews;
      const connectedProfileIds = state.connectedProfileIds.filter(
        (profileId) => profileId !== id
      );

      if (state.activeProfileId !== id) {
        return { connectedProfileIds, profileViews: remainingViews };
      }

      const nextActiveId = connectedProfileIds[connectedProfileIds.length - 1] ?? null;
      const nextView = nextActiveId ? remainingViews[nextActiveId] ?? "databases" : "profiles";

      return {
        connectedProfileIds,
        profileViews: remainingViews,
        activeProfileId: nextActiveId,
        currentView: nextView,
      };
    }),

  goToProfilesHome: () =>
    set({
      activeProfileId: null,
      currentView: "profiles",
    }),
}));
