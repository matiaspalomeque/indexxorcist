import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ProfilesViewMode = "grid" | "list";
export type ProfilesSortMode = "lastUsed" | "name" | "env" | "verified" | "manual";

const RECENT_LIMIT = 5;

interface ProfilesViewState {
  pinnedProfileIds: string[];
  recentProfileIds: string[]; // most-recent first
  manualOrder: string[];
  viewMode: ProfilesViewMode;
  groupByEnv: boolean;
  sortMode: ProfilesSortMode;
  togglePinned: (id: string) => void;
  isPinned: (id: string) => boolean;
  pushRecent: (id: string) => void;
  setManualOrder: (ids: string[]) => void;
  forgetProfile: (id: string) => void;
  setViewMode: (m: ProfilesViewMode) => void;
  setGroupByEnv: (v: boolean) => void;
  setSortMode: (m: ProfilesSortMode) => void;
}

export const useProfilesViewStore = create<ProfilesViewState>()(
  persist(
    (set, get) => ({
      pinnedProfileIds: [],
      recentProfileIds: [],
      manualOrder: [],
      viewMode: "grid",
      groupByEnv: false,
      sortMode: "lastUsed",

      togglePinned: (id) =>
        set((state) => ({
          pinnedProfileIds: state.pinnedProfileIds.includes(id)
            ? state.pinnedProfileIds.filter((p) => p !== id)
            : [...state.pinnedProfileIds, id],
        })),

      isPinned: (id) => get().pinnedProfileIds.includes(id),

      pushRecent: (id) =>
        set((state) => {
          const filtered = state.recentProfileIds.filter((p) => p !== id);
          return { recentProfileIds: [id, ...filtered].slice(0, RECENT_LIMIT) };
        }),

      setManualOrder: (ids) => set({ manualOrder: ids }),

      forgetProfile: (id) =>
        set((state) => ({
          pinnedProfileIds: state.pinnedProfileIds.filter((p) => p !== id),
          recentProfileIds: state.recentProfileIds.filter((p) => p !== id),
          manualOrder: state.manualOrder.filter((p) => p !== id),
        })),

      setViewMode: (m) => set({ viewMode: m }),
      setGroupByEnv: (v) => set({ groupByEnv: v }),
      setSortMode: (m) => set({ sortMode: m }),
    }),
    {
      name: "indexxorcist-profiles-view-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        pinnedProfileIds: state.pinnedProfileIds,
        recentProfileIds: state.recentProfileIds,
        manualOrder: state.manualOrder,
        viewMode: state.viewMode,
        groupByEnv: state.groupByEnv,
        sortMode: state.sortMode,
      }),
    }
  )
);
