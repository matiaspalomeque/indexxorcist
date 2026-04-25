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

  // save/duplicate/remove reload from disk in `finally`: the Rust commands
  // write profiles.json before the keychain, so a keychain failure leaves
  // disk already mutated. Reloading keeps the UI consistent with durable
  // state even when the command rejects. The error still propagates so
  // callers can surface it.
  save: async (profile) => {
    try {
      await api.saveServerProfile(profile);
    } finally {
      await get().load();
    }
  },

  duplicate: async (sourceId, profile) => {
    try {
      await api.duplicateServerProfile(sourceId, profile);
    } finally {
      await get().load();
      // Settings are cloned post-reload based on actual disk state: if the
      // backend wrote profiles.json then rejected on keychain, the profile
      // is present and should still inherit the source's settings.
      if (get().profiles.some((p) => p.id === profile.id)) {
        const sourceSettings = useProfileSettingsStore.getState().getSettings(sourceId);
        useProfileSettingsStore.getState().setProfileSettings(profile.id, sourceSettings);
      }
    }
  },

  importProfiles: async (entries) => {
    // Collect per-entry failures so a single bad save (e.g. keychain reject
    // after disk commit) doesn't abort the remaining imports. Settings are
    // applied post-reload for every entry that actually landed on disk.
    const errors: unknown[] = [];
    try {
      for (const entry of entries) {
        try {
          await api.saveServerProfile(entry.profile);
        } catch (e) {
          errors.push(e);
        }
      }
    } finally {
      await get().load();
      const existingIds = new Set(get().profiles.map((p) => p.id));
      for (const entry of entries) {
        if (existingIds.has(entry.profile.id)) {
          useProfileSettingsStore
            .getState()
            .setProfileSettings(entry.profile.id, entry.settings);
        }
      }
    }
    if (errors.length > 0) {
      throw errors[0];
    }
  },

  remove: async (id) => {
    try {
      await api.deleteServerProfile(id);
    } finally {
      await get().load();
      // Only tear down profile-scoped state if the profile is actually gone
      // from disk — an unrelated error must not wipe state for a profile
      // that still exists.
      if (!get().profiles.some((p) => p.id === id)) {
        useUiStore.getState().removeProfile(id);
        useMaintenanceStore.getState().resetProfile(id);
        useDatabaseSelectionStore.getState().clearProfileSelection(id);
        useProfileSettingsStore.getState().clearProfileSettings(id);
      }
    }
  },
}));
