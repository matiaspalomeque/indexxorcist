import { describe, expect, it } from "vitest";
import { computeLiveSummary, computeOverallProgress, computeRunMetrics } from "../utils/runMetrics";
import type { DatabaseCardData, MaintenanceSummary } from "../types";

function db(
  name: string,
  state: DatabaseCardData["state"],
  overrides: Partial<DatabaseCardData> = {},
): DatabaseCardData {
  return {
    name,
    state,
    indexes: [],
    indexes_processed: 0,
    indexes_rebuilt: 0,
    indexes_reorganized: 0,
    indexes_skipped: 0,
    duration_secs: 0,
    errors: [],
    ...overrides,
  };
}

function indexes(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    database_name: "db",
    schema_name: "dbo",
    table_name: "Orders",
    index_name: `IX_${index}`,
    fragmentation_percent: 35,
    page_count: 100,
    status: "pending" as const,
  }));
}

describe("runMetrics", () => {
  it("groups databases by operator-facing run state", () => {
    const metrics = computeRunMetrics([
      db("queued", "queued"),
      db("running", "running", { indexes: indexes(2), indexes_processed: 1 }),
      db("done", "done"),
      db("error", "error"),
      db("skipped", "skipped"),
      db("stopped", "stopped"),
    ]);

    expect(metrics.doneCount).toBe(4);
    expect(metrics.queuedDbs.map((item) => item.name)).toEqual(["queued"]);
    expect(metrics.runningDbs.map((item) => item.name)).toEqual(["running"]);
    expect(metrics.failedDbs.map((item) => item.name)).toEqual(["error"]);
    expect(metrics.completedDbs.map((item) => item.name)).toEqual(["done", "skipped", "stopped"]);
  });

  it("caps serial and parallel progress at the total database count", () => {
    const metrics = computeRunMetrics([
      db("done", "done"),
      db("running-a", "running", { indexes: indexes(4), indexes_processed: 2 }),
      db("running-b", "running", { indexes: indexes(2), indexes_processed: 3 }),
    ]);

    expect(computeOverallProgress(metrics, 3, false)).toBe(1.5);
    expect(computeOverallProgress(metrics, 3, true)).toBe(2.5);
    expect(computeOverallProgress(metrics, 2, true)).toBe(2);
  });

  it("uses live database counts until the backend summary is available", () => {
    const metrics = computeRunMetrics([
      db("done", "done", { indexes_rebuilt: 2, indexes_reorganized: 1 }),
      db("error", "error", { indexes_skipped: 3 }),
    ]);

    expect(computeLiveSummary(null, metrics)).toEqual({
      rebuilt: 2,
      reorganized: 1,
      skipped: 3,
      failedDbs: 1,
    });
  });

  it("lets the backend summary override live counts after completion", () => {
    const metrics = computeRunMetrics([
      db("done", "done", { indexes_rebuilt: 2, indexes_reorganized: 1 }),
    ]);
    const summary = {
      databases_processed: 1,
      databases_failed: 0,
      databases_skipped: 0,
      total_indexes_rebuilt: 5,
      total_indexes_reorganized: 4,
      total_indexes_skipped: 3,
      total_duration_secs: 20,
      database_results: [],
    } satisfies MaintenanceSummary;

    expect(computeLiveSummary(summary, metrics)).toEqual({
      rebuilt: 5,
      reorganized: 4,
      skipped: 3,
      failedDbs: 0,
    });
  });
});
