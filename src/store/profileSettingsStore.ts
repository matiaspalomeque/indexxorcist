import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_OPTIONS, type MaintenanceOptions } from "../types";

export interface ProfileTestStatus {
  result: "success" | "error";
  at: string; // ISO timestamp
  error?: string;
}

interface ProfileSettingsState {
  byProfile: Record<string, MaintenanceOptions>;
  lastTestByProfile: Record<string, ProfileTestStatus>;
  getSettings: (profileId: string) => MaintenanceOptions;
  setProfileSettings: (profileId: string, settings: MaintenanceOptions) => void;
  updateSetting: <K extends keyof MaintenanceOptions>(
    profileId: string,
    key: K,
    value: MaintenanceOptions[K]
  ) => void;
  clearProfileSettings: (profileId: string) => void;
  recordTestResult: (profileId: string, status: ProfileTestStatus) => void;
  getLastTest: (profileId: string) => ProfileTestStatus | undefined;
}

export const useProfileSettingsStore = create<ProfileSettingsState>()(
  persist(
    (set, get) => ({
      byProfile: {},
      lastTestByProfile: {},
      // Spread DEFAULT_OPTIONS first so that stored objects missing new fields
      // (e.g. after a schema update) still resolve to sensible defaults.
      getSettings: (profileId) => ({
        ...DEFAULT_OPTIONS,
        ...(get().byProfile[profileId] ?? {}),
      }),
      setProfileSettings: (profileId, settings) =>
        set((state) => ({
          byProfile: {
            ...state.byProfile,
            [profileId]: { ...settings },
          },
        })),
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
      clearProfileSettings: (profileId) =>
        set((state) => {
          const { [profileId]: _removedSettings, ...restSettings } = state.byProfile;
          const { [profileId]: _removedTest, ...restTests } = state.lastTestByProfile;
          return { byProfile: restSettings, lastTestByProfile: restTests };
        }),
      recordTestResult: (profileId, status) =>
        set((state) => ({
          lastTestByProfile: { ...state.lastTestByProfile, [profileId]: status },
        })),
      getLastTest: (profileId) => get().lastTestByProfile[profileId],
    }),
    {
      name: "indexxorcist-profile-settings-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        byProfile: state.byProfile,
        lastTestByProfile: state.lastTestByProfile,
      }),
    }
  )
);
