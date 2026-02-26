import { create } from "zustand";
import * as api from "../api/tauri";
import type { ServerProfile } from "../types";

interface ProfileState {
  profiles: ServerProfile[];
  loading: boolean;
  load: () => Promise<void>;
  save: (profile: ServerProfile) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set) => ({
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
    const profiles = await api.getServerProfiles();
    set({ profiles });
  },

  remove: async (id) => {
    await api.deleteServerProfile(id);
    set((s) => ({ profiles: s.profiles.filter((p) => p.id !== id) }));
  },
}));
