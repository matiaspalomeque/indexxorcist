import { create } from "zustand";
import type { RunRecord } from "../types";
import * as api from "../api/tauri";

interface HistoryState {
  records: RunRecord[];
  loading: boolean;
  error: string | null;
  loadHistory: (profileId?: string, limit?: number) => Promise<void>;
  clearHistory: (profileId?: string) => Promise<void>;
}

export const useHistoryStore = create<HistoryState>((set) => ({
  records: [],
  loading: false,
  error: null,

  loadHistory: async (profileId, limit = 100) => {
    set({ loading: true, error: null });
    try {
      const records = await api.getRunHistory(profileId, limit);
      set({ records });
    } catch (err) {
      set({ error: String(err) });
    } finally {
      set({ loading: false });
    }
  },

  clearHistory: async (profileId) => {
    try {
      await api.clearRunHistory(profileId);
      set({ records: [], error: null });
    } catch (err) {
      set({ error: String(err) });
    }
  },
}));
