import { create } from "zustand";
import * as api from "../api/tauri";
import { useDatabaseSelectionStore } from "./databaseSelectionStore";
import { useMaintenanceStore } from "./maintenanceStore";
import { useProfileSettingsStore } from "./profileSettingsStore";
import { useUiStore } from "./uiStore";
import type { ServerProfile } from "../types";
import type { PreparedImportedProfile } from "../utils/profileTransfer";

interface ProfileState {
  profiles: ServerProfile[];
  loading: boolean;
  load: () => Promise<void>;
  save: (profile: ServerProfile) => Promise<void>;
  duplicate: (sourceId: string, profile: ServerProfile) => Promise<void>;
  importProfiles: (entries: PreparedImportedProfile[]) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: [],
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      const profiles = await api.getServerProfiles();
      set({ profiles });
    } finally {
      set({ loading: false });
    }
  },

  save: async (profile) => {
    await api.saveServerProfile(profile);
    await get().load();
  },

  duplicate: async (sourceId, profile) => {
    await api.duplicateServerProfile(sourceId, profile);
    const sourceSettings = useProfileSettingsStore.getState().getSettings(sourceId);
    useProfileSettingsStore.getState().setProfileSettings(profile.id, sourceSettings);
    await get().load();
  },

  importProfiles: async (entries) => {
    try {
      for (const entry of entries) {
        await api.saveServerProfile(entry.profile);
        useProfileSettingsStore
          .getState()
          .setProfileSettings(entry.profile.id, entry.settings);
      }
    } finally {
      await get().load();
    }
  },

  remove: async (id) => {
    await api.deleteServerProfile(id);
    useUiStore.getState().removeProfile(id);
    useMaintenanceStore.getState().resetProfile(id);
    useDatabaseSelectionStore.getState().clearProfileSelection(id);
    useProfileSettingsStore.getState().clearProfileSettings(id);
    set((s) => ({ profiles: s.profiles.filter((p) => p.id !== id) }));
  },
}));
