import { create } from "zustand";
import type { RunRecord } from "../types";
import * as api from "../api/tauri";

interface HistoryState {
  records: RunRecord[];
  loading: boolean;
  error: string | null;
  // Size of the most recently applied unfiltered response. Used as a cache
  // gate: a caller asking for fewer rows than this skips the IPC. Tracks
  // actual records length (not the requested limit) so an out-of-order
  // fresher-but-smaller commit correctly shrinks the cached window.
  loadedLimit: number;
  // Bumped only by clearHistory so in-flight fetches can detect that the
  // store was cleared since their request started and drop their response.
  clearGen: number;
  // In-flight fetch counter; `loading` stays true until every concurrent
  // fetch has settled.
  inFlight: number;
  loadHistory: (profileId?: string, limit?: number) => Promise<void>;
  refreshHistory: () => Promise<void>;
  clearHistory: (profileId?: string) => Promise<void>;
}

const beginFetch = (s: HistoryState): Partial<HistoryState> => ({
  loading: true,
  error: null,
  inFlight: s.inFlight + 1,
});

const endFetch = (s: HistoryState): Partial<HistoryState> => {
  const inFlight = Math.max(0, s.inFlight - 1);
  return { inFlight, loading: inFlight > 0 };
};

// Records come back ordered by id DESC, so rs[0] holds the newest run.
// Empty response ⇒ -Infinity so any non-empty committed state beats it.
const newestRunId = (rs: RunRecord[]): number => rs[0]?.id ?? -Infinity;

// Content-based freshness check for out-of-order responses. A new response
// is only applied if (a) its newest run id is at least as high as what's
// already committed — blocks stale large loads from overwriting a fresher
// small refresh — and (b) on a tie it has at least as many rows, which
// preserves the larger window when two equally-fresh loads race.
const isFresher = (next: RunRecord[], current: RunRecord[]): boolean => {
  const nextNewest = newestRunId(next);
  const currNewest = newestRunId(current);
  if (nextNewest < currNewest) return false;
  if (nextNewest === currNewest && next.length < current.length) return false;
  return true;
};

export const useHistoryStore = create<HistoryState>((set, get) => ({
  records: [],
  loading: false,
  error: null,
  loadedLimit: 0,
  clearGen: 0,
  inFlight: 0,

  loadHistory: async (profileId, limit = 100) => {
    const { loadedLimit, records } = get();
    if (profileId === undefined && records.length > 0 && limit <= loadedLimit) {
      return;
    }
    const gen = get().clearGen;
    set(beginFetch);
    try {
      const next = await api.getRunHistory(profileId, limit);
      if (get().clearGen !== gen) return;
      set((s) => {
        // Scoped loads replace unconditionally — records shape changes with
        // the filter, so the cross-scope freshness check doesn't apply.
        // Return `s` (same reference) so Zustand's Object.is check skips
        // the notification — a `{}` partial would still merge to a new object
        // and fire listeners.
        if (profileId === undefined && !isFresher(next, s.records)) return s;
        const nextLimit = profileId === undefined ? next.length : s.loadedLimit;
        return { records: next, loadedLimit: nextLimit };
      });
    } catch (err) {
      if (get().clearGen !== gen) return;
      set({ error: String(err) });
    } finally {
      set(endFetch);
    }
  },

  refreshHistory: async () => {
    const limit = Math.max(get().loadedLimit, 100);
    const gen = get().clearGen;
    set(beginFetch);
    try {
      const next = await api.getRunHistory(undefined, limit);
      if (get().clearGen !== gen) return;
      set((s) => {
        if (!isFresher(next, s.records)) return s;
        return { records: next, loadedLimit: next.length };
      });
    } catch (err) {
      if (get().clearGen !== gen) return;
      set({ error: String(err) });
    } finally {
      set(endFetch);
    }
  },

  clearHistory: async (profileId) => {
    try {
      await api.clearRunHistory(profileId);
      set((s) => ({
        records: [],
        loadedLimit: 0,
        error: null,
        clearGen: s.clearGen + 1,
      }));
    } catch (err) {
      set({ error: String(err) });
    }
  },
}));
