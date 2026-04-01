import { describe, it, expect } from "vitest";
import { computeStaggerMs, computeDelay } from "../utils/stagger";

const MAX_STAGGER_MS = 600;

describe("Stagger animation delay – computeStaggerMs", () => {
  it("returns 0 when there is 0 databases", () => {
    expect(computeStaggerMs(0)).toBe(0);
  });

  it("returns 0 when there is 1 database", () => {
    expect(computeStaggerMs(1)).toBe(0);
  });

  it("returns 50ms per card for small counts (≤ 13 databases)", () => {
    // 50 * (n-1) ≤ 600 when n ≤ 13
    expect(computeStaggerMs(2)).toBe(50);
    expect(computeStaggerMs(5)).toBe(50);
    expect(computeStaggerMs(13)).toBe(50);
  });

  it("caps total spread at MAX_STAGGER_MS for large counts", () => {
    // 100 databases: staggerMs = min(50, 600/99) ≈ 6.06
    const gap = computeStaggerMs(100);
    expect(gap).toBeLessThan(50);
    // Last card delay: 99 * gap should equal MAX_STAGGER_MS
    const lastDelay = 99 * gap;
    expect(Math.round(lastDelay)).toBe(MAX_STAGGER_MS);
  });

  it("caps at MAX_STAGGER_MS for 1000 databases", () => {
    const gap = computeStaggerMs(1000);
    const lastDelay = 999 * gap;
    expect(Math.round(lastDelay)).toBe(MAX_STAGGER_MS);
  });
});

describe("Stagger animation delay – computeDelay", () => {
  it("first card always has delay 0", () => {
    expect(computeDelay(0, 100)).toBe(0);
    expect(computeDelay(0, 5)).toBe(0);
  });

  it("last card of 100 databases delays no more than MAX_STAGGER_MS", () => {
    const delay = computeDelay(99, 100);
    expect(delay).toBeLessThanOrEqual(MAX_STAGGER_MS);
  });

  it("last card of 13 databases delays exactly 600ms (13 × 50ms)", () => {
    // 12 * 50 = 600
    const delay = computeDelay(12, 13);
    expect(delay).toBe(600);
  });

  it("delays are monotonically increasing for any count", () => {
    const dbCount = 50;
    const delays = Array.from({ length: dbCount }, (_, i) => computeDelay(i, dbCount));
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1]);
    }
  });
});
