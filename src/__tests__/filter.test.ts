import { describe, expect, it } from "vitest";
import type { RunRecord } from "../types";
import { EMPTY_FILTERS, filterRecords, type HistoryFilters } from "../utils/filter";

function makeRecord(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id: 1,
    profile_id: "p1",
    profile_name: "Production",
    server: "sql-prod.example.com",
    started_at: "2026-03-15T12:00:00",
    finished_at: "2026-03-15T12:30:00",
    databases_processed: 5,
    databases_failed: 0,
    databases_skipped: 0,
    total_indexes_rebuilt: 10,
    total_indexes_reorganized: 5,
    total_indexes_skipped: 2,
    total_duration_secs: 1800,
    database_results: [
      {
        database_name: "AppDB",
        success: true,
        indexes_processed: 10,
        indexes_rebuilt: 5,
        indexes_reorganized: 3,
        indexes_skipped: 2,
        total_duration_secs: 900,
        errors: [],
        critical_failure: false,
        manually_skipped: false,
        interrupted: false,
        index_results: [],
      },
    ],
    ...overrides,
  };
}

describe("filterRecords", () => {
  const records: RunRecord[] = [
    makeRecord({ id: 1, profile_name: "Production", server: "sql-prod.example.com" }),
    makeRecord({
      id: 2,
      profile_name: "Staging",
      server: "sql-staging.internal",
      databases_failed: 2,
      database_results: [
        {
          database_name: "UserDB",
          success: false,
          indexes_processed: 3,
          indexes_rebuilt: 0,
          indexes_reorganized: 0,
          indexes_skipped: 0,
          total_duration_secs: 120,
          errors: ["connection failed"],
          critical_failure: true,
          manually_skipped: false,
          interrupted: false,
          index_results: [],
        },
      ],
    }),
    makeRecord({
      id: 3,
      profile_name: "Development",
      server: "localhost",
      started_at: "2026-04-01T12:00:00",
    }),
  ];

  it("returns all records when filters are empty", () => {
    expect(filterRecords(records, EMPTY_FILTERS)).toEqual(records);
  });

  it("filters by profile_name (case-insensitive)", () => {
    const filters: HistoryFilters = { ...EMPTY_FILTERS, search: "production" };
    const result = filterRecords(records, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it("filters by server", () => {
    const filters: HistoryFilters = { ...EMPTY_FILTERS, search: "staging" };
    const result = filterRecords(records, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it("filters by nested database_name", () => {
    const filters: HistoryFilters = { ...EMPTY_FILTERS, search: "UserDB" };
    const result = filterRecords(records, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it("filters by dateFrom (inclusive)", () => {
    const filters: HistoryFilters = { ...EMPTY_FILTERS, dateFrom: "2026-04-01" };
    const result = filterRecords(records, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(3);
  });

  it("filters by dateTo (inclusive, end of day)", () => {
    const filters: HistoryFilters = { ...EMPTY_FILTERS, dateTo: "2026-03-15" };
    const result = filterRecords(records, filters);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual([1, 2]);
  });

  it("filters by combined date range", () => {
    const filters: HistoryFilters = {
      ...EMPTY_FILTERS,
      dateFrom: "2026-03-16",
      dateTo: "2026-04-02",
    };
    const result = filterRecords(records, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(3);
  });

  it("filters by status hasErrors", () => {
    const filters: HistoryFilters = { ...EMPTY_FILTERS, status: "hasErrors" };
    const result = filterRecords(records, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it("filters by status allSuccess", () => {
    const filters: HistoryFilters = { ...EMPTY_FILTERS, status: "allSuccess" };
    const result = filterRecords(records, filters);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual([1, 3]);
  });

  it("applies all filters conjunctively", () => {
    const filters: HistoryFilters = {
      search: "localhost",
      dateFrom: "2026-04-01",
      dateTo: "2026-04-01",
      status: "allSuccess",
    };
    const result = filterRecords(records, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(3);
  });

  it("returns empty when no records match", () => {
    const filters: HistoryFilters = { ...EMPTY_FILTERS, search: "nonexistent" };
    expect(filterRecords(records, filters)).toHaveLength(0);
  });
});
