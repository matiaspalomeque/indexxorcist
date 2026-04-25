import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../api/tauri";
import { useHistoryStore } from "../store/historyStore";
import type { RunRecord } from "../types";

vi.mock("../api/tauri", () => ({
  getRunHistory: vi.fn(),
  clearRunHistory: vi.fn(),
}));

const mockGetRunHistory = vi.mocked(api.getRunHistory);
const mockClearRunHistory = vi.mocked(api.clearRunHistory);

const makeRecords = (count: number, idBase = 0): RunRecord[] =>
  Array.from({ length: count }, (_, i) => ({
    id: idBase + count - i,
    profile_id: "p",
    profile_name: "P",
    server: "s",
    started_at: "2026-04-23T00:00:00Z",
    finished_at: "2026-04-23T00:01:00Z",
    databases_processed: 0,
    databases_failed: 0,
    databases_skipped: 0,
    total_indexes_rebuilt: 0,
    total_indexes_reorganized: 0,
    total_indexes_skipped: 0,
    total_duration_secs: 0,
    database_results: [],
  }));

const resetStore = () =>
  useHistoryStore.setState({
    records: [],
    loading: false,
    error: null,
    loadedLimit: 0,
    clearGen: 0,
    inFlight: 0,
  });

describe("historyStore race protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it("keeps the larger window when a smaller request resolves last", async () => {
    let resolve500: (v: RunRecord[]) => void = () => {};
    let resolve200: (v: RunRecord[]) => void = () => {};
    const p500 = new Promise<RunRecord[]>((r) => {
      resolve500 = r;
    });
    const p200 = new Promise<RunRecord[]>((r) => {
      resolve200 = r;
    });

    mockGetRunHistory.mockImplementationOnce(() => p500);
    mockGetRunHistory.mockImplementationOnce(() => p200);

    const pending500 = useHistoryStore.getState().loadHistory(undefined, 500);
    const pending200 = useHistoryStore.getState().loadHistory(undefined, 200);

    resolve200(makeRecords(200));
    resolve500(makeRecords(500));
    await Promise.all([pending500, pending200]);

    const state = useHistoryStore.getState();
    expect(state.records).toHaveLength(500);
    expect(state.loadedLimit).toBe(500);
    expect(state.loading).toBe(false);
  });

  it("drops an in-flight response when clearHistory runs before it resolves", async () => {
    let resolveFetch: (v: RunRecord[]) => void = () => {};
    const pFetch = new Promise<RunRecord[]>((r) => {
      resolveFetch = r;
    });
    mockGetRunHistory.mockImplementationOnce(() => pFetch);
    mockClearRunHistory.mockResolvedValue(undefined);

    const pending = useHistoryStore.getState().loadHistory(undefined, 300);
    await useHistoryStore.getState().clearHistory();

    resolveFetch(makeRecords(300));
    await pending;

    const state = useHistoryStore.getState();
    expect(state.records).toHaveLength(0);
    expect(state.loadedLimit).toBe(0);
  });

  it("does not let a stale large load overwrite a fresh small refresh", async () => {
    // Simulates the maintenance-finished race: a large load was issued before
    // the new run was persisted (stale snapshot), then refreshHistory runs
    // after persistence and returns the fresh snapshot. The refresh must win
    // even though its response is smaller.
    let resolveStale500: (v: RunRecord[]) => void = () => {};
    let resolveFresh100: (v: RunRecord[]) => void = () => {};
    const pStale = new Promise<RunRecord[]>((r) => {
      resolveStale500 = r;
    });
    const pFresh = new Promise<RunRecord[]>((r) => {
      resolveFresh100 = r;
    });

    mockGetRunHistory.mockImplementationOnce(() => pStale);
    mockGetRunHistory.mockImplementationOnce(() => pFresh);

    const pendingLoad = useHistoryStore.getState().loadHistory(undefined, 500);
    const pendingRefresh = useHistoryStore.getState().refreshHistory();

    // Fresh refresh resolves first with the new run (id 100). The stale load
    // resolves after with ids 99..1 (it missed the insert).
    resolveFresh100(makeRecords(100));
    resolveStale500(makeRecords(99));
    await Promise.all([pendingLoad, pendingRefresh]);

    const state = useHistoryStore.getState();
    expect(state.records[0]?.id).toBe(100);
    expect(state.records).toHaveLength(100);
    // loadedLimit must reflect the committed window so the cache gate in
    // loadHistory doesn't skip future requests that aren't actually covered.
    expect(state.loadedLimit).toBe(100);
  });

  it("shrinks loadedLimit when a fresher small refresh lands after a stale large commit", async () => {
    // Inverse ordering of the previous test: the stale large load commits
    // first, then the fresh small refresh overwrites it. The cached window
    // must shrink to match records, otherwise a later loadHistory(200) would
    // be served from cache despite only 100 rows being present.
    let resolveStale500: (v: RunRecord[]) => void = () => {};
    let resolveFresh100: (v: RunRecord[]) => void = () => {};
    const pStale = new Promise<RunRecord[]>((r) => {
      resolveStale500 = r;
    });
    const pFresh = new Promise<RunRecord[]>((r) => {
      resolveFresh100 = r;
    });

    mockGetRunHistory.mockImplementationOnce(() => pStale);
    mockGetRunHistory.mockImplementationOnce(() => pFresh);

    const pendingLoad = useHistoryStore.getState().loadHistory(undefined, 500);
    const pendingRefresh = useHistoryStore.getState().refreshHistory();

    resolveStale500(makeRecords(99));
    resolveFresh100(makeRecords(100));
    await Promise.all([pendingLoad, pendingRefresh]);

    const state = useHistoryStore.getState();
    expect(state.records[0]?.id).toBe(100);
    expect(state.records).toHaveLength(100);
    expect(state.loadedLimit).toBe(100);

    // A subsequent loadHistory(200) must refetch rather than be served from
    // the shrunken cache, so data the user expects is not silently truncated.
    mockGetRunHistory.mockResolvedValueOnce(makeRecords(150));
    await useHistoryStore.getState().loadHistory(undefined, 200);
    expect(mockGetRunHistory).toHaveBeenCalledTimes(3);
  });

  it("skips the IPC entirely when the requested window is already cached", async () => {
    mockGetRunHistory.mockResolvedValueOnce(makeRecords(500));
    await useHistoryStore.getState().loadHistory(undefined, 500);
    expect(mockGetRunHistory).toHaveBeenCalledTimes(1);

    await useHistoryStore.getState().loadHistory(undefined, 200);
    expect(mockGetRunHistory).toHaveBeenCalledTimes(1);
    expect(useHistoryStore.getState().records).toHaveLength(500);
  });
});
