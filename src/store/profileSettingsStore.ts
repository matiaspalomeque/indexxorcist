import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_OPTIONS, type MaintenanceOptions } from "../types";

interface ProfileSettingsState {
  byProfile: Record<string, MaintenanceOptions>;
  getSettings: (profileId: string) => MaintenanceOptions;
  updateSetting: <K extends keyof MaintenanceOptions>(
    profileId: string,
    key: K,
    value: MaintenanceOptions[K]
  ) => void;
}

export const useProfileSettingsStore = create<ProfileSettingsState>()(
  persist(
    (set, get) => ({
      byProfile: {},
      // Spread DEFAULT_OPTIONS first so that stored objects missing new fields
      // (e.g. after a schema update) still resolve to sensible defaults.
      getSettings: (profileId) => ({
        ...DEFAULT_OPTIONS,
        ...(get().byProfile[profileId] ?? {}),
      }),
      updateSetting: (profileId, key, value) =>
        set((state) => ({
          byProfile: {
            ...state.byProfile,
            [profileId]: {
              ...(state.byProfile[profileId] ?? { ...DEFAULT_OPTIONS }),
              [key]: value,
            },
          },
        })),
    }),
    {
      name: "indexxorcist-profile-settings-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ byProfile: state.byProfile }),
    }
  )
);
