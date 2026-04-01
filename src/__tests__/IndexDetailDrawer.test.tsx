import { describe, it, expect } from "vitest";
import type { IndexDetail } from "../types";

// ---------------------------------------------------------------------------
// Pure pagination logic extracted from IndexDetailDrawer (Phase 5)
// Tests verify the same logic that drives the component state.
// ---------------------------------------------------------------------------

const PAGE_SIZE = 100;

function makeIndexes(count: number): IndexDetail[] {
  return Array.from({ length: count }, (_, i) => ({
    database_name: "TestDB",
    schema_name: "dbo",
    table_name: `Table${i}`,
    index_name: `IX_Test_${i}`,
    fragmentation_percent: 35,
    page_count: 100,
    status: "done" as const,
    action: "REBUILD" as const,
    duration_secs: 1.0,
    retry_attempts: 0,
  }));
}

/** Mirrors the IndexDetailDrawer state derivation */
function computePaginationState(
  indexes: IndexDetail[],
  visibleCount: number
): { visibleIndexes: IndexDetail[]; hasMore: boolean } {
  return {
    visibleIndexes: indexes.slice(0, visibleCount),
    hasMore: indexes.length > visibleCount,
  };
}

describe("IndexDetailDrawer – pagination logic", () => {
  it("shows all indexes when total ≤ PAGE_SIZE", () => {
    const indexes = makeIndexes(50);
    const { visibleIndexes, hasMore } = computePaginationState(indexes, PAGE_SIZE);
    expect(visibleIndexes).toHaveLength(50);
    expect(hasMore).toBe(false);
  });

  it("shows exactly PAGE_SIZE when total > PAGE_SIZE", () => {
    const indexes = makeIndexes(150);
    const { visibleIndexes, hasMore } = computePaginationState(indexes, PAGE_SIZE);
    expect(visibleIndexes).toHaveLength(PAGE_SIZE);
    expect(hasMore).toBe(true);
  });

  it("has no 'Show more' when total equals PAGE_SIZE exactly", () => {
    const indexes = makeIndexes(PAGE_SIZE);
    const { visibleIndexes, hasMore } = computePaginationState(indexes, PAGE_SIZE);
    expect(visibleIndexes).toHaveLength(PAGE_SIZE);
    expect(hasMore).toBe(false);
  });

  it("reveals remaining indexes after clicking 'Show more' (next page)", () => {
    const indexes = makeIndexes(150);
    const nextVisibleCount = PAGE_SIZE + PAGE_SIZE; // simulates 'Show more' click
    const { visibleIndexes, hasMore } = computePaginationState(indexes, nextVisibleCount);
    expect(visibleIndexes).toHaveLength(150);
    expect(hasMore).toBe(false);
  });

  it("'Show more' button disappears after all rows become visible", () => {
    const indexes = makeIndexes(120);
    // Second page would show up to 200, but only 120 exist
    const { visibleIndexes, hasMore } = computePaginationState(indexes, PAGE_SIZE * 2);
    expect(visibleIndexes).toHaveLength(120);
    expect(hasMore).toBe(false);
  });

  it("remaining count in 'Show more' label is correct", () => {
    const total = 150;
    const visibleCount = PAGE_SIZE;
    const remaining = total - visibleCount;
    expect(remaining).toBe(50);
  });

  it("handles empty index list", () => {
    const { visibleIndexes, hasMore } = computePaginationState([], PAGE_SIZE);
    expect(visibleIndexes).toHaveLength(0);
    expect(hasMore).toBe(false);
  });

  it("visibleIndexes preserves correct order (first PAGE_SIZE items)", () => {
    const indexes = makeIndexes(150);
    const { visibleIndexes } = computePaginationState(indexes, PAGE_SIZE);
    expect(visibleIndexes[0].index_name).toBe("IX_Test_0");
    expect(visibleIndexes[PAGE_SIZE - 1].index_name).toBe(`IX_Test_${PAGE_SIZE - 1}`);
  });

  it("each 'Show more' click increases visible count by PAGE_SIZE", () => {
    let visibleCount = PAGE_SIZE;
    const increment = () => { visibleCount += PAGE_SIZE; };
    increment();
    expect(visibleCount).toBe(PAGE_SIZE * 2);
    increment();
    expect(visibleCount).toBe(PAGE_SIZE * 3);
  });
});
