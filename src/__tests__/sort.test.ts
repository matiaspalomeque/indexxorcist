import { describe, expect, it } from "vitest";
import { sortData, toggleSort, type SortConfig } from "../utils/sort";

describe("toggleSort", () => {
  it("sets ascending when no current config", () => {
    expect(toggleSort(null, "name")).toEqual({ key: "name", direction: "asc" });
  });

  it("sets ascending when switching to a different key", () => {
    expect(toggleSort({ key: "age", direction: "desc" }, "name")).toEqual({
      key: "name",
      direction: "asc",
    });
  });

  it("cycles asc -> desc for same key", () => {
    expect(toggleSort({ key: "name", direction: "asc" }, "name")).toEqual({
      key: "name",
      direction: "desc",
    });
  });

  it("cycles desc -> null for same key", () => {
    expect(toggleSort({ key: "name", direction: "desc" }, "name")).toBeNull();
  });
});

describe("sortData", () => {
  const items = [
    { name: "Charlie", age: 30 },
    { name: "Alice", age: 25 },
    { name: "Bob", age: 35 },
  ];

  it("returns a copy when config is null", () => {
    const result = sortData(items, null);
    expect(result).toEqual(items);
    expect(result).not.toBe(items);
  });

  it("sorts numbers ascending", () => {
    const result = sortData(items, { key: "age", direction: "asc" });
    expect(result.map((i) => i.age)).toEqual([25, 30, 35]);
  });

  it("sorts numbers descending", () => {
    const result = sortData(items, { key: "age", direction: "desc" });
    expect(result.map((i) => i.age)).toEqual([35, 30, 25]);
  });

  it("sorts strings case-insensitively", () => {
    const mixed = [
      { name: "charlie", age: 1 },
      { name: "Alice", age: 2 },
      { name: "bob", age: 3 },
    ];
    const result = sortData(mixed, { key: "name", direction: "asc" });
    expect(result.map((i) => i.name)).toEqual(["Alice", "bob", "charlie"]);
  });

  it("handles empty arrays", () => {
    expect(sortData([], { key: "name", direction: "asc" })).toEqual([]);
  });

  it("uses custom accessors when provided", () => {
    const data = [
      { label: "A", items: [1, 2, 3] },
      { label: "B", items: [1] },
      { label: "C", items: [1, 2] },
    ];

    const accessors = {
      count: (item: (typeof data)[number]) => item.items.length,
    };

    const result = sortData(
      data,
      { key: "count", direction: "asc" } as SortConfig,
      accessors,
    );
    expect(result.map((i) => i.label)).toEqual(["B", "C", "A"]);
  });

  it("does not mutate the original array", () => {
    const original = [...items];
    sortData(items, { key: "age", direction: "desc" });
    expect(items).toEqual(original);
  });
});
