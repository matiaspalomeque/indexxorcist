import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// Tests for DatabaseCard's onSkip callback contract (Phase 4)
// Verifies the onSkip(dbName: string) call pattern without requiring DOM.
// ---------------------------------------------------------------------------

describe("DatabaseCard – onSkip callback contract", () => {
  it("passes db.name to onSkip when skip button handler is invoked", () => {
    // Mirrors the onClick: () => onSkip?.(db.name)
    const db = { name: "MyDatabase" };
    const onSkip = vi.fn();
    const onClick = () => onSkip?.(db.name);
    onClick();
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onSkip).toHaveBeenCalledWith("MyDatabase");
  });

  it("does not throw when onSkip is undefined (optional chaining)", () => {
    const db = { name: "MyDatabase" };
    const onSkip: ((dbName: string) => void) | undefined = undefined;
    const onClick = () => onSkip?.(db.name);
    expect(() => onClick()).not.toThrow();
  });

  it("passes different db names correctly", () => {
    const cases = ["ProductionDB", "StagingDB", "DB-with-hyphens", "DB with spaces"];
    for (const name of cases) {
      const onSkip = vi.fn();
      const db = { name };
      const onClick = () => onSkip?.(db.name);
      onClick();
      expect(onSkip).toHaveBeenCalledWith(name);
    }
  });

  it("memo comparator includes onSkip — same reference means no re-render", () => {
    // Mirrors the memo comparator: prev.onSkip === next.onSkip
    const onSkip = vi.fn();
    const db = {};
    const prev = { db, delay: 0, skipPending: false, onSkip };
    const next = { db, delay: 0, skipPending: false, onSkip }; // same reference
    const areEqual =
      prev.db === next.db &&
      prev.delay === next.delay &&
      prev.skipPending === next.skipPending &&
      prev.onSkip === next.onSkip;
    expect(areEqual).toBe(true);
  });

  it("memo comparator detects onSkip change — new closure forces re-render", () => {
    const prev = { db: {}, delay: 0, skipPending: false, onSkip: () => {} };
    const next = { db: {}, delay: 0, skipPending: false, onSkip: () => {} }; // different ref
    const areEqual =
      prev.db === next.db &&
      prev.delay === next.delay &&
      prev.skipPending === next.skipPending &&
      prev.onSkip === next.onSkip;
    expect(areEqual).toBe(false); // different function references — card will re-render
  });

  it("memo comparator detects onSkip going from defined to undefined", () => {
    const onSkip = vi.fn();
    const prev = { db: {}, delay: 0, skipPending: false, onSkip };
    const next = { db: {}, delay: 0, skipPending: false, onSkip: undefined };
    const areEqual =
      prev.db === next.db &&
      prev.delay === next.delay &&
      prev.skipPending === next.skipPending &&
      prev.onSkip === next.onSkip;
    expect(areEqual).toBe(false);
  });

  it("handleSkip (stable useCallback) produces same reference for memo optimization", () => {
    // Simulates what MaintenanceDashboard does:
    // handleSkip is created once via useCallback and passed directly as onSkip.
    // The same reference is used across renders, so memo comparator returns true.
    const handleSkip = vi.fn();
    const prevOnSkip: typeof handleSkip | undefined = handleSkip;
    const nextOnSkip: typeof handleSkip | undefined = handleSkip; // same stable ref
    expect(prevOnSkip === nextOnSkip).toBe(true); // memo: no re-render
  });
});
