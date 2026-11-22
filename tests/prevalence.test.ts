import { describe, expect, it } from "vitest";
import { estimatePrevalence, wilson } from "@/backend/analyzers/prevalence";

describe("wilson", () => {
  it("returns [0, 0] for an empty sample", () => {
    expect(wilson(0, 0)).toEqual([0, 0]);
  });

  it("brackets the observed proportion", () => {
    const [low, high] = wilson(50, 100);
    expect(low).toBeCloseTo(0.4038, 3);
    expect(high).toBeCloseTo(0.5962, 3);
    expect(low).toBeLessThan(0.5);
    expect(high).toBeGreaterThan(0.5);
  });
});

describe("estimatePrevalence", () => {
  it("corrects the observed share for detector error", () => {
    const result = estimatePrevalence(10, 100, 0.9, 0.95);
    expect(result.observed).toBeCloseTo(0.1, 12);
    expect(result.estimated).toBeCloseTo(0.05 / 0.85, 12);
    expect(result.low).toBeLessThanOrEqual(result.estimated);
    expect(result.high).toBeGreaterThanOrEqual(result.estimated);
  });

  it("clamps estimates to the 0 to 1 range", () => {
    expect(estimatePrevalence(100, 100, 0.9, 0.95).estimated).toBe(1);
    expect(estimatePrevalence(0, 100, 0.9, 0.95).estimated).toBe(0);
  });

  it("returns zeros for an empty sample", () => {
    expect(estimatePrevalence(0, 0, 0.9, 0.95)).toEqual({
      observed: 0,
      estimated: 0,
      low: 0,
      high: 0,
    });
  });

  it("falls back to the observed share when correction is unstable", () => {
    const result = estimatePrevalence(10, 100, 0.5, 0.5);
    expect(result.estimated).toBeCloseTo(0.1, 12);
    expect(result.low).toBeCloseTo(wilson(10, 100)[0], 12);
    expect(result.high).toBeCloseTo(wilson(10, 100)[1], 12);
  });
});
