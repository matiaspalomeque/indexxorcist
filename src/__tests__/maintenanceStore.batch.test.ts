import { describe, it, expect, beforeEach } from "vitest";
import { useMaintenanceStore, _resetBatchQueue } from "../store/maintenanceStore";
import type {
  DbStartPayload,
  IndexFoundPayload,
  IndexActionPayload,
  IndexCompletePayload,
  ServerProfile,
} from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROFILE_ID = "test-profile-1";
const DB_NAME = "TestDatabase";

const MOCK_PROFILE: ServerProfile = {
  id: PROFILE_ID,
  name: "Test Profile",
  server: "localhost",
  port: 1433,
  auth_type: "sqlServer",
  username: "sa",
  password: "password",
  encrypt: false,
  trust_server_certificate: true,
};

function makeIndexFoundPayload(indexName: string, dbName = DB_NAME): IndexFoundPayload {
  return {
    profile_id: PROFILE_ID,
    index: {
      database_name: dbName,
      schema_name: "dbo",
      table_name: "Orders",
      index_name: indexName,
      fragmentation_percent: 35,
      page_count: 100,
    },
  };
}

function makeIndexActionPayload(indexName: string): IndexActionPayload {
  return {
    profile_id: PROFILE_ID,
    db_name: DB_NAME,
    schema_name: "dbo",
    table_name: "Orders",
    index_name: indexName,
    action: "REBUILD",
  };
}

function makeIndexCompletePayload(indexName: string): IndexCompletePayload {
  return {
    profile_id: PROFILE_ID,
    db_name: DB_NAME,
    schema_name: "dbo",
    table_name: "Orders",
    index_name: indexName,
    action: "REBUILD",
    success: true,
    duration_secs: 1.5,
    retry_attempts: 0,
  };
}

function getDb(dbName = DB_NAME) {
  const run = useMaintenanceStore.getState().byProfile[PROFILE_ID];
  return run?.databases.find((d) => d.name === dbName);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  useMaintenanceStore.setState({ byProfile: {} });
  _resetBatchQueue();
  // Seed the run so handlers have a profile to work with
  useMaintenanceStore.getState().startRun(MOCK_PROFILE, [DB_NAME], false);
});

// ---------------------------------------------------------------------------
// Phase 1: Batching tests
// ---------------------------------------------------------------------------

describe("handleIndexFound – batching", () => {
  it("defers store update until microtask flushes", async () => {
    const store = useMaintenanceStore.getState();
    store.handleIndexFound(makeIndexFoundPayload("idx_A"));

    // The store mutation is pending — state must not have changed yet
    expect(getDb()?.indexes).toHaveLength(0);

    await Promise.resolve(); // flush microtask queue

    expect(getDb()?.indexes).toHaveLength(1);
    expect(getDb()?.indexes[0].index_name).toBe("idx_A");
  });

  it("batches multiple calls into a single state update with all indexes", async () => {
    const store = useMaintenanceStore.getState();
    store.handleIndexFound(makeIndexFoundPayload("idx_1"));
    store.handleIndexFound(makeIndexFoundPayload("idx_2"));
    store.handleIndexFound(makeIndexFoundPayload("idx_3"));

    // None should be visible before flush
    expect(getDb()?.indexes).toHaveLength(0);

    await Promise.resolve(); // flush

    const db = getDb();
    expect(db?.indexes).toHaveLength(3);
    expect(db?.indexes.map((i) => i.index_name)).toEqual(["idx_1", "idx_2", "idx_3"]);
  });

  it("preserves index status as pending after discovery", async () => {
    useMaintenanceStore.getState().handleIndexFound(makeIndexFoundPayload("idx_status"));
    await Promise.resolve();

    expect(getDb()?.indexes[0].status).toBe("pending");
  });

  it("does not add duplicate indexes", async () => {
    const store = useMaintenanceStore.getState();
    store.handleIndexFound(makeIndexFoundPayload("idx_dup"));
    store.handleIndexFound(makeIndexFoundPayload("idx_dup")); // same index twice

    await Promise.resolve();

    expect(getDb()?.indexes).toHaveLength(1);
  });
});

describe("handleIndexAction – batching", () => {
  it("defers store update until microtask flush", async () => {
    // First discover indexes
    useMaintenanceStore.getState().handleIndexFound(makeIndexFoundPayload("idx_act"));
    await Promise.resolve(); // flush discovery batch

    // Now trigger action — deferred
    useMaintenanceStore.getState().handleIndexAction(makeIndexActionPayload("idx_act"));

    // Status should still be "pending" before flush
    expect(getDb()?.indexes[0].status).toBe("pending");

    await Promise.resolve(); // flush action batch

    expect(getDb()?.indexes[0].status).toBe("processing");
    expect(getDb()?.indexes[0].action).toBe("REBUILD");
  });

  it("batches multiple action events into one store update", async () => {
    const store = useMaintenanceStore.getState();
    store.handleIndexFound(makeIndexFoundPayload("idx_a1"));
    store.handleIndexFound(makeIndexFoundPayload("idx_a2"));
    await Promise.resolve();

    store.handleIndexAction(makeIndexActionPayload("idx_a1"));
    store.handleIndexAction(makeIndexActionPayload("idx_a2"));

    // Both still pending before flush
    expect(getDb()?.indexes[0].status).toBe("pending");
    expect(getDb()?.indexes[1].status).toBe("pending");

    await Promise.resolve(); // flush actions

    expect(getDb()?.indexes[0].status).toBe("processing");
    expect(getDb()?.indexes[1].status).toBe("processing");
  });
});

describe("handleIndexComplete – batching", () => {
  it("defers store update until microtask flush", async () => {
    const store = useMaintenanceStore.getState();
    store.handleIndexFound(makeIndexFoundPayload("idx_cmp"));
    await Promise.resolve();

    store.handleIndexComplete(makeIndexCompletePayload("idx_cmp"));

    // indexes_processed is still 0 before flush
    expect(getDb()?.indexes_processed).toBe(0);

    await Promise.resolve(); // flush

    expect(getDb()?.indexes_processed).toBe(1);
    expect(getDb()?.indexes[0].status).toBe("done");
  });

  it("batches multiple completions correctly", async () => {
    const store = useMaintenanceStore.getState();
    store.handleIndexFound(makeIndexFoundPayload("idx_c1"));
    store.handleIndexFound(makeIndexFoundPayload("idx_c2"));
    store.handleIndexFound(makeIndexFoundPayload("idx_c3"));
    await Promise.resolve();

    store.handleIndexComplete(makeIndexCompletePayload("idx_c1"));
    store.handleIndexComplete(makeIndexCompletePayload("idx_c2"));
    store.handleIndexComplete(makeIndexCompletePayload("idx_c3"));

    expect(getDb()?.indexes_processed).toBe(0); // not yet flushed

    await Promise.resolve(); // flush

    expect(getDb()?.indexes_processed).toBe(3);
    expect(getDb()?.indexes_rebuilt).toBe(3);
  });

  it("increments indexes_skipped for SKIP action", async () => {
    const store = useMaintenanceStore.getState();
    store.handleIndexFound(makeIndexFoundPayload("idx_skip"));
    await Promise.resolve();

    store.handleIndexComplete({
      ...makeIndexCompletePayload("idx_skip"),
      action: "SKIP",
      success: false,
    });
    await Promise.resolve();

    expect(getDb()?.indexes_skipped).toBe(1);
    expect(getDb()?.indexes_rebuilt).toBe(0);
    expect(getDb()?.indexes[0].status).toBe("skipped");
  });

  it("records error status on failure", async () => {
    const store = useMaintenanceStore.getState();
    store.handleIndexFound(makeIndexFoundPayload("idx_fail"));
    await Promise.resolve();

    store.handleIndexComplete({
      ...makeIndexCompletePayload("idx_fail"),
      success: false,
      error: "Deadlock",
    });
    await Promise.resolve();

    expect(getDb()?.indexes[0].status).toBe("error");
    expect(getDb()?.indexes[0].error).toBe("Deadlock");
  });
});

describe("handleDbStart – direct (not batched)", () => {
  it("updates state synchronously without needing microtask flush", () => {
    const payload: DbStartPayload = {
      profile_id: PROFILE_ID,
      db_name: DB_NAME,
      current: 1,
      total: 5,
    };

    useMaintenanceStore.getState().handleDbStart(payload);

    // Should be visible immediately — no await needed
    const db = getDb();
    expect(db?.state).toBe("running");
    expect(useMaintenanceStore.getState().byProfile[PROFILE_ID].totalDbs).toBe(5);
  });
});

describe("ordering: batched mutations compose in call order", () => {
  it("applies index-found then index-action in the same microtask batch", async () => {
    const store = useMaintenanceStore.getState();
    // Enqueue both in the same synchronous block
    store.handleIndexFound(makeIndexFoundPayload("idx_order"));
    store.handleIndexAction(makeIndexActionPayload("idx_order"));

    // Before flush: no change
    expect(getDb()?.indexes).toHaveLength(0);

    await Promise.resolve(); // flush

    // Both mutations applied in order: found → action
    const idx = getDb()?.indexes[0];
    expect(idx?.index_name).toBe("idx_order");
    expect(idx?.status).toBe("processing");
  });

  it("applies all three event types batched together", async () => {
    const store = useMaintenanceStore.getState();
    store.handleIndexFound(makeIndexFoundPayload("idx_all"));
    store.handleIndexAction(makeIndexActionPayload("idx_all"));
    store.handleIndexComplete(makeIndexCompletePayload("idx_all"));

    await Promise.resolve(); // single flush for all three

    const idx = getDb()?.indexes[0];
    expect(idx?.status).toBe("done");
    expect(getDb()?.indexes_processed).toBe(1);
    expect(getDb()?.indexes_rebuilt).toBe(1);
  });
});

describe("independent batches across multiple microtasks", () => {
  it("processes successive batches correctly", async () => {
    const store = useMaintenanceStore.getState();

    // First batch
    store.handleIndexFound(makeIndexFoundPayload("idx_batch1"));
    await Promise.resolve();
    expect(getDb()?.indexes).toHaveLength(1);

    // Second batch (new queueMicrotask registration)
    store.handleIndexFound(makeIndexFoundPayload("idx_batch2"));
    await Promise.resolve();
    expect(getDb()?.indexes).toHaveLength(2);
  });
});

describe("handleDbComplete ordering – regression: indexes_processed must not exceed indexes.length", () => {
  it("indexes_processed stays <= indexes.length when all events arrive in the same macrotask", async () => {
    const store = useMaintenanceStore.getState();
    const N = 3;
    const names = ["idx_r1", "idx_r2", "idx_r3"];

    // Simulate burst: all events fire synchronously (same macrotask)
    names.forEach((n) => store.handleIndexFound(makeIndexFoundPayload(n)));
    names.forEach((n) => store.handleIndexAction(makeIndexActionPayload(n)));
    names.forEach((n) => store.handleIndexComplete(makeIndexCompletePayload(n)));
    store.handleDbComplete({
      profile_id: PROFILE_ID,
      result: {
        database_name: DB_NAME,
        indexes_processed: N,
        indexes_rebuilt: N,
        indexes_reorganized: 0,
        indexes_skipped: 0,
        total_duration_secs: 1.0,
        errors: [],
        interrupted: false,
        manually_skipped: false,
        critical_failure: false,
        success: true,
        index_results: [],
      },
    });

    // Flush the microtask queue
    await Promise.resolve();

    const db = getDb();
    expect(db?.indexes.length).toBe(N);
    expect(db?.indexes_processed).toBeLessThanOrEqual(db?.indexes.length ?? 0);
    expect(db?.state).toBe("done");
  });
});

describe("indexes_processed must never exceed indexes.length", () => {
  it("handleIndexComplete for unknown index does not increment counters", async () => {
    const store = useMaintenanceStore.getState();
    // Fire index-complete without a preceding index-found
    store.handleIndexComplete(makeIndexCompletePayload("idx_ghost"));
    await Promise.resolve();

    const db = getDb();
    expect(db?.indexes_processed).toBe(0);
    expect(db?.indexes_rebuilt).toBe(0);
  });

  it("handleDbComplete caps backend counts at db.indexes.length", async () => {
    const store = useMaintenanceStore.getState();
    // Only 2 indexes discovered by the frontend
    store.handleIndexFound(makeIndexFoundPayload("idx_a"));
    store.handleIndexFound(makeIndexFoundPayload("idx_b"));
    await Promise.resolve();

    // Backend reports higher counts than frontend knows about
    store.handleDbComplete({
      profile_id: PROFILE_ID,
      result: {
        database_name: DB_NAME,
        indexes_processed: 5,
        indexes_rebuilt: 3,
        indexes_reorganized: 2,
        indexes_skipped: 0,
        total_duration_secs: 1.0,
        errors: [],
        interrupted: false,
        manually_skipped: false,
        critical_failure: false,
        success: true,
        index_results: [],
      },
    });
    await Promise.resolve();

    const db = getDb();
    expect(db?.indexes_processed).toBe(2);
    expect(db?.indexes_rebuilt).toBe(2);
    expect(db?.indexes_reorganized).toBe(2);
    expect(db?.indexes_processed).toBeLessThanOrEqual(db?.indexes.length ?? 0);
  });
});
